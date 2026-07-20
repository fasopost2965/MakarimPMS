import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StatutChambre,
  StatutReservation,
  StatutSejour,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTodayRange } from '../../common/utils/date-range';
import { canTransition } from './utils/room-transitions';

interface TransitionOptions {
  motif?: string;
  userId?: number;
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class HousekeepingService {
  constructor(private readonly prisma: PrismaService) {}

  // Seul chemin d'écriture de Room.statut dans toute l'application (cahier
  // des charges §5.6 Phase 2). Valide la transition contre ROOM_TRANSITIONS
  // et journalise systématiquement dans RoomStatusLog (CLAUDE.md règle 4).
  // Accepte un client de transaction optionnel pour composer avec les
  // transactions d'autres modules (ex. check-in : la chambre passe OCCUPEE
  // atomiquement avec la création du Stay).
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

  async findAllRooms() {
    await this.reconcileDailyStatuses();
    return this.prisma.room.findMany({
      include: { roomType: true },
      orderBy: { numero: 'asc' },
    });
  }

  // Point de vigilance non négociable : une chambre OCCUPEE ou DEPART_PREVU
  // (un séjour y est toujours en cours dans les deux cas) ne doit jamais
  // pouvoir être modifiée par un changement manuel — seul le check-out
  // (événement checkout.effectue, voir CheckinService) en sort, car c'est lui
  // qui libère aussi le verrou RoomNight sous-jacent.
  async updateStatus(id: number, statut: StatutChambre, userId?: number) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) {
      throw new NotFoundException(`Chambre ${id} introuvable.`);
    }

    if (
      room.statut === StatutChambre.OCCUPEE ||
      room.statut === StatutChambre.DEPART_PREVU
    ) {
      throw new ConflictException(
        'Chambre occupée ou en départ prévu : le statut ne peut être changé que via le check-out (module checkin).',
      );
    }

    return this.transitionRoom(id, statut, {
      motif: 'Changement manuel',
      userId,
    });
  }

  // Rattrapage à la lecture des statuts "relatifs à aujourd'hui" (RESERVEE,
  // DEPART_PREVU) — pas de tâche planifiée dans ce projet, donc recalculé à
  // chaque consultation de la liste des chambres, dans les deux sens (avance
  // si la situation le justifie désormais, revient en arrière si elle ne le
  // justifie plus). Idempotent : aucune écriture si le statut calculé est
  // déjà le statut courant. Les autres statuts (A_NETTOYER, EN_NETTOYAGE,
  // EN_MAINTENANCE) sont pilotés par une action humaine ou le check-out —
  // jamais touchés ici.
  private async reconcileDailyStatuses() {
    const { today, tomorrow } = getTodayRange();
    const rooms = await this.prisma.room.findMany();

    for (const room of rooms) {
      if (room.statut === StatutChambre.LIBRE_PROPRE) {
        const arrivingToday = await this.prisma.reservation.findFirst({
          where: {
            roomId: room.id,
            statut: StatutReservation.CONFIRMEE,
            dateArrivee: { gte: today, lt: tomorrow },
          },
        });
        if (arrivingToday) {
          await this.transitionRoom(room.id, StatutChambre.RESERVEE, {
            motif: "Calculé automatiquement — arrivée prévue aujourd'hui",
          });
        }
      } else if (room.statut === StatutChambre.RESERVEE) {
        const arrivingToday = await this.prisma.reservation.findFirst({
          where: {
            roomId: room.id,
            statut: StatutReservation.CONFIRMEE,
            dateArrivee: { gte: today, lt: tomorrow },
          },
        });
        if (!arrivingToday) {
          await this.transitionRoom(room.id, StatutChambre.LIBRE_PROPRE, {
            motif:
              "Calculé automatiquement — plus de réservation arrivant aujourd'hui",
          });
        }
      } else if (room.statut === StatutChambre.OCCUPEE) {
        const activeStay = await this.prisma.stay.findFirst({
          where: { roomId: room.id, statut: StatutSejour.EN_COURS },
        });
        if (
          activeStay &&
          activeStay.dateCheckoutPrevue >= today &&
          activeStay.dateCheckoutPrevue < tomorrow
        ) {
          await this.transitionRoom(room.id, StatutChambre.DEPART_PREVU, {
            motif: "Calculé automatiquement — départ prévu aujourd'hui",
          });
        }
      } else if (room.statut === StatutChambre.DEPART_PREVU) {
        const activeStay = await this.prisma.stay.findFirst({
          where: { roomId: room.id, statut: StatutSejour.EN_COURS },
        });
        const stillToday =
          activeStay !== null &&
          activeStay.dateCheckoutPrevue >= today &&
          activeStay.dateCheckoutPrevue < tomorrow;
        if (!stillToday) {
          await this.transitionRoom(room.id, StatutChambre.OCCUPEE, {
            motif: 'Calculé automatiquement — départ reporté',
          });
        }
      }
    }
  }
}
