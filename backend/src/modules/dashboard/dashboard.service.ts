import { Injectable } from '@nestjs/common';
import {
  Prisma,
  StatutChambre,
  StatutReservation,
  StatutSejour,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTodayRange } from '../../common/utils/date-range';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // Vue d'ensemble simple (cahier des charges §5.3, Phase 1) : une seule
  // requête agrégée par carte de synthèse. Réutilise getTodayRange() —
  // même logique de "journée" que reservations.arrivalsToday() et
  // checkin.departsToday() — pour ne pas réintroduire le bug UTC/local déjà
  // corrigé au module 5.4.
  async resume() {
    const { today, tomorrow } = getTodayRange();

    const [
      totalRooms,
      occupiedRooms,
      arriveesAujourdhui,
      departsAujourdhui,
      chambresANettoyer,
      paiementsAujourdhui,
    ] = await Promise.all([
      this.prisma.room.count(),
      this.prisma.room.count({ where: { statut: StatutChambre.OCCUPEE } }),
      this.prisma.reservation.count({
        where: {
          dateArrivee: { gte: today, lt: tomorrow },
          statut: StatutReservation.CONFIRMEE,
        },
      }),
      this.prisma.stay.count({
        where: {
          statut: StatutSejour.EN_COURS,
          dateCheckoutPrevue: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.room.count({
        where: { statut: StatutChambre.A_NETTOYER },
      }),
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: today, lt: tomorrow } },
        _sum: { montant: true },
      }),
    ]);

    const tauxOccupation =
      totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    return {
      tauxOccupation: Number(tauxOccupation.toFixed(1)),
      chambresOccupees: occupiedRooms,
      totalChambres: totalRooms,
      arriveesAujourdhui,
      departsAujourdhui,
      chambresANettoyer,
      encaisseAujourdhui: (
        paiementsAujourdhui._sum.montant ?? new Prisma.Decimal(0)
      ).toFixed(2),
    };
  }
}
