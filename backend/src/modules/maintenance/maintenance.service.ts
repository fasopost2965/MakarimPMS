import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Room, StatutChambre } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { canTransition } from '../rooms/utils/room-transitions';
import { CreateMaintenanceTicketDto } from './dto/create-maintenance-ticket.dto';

const TICKET_INCLUDE = {
  room: { include: { roomType: true } },
} as const;

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
  ) {}

  // Création de ticket (cahier des charges §5.8). Si roomId est renseigné,
  // la chambre est bloquée automatiquement en EN_MAINTENANCE via la machine
  // à états — jamais d'écriture directe de Room.statut ici (CLAUDE.md
  // règle 5). Le blocage est sauté silencieusement si la transition n'est
  // pas valide depuis le statut courant : chambre OCCUPEE/DEPART_PREVU (un
  // séjour y est en cours — le personnel doit pouvoir tracer l'incident sans
  // que ça échoue), ou déjà EN_MAINTENANCE (ticket concurrent, no-op).
  async createTicket(dto: CreateMaintenanceTicketDto, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      let room: Room | null = null;
      if (dto.roomId) {
        room = await this.roomsService.findByIdOrThrow(dto.roomId, tx);
      }

      const ticket = await tx.maintenanceTicket.create({
        data: {
          roomId: dto.roomId,
          typePanne: dto.typePanne,
          priorite: dto.priorite,
          photoUrl: dto.photoUrl,
          assigneA: dto.assigneA,
        },
        include: TICKET_INCLUDE,
      });

      if (room && canTransition(room.statut, StatutChambre.EN_MAINTENANCE)) {
        await this.roomsService.transitionRoom(
          room.id,
          StatutChambre.EN_MAINTENANCE,
          { motif: dto.typePanne, userId, tx },
        );
      }

      return ticket;
    });
  }

  // Résolution (cahier des charges §5.8). Ne libère la chambre que s'il
  // n'existe aucun autre ticket ouvert pour la même chambre — sinon elle
  // reste bloquée jusqu'à résolution de tous ses tickets.
  async resolve(id: number, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.maintenanceTicket.findUnique({ where: { id } });
      if (!ticket) {
        throw new NotFoundException(`Ticket ${id} introuvable.`);
      }
      if (ticket.resoluAt) {
        throw new ConflictException('Ce ticket est déjà résolu.');
      }

      const resolved = await tx.maintenanceTicket.update({
        where: { id },
        data: { resoluAt: new Date() },
        include: TICKET_INCLUDE,
      });

      if (ticket.roomId) {
        const otherOpenTickets = await tx.maintenanceTicket.count({
          where: { roomId: ticket.roomId, resoluAt: null, id: { not: id } },
        });

        if (otherOpenTickets === 0) {
          const room = await this.roomsService.findById(ticket.roomId, tx);
          if (room && room.statut === StatutChambre.EN_MAINTENANCE) {
            await this.roomsService.transitionRoom(
              ticket.roomId,
              StatutChambre.A_NETTOYER,
              { motif: 'Ticket de maintenance résolu', userId, tx },
            );
          }
        }
      }

      return resolved;
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
