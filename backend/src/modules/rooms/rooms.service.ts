import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatutChambre } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { canTransition } from './utils/room-transitions';

interface TransitionOptions {
  motif?: string;
  userId?: number;
  tx?: Prisma.TransactionClient;
}

// Propriétaire exclusif de Room/RoomType/RoomStatusLog (docs/modules/rooms.md
// §2/§4). Seul point d'écriture de Room.statut dans toute l'application —
// housekeeping, stay et maintenance délèguent tous à transitionRoom()
// plutôt que d'écrire Room.statut eux-mêmes (CLAUDE.md règle « un seul
// chemin d'écriture par champ sensible »).
@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async transitionRoom(
    roomId: number,
    to: StatutChambre,
    opts: TransitionOptions = {},
  ) {
    const client = opts.tx ?? this.prisma;

    const room = await client.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException(`Chambre ${roomId} introuvable.`);
    }

    if (!canTransition(room.statut, to)) {
      throw new ConflictException(
        `Transition de statut invalide : ${room.statut} → ${to}.`,
      );
    }

    const updated = await client.room.update({
      where: { id: roomId },
      data: { statut: to },
      include: { roomType: true },
    });

    await client.roomStatusLog.create({
      data: {
        roomId,
        ancienStatut: room.statut,
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
}
