import { ConflictException, Injectable } from '@nestjs/common';
import { StatutChambre } from '@prisma/client';
import { getTodayRange } from '../../common/utils/date-range';
import { RoomsService } from '../rooms/rooms.service';
import { ReservationsService } from '../reservations/reservations.service';
import { CheckinService } from '../checkin/checkin.service';

@Injectable()
export class HousekeepingService {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly reservationsService: ReservationsService,
    private readonly checkinService: CheckinService,
  ) {}

  async findAllRooms() {
    await this.reconcileDailyStatuses();
    return this.roomsService.findAllWithType();
  }

  // Point de vigilance non négociable : une chambre OCCUPEE ou DEPART_PREVU
  // (un séjour y est toujours en cours dans les deux cas) ne doit jamais
  // pouvoir être modifiée par un changement manuel — seul le check-out
  // (événement checkout.effectue, voir CheckinService) en sort, car c'est lui
  // qui libère aussi le verrou RoomNight sous-jacent.
  async updateStatus(id: number, statut: StatutChambre, userId?: number) {
    const room = await this.roomsService.findByIdOrThrow(id);

    if (
      room.statut === StatutChambre.OCCUPEE ||
      room.statut === StatutChambre.DEPART_PREVU
    ) {
      throw new ConflictException(
        'Chambre occupée ou en départ prévu : le statut ne peut être changé que via le check-out (module checkin).',
      );
    }

    return this.roomsService.transitionRoom(id, statut, {
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
  //
  // Dérogation documentée à docs/modules/housekeeping.md §11 (qui interdit
  // toute dépendance à `reservations`) : en l'absence de toute
  // infrastructure de cron dans ce projet, ce rattrapage ne peut s'exécuter
  // qu'à la lecture, ce qui exige de connaître les réservations/séjours du
  // jour. L'accès se fait exclusivement via les façades en lecture seule
  // ci-dessous (jamais de lecture Prisma directe des tables Reservation/
  // Stay) — voir CLAUDE.md.
  private async reconcileDailyStatuses() {
    const { today, tomorrow } = getTodayRange();
    const rooms = await this.roomsService.findAllWithType();

    for (const room of rooms) {
      if (room.statut === StatutChambre.LIBRE_PROPRE) {
        const arrivingToday =
          await this.reservationsService.findConfirmedArrivingToday(room.id, {
            today,
            tomorrow,
          });
        if (arrivingToday) {
          await this.roomsService.transitionRoom(
            room.id,
            StatutChambre.RESERVEE,
            { motif: "Calculé automatiquement — arrivée prévue aujourd'hui" },
          );
        }
      } else if (room.statut === StatutChambre.RESERVEE) {
        const arrivingToday =
          await this.reservationsService.findConfirmedArrivingToday(room.id, {
            today,
            tomorrow,
          });
        if (!arrivingToday) {
          await this.roomsService.transitionRoom(
            room.id,
            StatutChambre.LIBRE_PROPRE,
            {
              motif:
                "Calculé automatiquement — plus de réservation arrivant aujourd'hui",
            },
          );
        }
      } else if (room.statut === StatutChambre.OCCUPEE) {
        const activeStay = await this.checkinService.findActiveStayForRoom(
          room.id,
        );
        if (
          activeStay &&
          activeStay.dateCheckoutPrevue >= today &&
          activeStay.dateCheckoutPrevue < tomorrow
        ) {
          await this.roomsService.transitionRoom(
            room.id,
            StatutChambre.DEPART_PREVU,
            { motif: "Calculé automatiquement — départ prévu aujourd'hui" },
          );
        }
      } else if (room.statut === StatutChambre.DEPART_PREVU) {
        const activeStay = await this.checkinService.findActiveStayForRoom(
          room.id,
        );
        const stillToday =
          activeStay !== null &&
          activeStay.dateCheckoutPrevue >= today &&
          activeStay.dateCheckoutPrevue < tomorrow;
        if (!stillToday) {
          await this.roomsService.transitionRoom(
            room.id,
            StatutChambre.OCCUPEE,
            { motif: 'Calculé automatiquement — départ reporté' },
          );
        }
      }
    }
  }
}
