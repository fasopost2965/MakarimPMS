import { ConflictException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StatutChambre } from '@prisma/client';
import { getTodayRange } from '../../common/utils/date-range';
import { RoomsService } from '../rooms/rooms.service';
import { ReservationsService } from '../reservations/reservations.service';
import { StayService } from '../stay/stay.service';
import { NettoyageValideEvent } from './events/nettoyage-valide.event';

const STATUTS_A_NETTOYER: StatutChambre[] = [
  StatutChambre.A_NETTOYER,
  StatutChambre.EN_NETTOYAGE,
];

@Injectable()
export class HousekeepingService {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly reservationsService: ReservationsService,
    private readonly stayService: StayService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAllRooms() {
    await this.reconcileDailyStatuses();
    return this.roomsService.findAllWithType();
  }

  // CH-014 — façade de lecture seule vers RoomStatusLog (propriété exclusive
  // de RoomsService) : le contrôleur HTTP reste sur HousekeepingController
  // (écart documenté CLAUDE.md — pas de rooms:read dédié tant qu'aucune
  // route de configuration de chambre n'existe), donc cette route passe par
  // le même service que GET /rooms et PATCH /rooms/:id/statut.
  findStatusHistory(roomId: number) {
    return this.roomsService.findStatusHistory(roomId);
  }

  // Point de vigilance non négociable : une chambre OCCUPEE ou DEPART_PREVU
  // (un séjour y est toujours en cours dans les deux cas) ne doit jamais
  // pouvoir être modifiée par un changement manuel — seul le check-out
  // (événement checkout.effectue, voir StayService) en sort, car c'est lui
  // qui libère aussi le verrou RoomNight sous-jacent.
  //
  // commentaire (F9, app mobile housekeeping) : remplace le motif générique
  // "Changement manuel" quand fourni — MobileHousekeepingController est le
  // seul appelant à le passer aujourd'hui, mais c'est le même chemin
  // d'écriture unique que le PATCH desktop (HousekeepingController), jamais
  // un second point d'écriture pour Room.statut (CLAUDE.md).
  async updateStatus(
    id: number,
    statut: StatutChambre,
    userId?: number,
    commentaire?: string,
  ) {
    const room = await this.roomsService.findByIdOrThrow(id);

    if (
      room.statut === StatutChambre.OCCUPEE ||
      room.statut === StatutChambre.DEPART_PREVU
    ) {
      throw new ConflictException(
        'Chambre occupée ou en départ prévu : le statut ne peut être changé que via le check-out (module checkin).',
      );
    }

    const updated = await this.roomsService.transitionRoom(id, statut, {
      motif: commentaire ?? 'Changement manuel',
      userId,
    });

    // BR-STK-001 : équivalent de la validation "CONTROLEE" côté stock (voir
    // NettoyageValideEvent). emit() volontairement non attendu (pas
    // emitAsync) : SPRINT_12.md §5 exige que le décompte de consommables
    // reste isolé et ne bloque/ralentisse jamais la réponse de l'API de
    // ménage principale, y compris en cas d'indisponibilité du module stock.
    if (
      statut === StatutChambre.LIBRE_PROPRE &&
      STATUTS_A_NETTOYER.includes(room.statut)
    ) {
      this.eventEmitter.emit(
        'nettoyage.valide',
        new NettoyageValideEvent(id, updated.roomType.capacite, userId),
      );
    }

    return updated;
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
        const activeStay = await this.stayService.findActiveStayForRoom(
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
        const activeStay = await this.stayService.findActiveStayForRoom(
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
