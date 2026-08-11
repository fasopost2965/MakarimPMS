import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Prisma, Room, StatutChambre } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  HOUSEKEEPING_MAINTENANCE_PROJECTION,
  type HousekeepingMaintenanceProjection,
} from '../housekeeping/housekeeping-maintenance-projection.token';
import { RoomsService } from '../rooms/rooms.service';
import { canTransition } from '../rooms/utils/room-transitions';
import { ClassifyMaintenanceTicketDto } from './dto/classify-maintenance-ticket.dto';
import { CreateMaintenanceTicketDto } from './dto/create-maintenance-ticket.dto';

const TICKET_INCLUDE = {
  room: { include: { roomType: true } },
} as const;

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  // Lecture informative pour disponibilité ; les décisions d'écriture
  // appellent cette méthode uniquement après avoir verrouillé Room. Toutes
  // les mutations de bloqueur verrouillent la même Room en premier : elle
  // est le mutex commun entre Maintenance, ventes, Stay et Housekeeping.
  async hasActiveSalesBlocker(
    roomId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    if (tx) {
      // Lecture verrouillante = current read InnoDB. Une lecture Prisma
      // ordinaire peut rester figée sur un snapshot REPEATABLE READ établi
      // avant l'attente du verrou Room et manquer un ticket committé pendant
      // cette attente (reproduit par checkout ↔ ouverture bloqueur).
      const blockers = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id
        FROM MaintenanceTicket
        WHERE roomId = ${roomId}
          AND bloqueVente = true
          AND resoluAt IS NULL
        LIMIT 1
        FOR UPDATE
      `;
      return blockers.length > 0;
    }

    const blocker = await this.prisma.maintenanceTicket.findFirst({
      where: { roomId, bloqueVente: true, resoluAt: null },
      select: { id: true },
    });
    return blocker !== null;
  }

  async findActiveBlockingRoomIds(
    tx?: Prisma.TransactionClient,
  ): Promise<number[]> {
    const client = tx ?? this.prisma;
    const blockers = await client.maintenanceTicket.findMany({
      where: { roomId: { not: null }, bloqueVente: true, resoluAt: null },
      select: { roomId: true },
      distinct: ['roomId'],
    });
    return blockers.flatMap((ticket) =>
      ticket.roomId === null ? [] : [ticket.roomId],
    );
  }

  async assertNoActiveSalesBlocker(
    roomId: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    // Le double verrouillage éventuel dans une même transaction est un no-op
    // InnoDB. Le prendre ici ferme les oublis futurs et garantit toujours
    // l'ordre Room -> MaintenanceTicket.
    await this.roomsService.lockRoomForUpdate(roomId, tx);
    if (await this.hasActiveSalesBlocker(roomId, tx)) {
      throw new ConflictException(
        `La chambre ${roomId} est indisponible : une panne bloquant la vente est ouverte.`,
      );
    }
  }

  // Création de ticket (cahier des charges §5.8). Un ticket lié à une
  // chambre est bloquant par défaut ; un incident hors chambre ne peut pas
  // porter un blocage commercial sans cible.
  async createTicket(dto: CreateMaintenanceTicketDto, userId?: number) {
    if (!dto.roomId && dto.bloqueVente === true) {
      throw new BadRequestException(
        'Un ticket sans chambre ne peut pas bloquer la vente.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let room: Room | null = null;
      if (dto.roomId) {
        room = await this.roomsService.lockRoomForUpdate(dto.roomId, tx);
      }

      const bloqueVente = dto.roomId ? (dto.bloqueVente ?? true) : false;

      const ticket = await tx.maintenanceTicket.create({
        data: {
          roomId: dto.roomId,
          typePanne: dto.typePanne,
          priorite: dto.priorite,
          photoUrl: dto.photoUrl,
          assigneA: dto.assigneA,
          bloqueVente,
        },
        include: TICKET_INCLUDE,
      });

      if (room && bloqueVente) {
        await this.projectBlockingRoom(room, dto.typePanne, userId, tx);
      }

      return ticket;
    });
  }

  // Résolution (cahier des charges §5.8). Ne libère la chambre que s'il
  // n'existe aucun autre ticket ouvert pour la même chambre — sinon elle
  // reste bloquée jusqu'à résolution de tous ses tickets.
  async resolve(id: number, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const ticketHint = await tx.maintenanceTicket.findUnique({
        where: { id },
        select: { roomId: true },
      });
      if (!ticketHint) {
        throw new NotFoundException(`Ticket ${id} introuvable.`);
      }

      // Ordre partagé avec createTicket() et les writers Housekeeping :
      // Room d'abord, puis l'objet métier qui motive la transition. Le hint
      // non verrouillé ne sert qu'à trouver la Room ; toute décision repose
      // sur le ticket relu sous verrou ci-dessous.
      const room = ticketHint.roomId
        ? await this.roomsService.lockRoomForUpdate(ticketHint.roomId, tx)
        : null;
      const tickets = await tx.$queryRaw<
        Array<{
          id: number;
          roomId: number | null;
          bloqueVente: boolean;
          resoluAt: Date | null;
        }>
      >`
        SELECT id, roomId, bloqueVente, resoluAt
        FROM MaintenanceTicket
        WHERE id = ${id}
        FOR UPDATE
      `;
      if (tickets.length === 0) {
        throw new NotFoundException(`Ticket ${id} introuvable.`);
      }
      const ticket = tickets[0];
      if (ticket.roomId !== ticketHint.roomId) {
        throw new ConflictException(
          `Le rattachement chambre du ticket ${id} a changé pendant sa résolution.`,
        );
      }
      if (ticket.resoluAt) {
        throw new ConflictException('Ce ticket est déjà résolu.');
      }

      const resolved = await tx.maintenanceTicket.update({
        where: { id },
        data: { resoluAt: new Date() },
        include: TICKET_INCLUDE,
      });

      if (ticket.roomId && ticket.bloqueVente && room) {
        await this.releaseRoomIfLastBlocker(
          room,
          'Ticket de maintenance bloquant résolu',
          userId,
          tx,
        );
      }

      return resolved;
    });
  }

  async classify(
    id: number,
    dto: ClassifyMaintenanceTicketDto,
    userId?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const ticketHint = await tx.maintenanceTicket.findUnique({
        where: { id },
        select: { roomId: true },
      });
      if (!ticketHint) {
        throw new NotFoundException(`Ticket ${id} introuvable.`);
      }

      const room = ticketHint.roomId
        ? await this.roomsService.lockRoomForUpdate(ticketHint.roomId, tx)
        : null;
      const tickets = await tx.$queryRaw<
        Array<{
          id: number;
          roomId: number | null;
          typePanne: string;
          bloqueVente: boolean;
          resoluAt: Date | null;
        }>
      >`
        SELECT id, roomId, typePanne, bloqueVente, resoluAt
        FROM MaintenanceTicket
        WHERE id = ${id}
        FOR UPDATE
      `;
      if (tickets.length === 0) {
        throw new NotFoundException(`Ticket ${id} introuvable.`);
      }
      const ticket = tickets[0];
      if (ticket.roomId !== ticketHint.roomId) {
        throw new ConflictException(
          `Le rattachement chambre du ticket ${id} a changé pendant sa classification.`,
        );
      }

      await this.assertCanClassify(userId, tx);
      if (ticket.resoluAt) {
        throw new ConflictException(
          'Un ticket résolu ne peut plus être reclassifié.',
        );
      }
      if (!ticket.roomId && dto.bloqueVente) {
        throw new ConflictException(
          'Un ticket sans chambre ne peut pas bloquer la vente.',
        );
      }

      if (ticket.bloqueVente !== dto.bloqueVente) {
        await tx.maintenanceTicket.update({
          where: { id },
          data: { bloqueVente: dto.bloqueVente },
        });

        if (room && dto.bloqueVente) {
          await this.projectBlockingRoom(
            room,
            `Ticket #${id} reclassifié bloquant : ${ticket.typePanne}`,
            userId,
            tx,
          );
        } else if (room) {
          await this.releaseRoomIfLastBlocker(
            room,
            `Ticket #${id} reclassifié non bloquant`,
            userId,
            tx,
          );
        }
      }

      return tx.maintenanceTicket.findUniqueOrThrow({
        where: { id },
        include: TICKET_INCLUDE,
      });
    });
  }

  private async assertCanClassify(
    userId: number | undefined,
    tx: Prisma.TransactionClient,
  ) {
    if (userId === undefined) {
      throw new ForbiddenException(
        'Permission de classification Maintenance requise.',
      );
    }
    const user = await tx.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { roleId: true, actif: true },
    });
    if (!user?.actif) {
      throw new ForbiddenException(
        'Permission de classification Maintenance requise.',
      );
    }
    const grant = await tx.permission.findFirst({
      where: {
        OR: [
          { module: 'maintenance', action: 'write' },
          { module: 'housekeeping', action: 'control' },
        ],
        roles: { some: { roleId: user.roleId } },
      },
      select: { id: true },
    });
    if (!grant) {
      throw new ForbiddenException(
        'Permission requise : maintenance:write ou housekeeping:control.',
      );
    }
  }

  private async projectBlockingRoom(
    room: Room,
    motif: string,
    userId: number | undefined,
    tx: Prisma.TransactionClient,
  ) {
    // Une panne ouverte pendant l'occupation conserve OCCUPEE/DEPART_PREVU.
    // Le checkout ou le changement de chambre projettera EN_MAINTENANCE sous
    // le même verrou Room.
    if (
      room.statut === StatutChambre.OCCUPEE ||
      room.statut === StatutChambre.DEPART_PREVU ||
      room.statut === StatutChambre.EN_MAINTENANCE
    ) {
      return;
    }
    if (canTransition(room.statut, StatutChambre.EN_MAINTENANCE)) {
      await this.roomsService.transitionRoom(
        room.id,
        StatutChambre.EN_MAINTENANCE,
        {
          expectedFrom: room.statut,
          motif,
          userId,
          tx,
        },
      );
      return;
    }
    throw new ConflictException(
      `Impossible de projeter la chambre ${room.id} en maintenance depuis ${room.statut}.`,
    );
  }

  private async releaseRoomIfLastBlocker(
    room: Room,
    motif: string,
    userId: number | undefined,
    tx: Prisma.TransactionClient,
  ) {
    if (await this.hasActiveSalesBlocker(room.id, tx)) {
      return;
    }
    if (room.statut !== StatutChambre.EN_MAINTENANCE) {
      return;
    }

    const housekeepingProjection =
      this.moduleRef.get<HousekeepingMaintenanceProjection>(
        HOUSEKEEPING_MAINTENANCE_PROJECTION,
        { strict: false },
      );
    const target = await housekeepingProjection.getRoomStatusAfterMaintenance(
      room.id,
      tx,
    );
    await this.roomsService.transitionRoom(room.id, target, {
      expectedFrom: room.statut,
      motif,
      userId,
      tx,
    });
  }

  async findAll(params: { roomId?: number; ouvert?: boolean }) {
    return this.prisma.maintenanceTicket.findMany({
      where: {
        roomId: params.roomId,
        resoluAt:
          params.ouvert === undefined
            ? undefined
            : params.ouvert
              ? null
              : { not: null },
      },
      include: TICKET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const ticket = await this.prisma.maintenanceTicket.findUnique({
      where: { id },
      include: TICKET_INCLUDE,
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} introuvable.`);
    }
    return ticket;
  }
}
