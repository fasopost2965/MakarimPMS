import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  Prisma,
  Room,
  StatutChambre,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { getTodayRange } from '../../common/utils/date-range';
import { canTransition } from './utils/room-transitions';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { DeleteRoomDto } from './dto/delete-room.dto';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';

interface TransitionOptions {
  expectedFrom: StatutChambre;
  motif?: string;
  userId?: number;
  tx?: Prisma.TransactionClient;
}

// Statuts pour lesquels une chambre est engagée dans un cycle d'occupation
// en cours — RD-024/CH-038 : suppression (soft delete) refusée tant que la
// chambre est dans l'un de ces états, même logique que "jamais de
// suppression physique d'un actif référencé" (docs/modules/rooms.md §18).
const STATUTS_OCCUPATION_ACTIVE: StatutChambre[] = [
  StatutChambre.RESERVEE,
  StatutChambre.OCCUPEE,
  StatutChambre.DEPART_PREVU,
];

// Propriétaire exclusif de Room/RoomType/RoomStatusLog (docs/modules/rooms.md
// §2/§4). Seul point d'écriture de Room.statut dans toute l'application —
// housekeeping, stay et maintenance délèguent tous à transitionRoom()
// plutôt que d'écrire Room.statut eux-mêmes (CLAUDE.md règle « un seul
// chemin d'écriture par champ sensible »).
@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async transitionRoom(
    roomId: number,
    to: StatutChambre,
    opts: TransitionOptions,
  ) {
    if (opts.tx) {
      return this.transitionRoomInTransaction(roomId, to, opts, opts.tx);
    }

    return this.prisma.$transaction((tx) =>
      this.transitionRoomInTransaction(roomId, to, opts, tx),
    );
  }

  private async transitionRoomInTransaction(
    roomId: number,
    to: StatutChambre,
    opts: TransitionOptions,
    tx: Prisma.TransactionClient,
  ) {
    const room = await this.lockRoomForUpdate(roomId, tx);

    if (room.statut !== opts.expectedFrom) {
      throw new ConflictException(
        `Conflit concurrent sur la chambre ${roomId} : statut attendu ${opts.expectedFrom}, statut actuel ${room.statut}.`,
      );
    }

    if (!canTransition(opts.expectedFrom, to)) {
      throw new ConflictException(
        `Transition de statut invalide : ${opts.expectedFrom} → ${to}.`,
      );
    }

    const write = await tx.room.updateMany({
      where: { id: roomId, statut: opts.expectedFrom },
      data: { statut: to },
    });
    if (write.count !== 1) {
      throw new ConflictException(
        `Conflit concurrent sur la chambre ${roomId} : le statut ${opts.expectedFrom} n'est plus courant.`,
      );
    }

    const updated = await tx.room.findUnique({
      where: { id: roomId },
      include: { roomType: true },
    });
    if (!updated) {
      throw new NotFoundException(`Chambre ${roomId} introuvable.`);
    }

    await tx.roomStatusLog.create({
      data: {
        roomId,
        ancienStatut: opts.expectedFrom,
        nouveauStatut: to,
        motif: opts.motif,
        userId: opts.userId,
      },
    });

    return updated;
  }

  async findAllWithType(tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.room.findMany({
      include: { roomType: true },
      orderBy: { numero: 'asc' },
    });
  }

  async findById(id: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.room.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: number, tx?: Prisma.TransactionClient) {
    const room = await this.findById(id, tx);
    if (!room) {
      throw new NotFoundException(`Chambre ${id} introuvable.`);
    }
    return room;
  }

  // Variante avec tarification incluse (RoomType + SeasonRate), pour le
  // calcul de prix walk-in (StayService.checkinWalkIn) — seul appelant à
  // avoir besoin de ce niveau d'inclusion.
  async findByIdWithPricing(id: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    const room = await client.room.findUnique({
      where: { id },
      include: { roomType: { include: { seasonRates: true } } },
    });
    if (!room) {
      throw new NotFoundException(`Chambre ${id} introuvable.`);
    }
    return room;
  }

  // CH-014 (docs/governance/REGISTRE_CHANTIERS.md) — RoomStatusLog était
  // peuplé à chaque transitionRoom() mais jamais lu par aucune route.
  // Lecture seule, RoomsService reste l'unique propriétaire de cette table.
  async findStatusHistory(roomId: number, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    await this.findByIdOrThrow(roomId, tx);
    return client.roomStatusLog.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- CRUD de configuration (CH-038, RD-024) ------------------------------
  // Inventaire configurable : l'hôtel démarre avec 24 chambres mais doit
  // pouvoir en ajouter à l'avenir (nouvelle suite, étage supplémentaire)
  // sans procédure hors-PMS (docs/modules/rooms.md §12). Réservé à
  // rooms:write (Administrateur), même rigueur que parameters:write : motif
  // écrit (≥10 caractères) + audit dans la même transaction (ADR-005).

  async createRoom(dto: CreateRoomDto, userId?: number) {
    const roomType = await this.prisma.roomType.findUnique({
      where: { id: dto.roomTypeId },
    });
    if (!roomType) {
      throw new NotFoundException(
        `Type de chambre ${dto.roomTypeId} introuvable.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: {
          numero: dto.numero,
          roomTypeId: dto.roomTypeId,
          etage: dto.etage,
        },
        include: { roomType: true },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CREATE_ROOM,
        targetEntity: AuditEntity.Room,
        targetId: created.id,
        newValue: {
          numero: created.numero,
          roomTypeId: created.roomTypeId,
          etage: created.etage,
        },
        motif: dto.motif,
      });

      return created;
    });
  }

  async updateRoom(id: number, dto: UpdateRoomDto, userId?: number) {
    const existing = await this.findByIdOrThrow(id);
    const { motif, ...fields } = dto;

    if (fields.roomTypeId !== undefined) {
      const roomType = await this.prisma.roomType.findUnique({
        where: { id: fields.roomTypeId },
      });
      if (!roomType) {
        throw new NotFoundException(
          `Type de chambre ${fields.roomTypeId} introuvable.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.room.update({
        where: { id },
        data: fields,
        include: { roomType: true },
      });

      const oldValue: Record<string, string | number | null> = {};
      const newValue: Record<string, string | number | null> = {};
      for (const key of Object.keys(fields) as Array<keyof typeof fields>) {
        if (fields[key] !== undefined) {
          oldValue[key] = existing[key];
          newValue[key] = fields[key];
        }
      }

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.UPDATE_ROOM,
        targetEntity: AuditEntity.Room,
        targetId: id,
        oldValue,
        newValue,
        motif,
      });

      return updated;
    });
  }

  // Soft delete uniquement (ADR-005, jamais de suppression physique).
  // Refusé si la chambre est engagée dans un cycle d'occupation en cours
  // (statut RESERVEE/OCCUPEE/DEPART_PREVU) ou porte une nuitée future
  // verrouillée (RoomNight, réservation confirmée à venir même si la
  // chambre est momentanément LIBRE_PROPRE entre deux séjours).
  async deleteRoom(id: number, dto: DeleteRoomDto, userId?: number) {
    const existing = await this.findByIdOrThrow(id);

    if (STATUTS_OCCUPATION_ACTIVE.includes(existing.statut)) {
      throw new ConflictException(
        `Impossible de supprimer la chambre ${existing.numero} : statut actuel ${existing.statut}, encore engagée dans un cycle d'occupation.`,
      );
    }

    const { today } = getTodayRange();
    const futureNight = await this.prisma.roomNight.findFirst({
      where: { roomId: id, date: { gte: today } },
    });
    if (futureNight) {
      throw new ConflictException(
        `Impossible de supprimer la chambre ${existing.numero} : une nuitée future est déjà verrouillée dessus.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.room.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.DELETE_ROOM,
        targetEntity: AuditEntity.Room,
        targetId: id,
        oldValue: { deletedAt: null },
        newValue: { deletedAt: deleted.deletedAt?.toISOString() ?? null },
        motif: dto.motif,
      });

      return deleted;
    });
  }

  async findAllRoomTypes() {
    return this.prisma.roomType.findMany({ orderBy: { nom: 'asc' } });
  }

  async findRoomTypeByIdOrThrow(id: number) {
    const roomType = await this.prisma.roomType.findUnique({ where: { id } });
    if (!roomType) {
      throw new NotFoundException(`Type de chambre ${id} introuvable.`);
    }
    return roomType;
  }

  async createRoomType(dto: CreateRoomTypeDto, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.roomType.create({
        data: {
          nom: dto.nom,
          prixBase: new Prisma.Decimal(dto.prixBase),
          capacite: dto.capacite,
          prixPetitDejeuner: dto.prixPetitDejeuner
            ? new Prisma.Decimal(dto.prixPetitDejeuner)
            : undefined,
          prixDemiPension: dto.prixDemiPension
            ? new Prisma.Decimal(dto.prixDemiPension)
            : undefined,
          prixPensionComplete: dto.prixPensionComplete
            ? new Prisma.Decimal(dto.prixPensionComplete)
            : undefined,
        },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CREATE_ROOM_TYPE,
        targetEntity: AuditEntity.RoomType,
        targetId: created.id,
        newValue: { nom: created.nom, prixBase: created.prixBase.toString() },
        motif: dto.motif,
      });

      return created;
    });
  }

  // Pas de suppression de RoomType dans cette itération (dette technique
  // documentée, docs/modules/rooms.md §16) : une catégorie peut être
  // référencée par des chambres/tarifs saisonniers/restrictions existants,
  // suppression jugée plus risquée et non demandée dans l'immédiat.
  async updateRoomType(id: number, dto: UpdateRoomTypeDto, userId?: number) {
    const existing = await this.findRoomTypeByIdOrThrow(id);
    const { motif, ...fields } = dto;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.roomType.update({
        where: { id },
        data: {
          nom: fields.nom,
          prixBase:
            fields.prixBase !== undefined
              ? new Prisma.Decimal(fields.prixBase)
              : undefined,
          capacite: fields.capacite,
          prixPetitDejeuner:
            fields.prixPetitDejeuner !== undefined
              ? new Prisma.Decimal(fields.prixPetitDejeuner)
              : undefined,
          prixDemiPension:
            fields.prixDemiPension !== undefined
              ? new Prisma.Decimal(fields.prixDemiPension)
              : undefined,
          prixPensionComplete:
            fields.prixPensionComplete !== undefined
              ? new Prisma.Decimal(fields.prixPensionComplete)
              : undefined,
        },
      });

      const oldValue: Record<string, string | number | null> = {};
      const newValue: Record<string, string | number | null> = {};
      if (fields.nom !== undefined) {
        oldValue.nom = existing.nom;
        newValue.nom = fields.nom;
      }
      if (fields.prixBase !== undefined) {
        oldValue.prixBase = existing.prixBase.toString();
        newValue.prixBase = fields.prixBase;
      }
      if (fields.capacite !== undefined) {
        oldValue.capacite = existing.capacite;
        newValue.capacite = fields.capacite;
      }

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.UPDATE_ROOM_TYPE,
        targetEntity: AuditEntity.RoomType,
        targetId: id,
        oldValue,
        newValue,
        motif,
      });

      return updated;
    });
  }

  // GL-003 — façade de recherche d'alternatives pour la prolongation de
  // séjour (StayService.extendStay), quand la chambre actuelle n'est pas
  // disponible sur les nuits ajoutées. Deux niveaux de compatibilité :
  // 1) même RoomType que la chambre actuelle, 2) tout autre RoomType au
  // moins aussi cher/aussi grand — jamais une catégorie moins chère.
  // Ne lit que Room/RoomType/RoomNight en Prisma direct (RoomsModule reste
  // un module feuille, même convention que les autres méthodes de lecture
  // ci-dessus).
  async findCompatibleAvailableRooms(
    currentRoomTypeId: number,
    nights: Date[],
    excludeRoomId: number,
    tx: Prisma.TransactionClient,
  ): Promise<Array<Room & { roomType: Prisma.RoomTypeGetPayload<object> }>> {
    const currentRoomType = await tx.roomType.findUnique({
      where: { id: currentRoomTypeId },
    });
    if (!currentRoomType) {
      throw new NotFoundException(
        `Type de chambre ${currentRoomTypeId} introuvable.`,
      );
    }

    // Chambres candidates : même RoomType, OU tout RoomType au moins aussi
    // cher/aussi grand (jamais une catégorie moins chère — CLAUDE.md,
    // instructions GL-003). Ne garder que LIBRE_PROPRE, hors chambre
    // actuelle.
    const candidates = await tx.room.findMany({
      where: {
        id: { not: excludeRoomId },
        statut: StatutChambre.LIBRE_PROPRE,
        deletedAt: null,
        OR: [
          { roomTypeId: currentRoomTypeId },
          {
            roomType: {
              capacite: { gte: currentRoomType.capacite },
              prixBase: { gte: currentRoomType.prixBase },
            },
          },
        ],
      },
      include: { roomType: true },
      orderBy: [{ roomType: { prixBase: 'asc' } }, { id: 'asc' }],
    });

    if (candidates.length === 0 || nights.length === 0) {
      return candidates;
    }

    // Exclure toute chambre ayant une RoomNight sur l'une des dates
    // demandées, quelle que soit l'origine (réservation OU séjour, jamais de
    // filtre reservationId != null — même correction que GL-002).
    const conflictingNights = await tx.roomNight.findMany({
      where: {
        roomId: { in: candidates.map((room) => room.id) },
        date: { in: nights },
      },
      select: { roomId: true },
    });
    const unavailableRoomIds = new Set(conflictingNights.map((n) => n.roomId));

    return candidates.filter((room) => !unavailableRoomIds.has(room.id));
  }

  async lockRoomForUpdate(
    roomId: number,
    tx: Prisma.TransactionClient,
  ): Promise<Room> {
    const rooms = await tx.$queryRaw<Room[]>`
      SELECT id, numero, roomTypeId, statut, etage, deletedAt 
      FROM Room 
      WHERE id = ${roomId} 
      FOR UPDATE
    `;
    if (!rooms || rooms.length === 0) {
      throw new NotFoundException(`Chambre ${roomId} introuvable.`);
    }
    return rooms[0];
  }
}
