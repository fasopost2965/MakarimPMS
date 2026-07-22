import { BadRequestException, Injectable } from '@nestjs/common';
import { StatutChambre } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ParametersService } from '../parameters/parameters.service';
import { calculateNightlyTotal } from '../reservations/utils/pricing';
import { classifyOccupancy } from './utils/yield-recommendation.util';

// F3 — Revenue Manager / Yield Management (docs/modules/reporting.md §17,
// Phase 4). Module strictement read-only (INV-REP-001, comme le reste de
// reporting) : ce service ne fait que lire RoomNight/RoomType et déléguer à
// ParametersService.getSeasonRatesForRoomType() pour le prix courant (jamais
// de lecture Prisma directe de SeasonRate — CLAUDE.md, frontières de
// module) — aucune écriture, la recommandation reste une suggestion
// consultée par un humain, jamais une modification automatique de la
// grille tarifaire.
@Injectable()
export class YieldManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametersService: ParametersService,
  ) {}

  // Une date par jour du calendrier, bornes incluses — dateFin désigne ici
  // le dernier jour prévisionnel couvert par le rapport (pas une date de
  // départ exclue comme reservations/utils/nights.ts, sémantique différente
  // pour ce cas d'usage de prévision).
  private datesInRange(dateDebut: string, dateFin: string): Date[] {
    const debut = new Date(dateDebut);
    const fin = new Date(dateFin);
    if (fin < debut) {
      throw new BadRequestException(
        'dateFin doit être postérieure ou égale à dateDebut.',
      );
    }
    const dates: Date[] = [];
    for (let d = new Date(debut); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  }

  async getForecast(dateDebut: string, dateFin: string, roomTypeId?: number) {
    const dates = this.datesInRange(dateDebut, dateFin);
    const finExclusive = new Date(
      dates[dates.length - 1].getTime() + 24 * 60 * 60 * 1000,
    );

    // Taux d'Occupation Net (docs/modules/reporting.md §12) : les chambres
    // bloquées techniquement (EN_MAINTENANCE) sont soustraites du
    // dénominateur de chambres vendables, jamais comptées comme
    // "disponibles" dans une prévision d'occupation/tarif.
    const roomTypes = await this.prisma.roomType.findMany({
      where: roomTypeId ? { id: roomTypeId } : undefined,
      include: {
        rooms: {
          where: {
            deletedAt: null,
            statut: { not: StatutChambre.EN_MAINTENANCE },
          },
          select: { id: true },
        },
      },
    });

    const roomNights = await this.prisma.roomNight.findMany({
      where: {
        date: { gte: dates[0], lt: finExclusive },
        ...(roomTypeId ? { room: { roomTypeId } } : {}),
      },
      select: { date: true, room: { select: { roomTypeId: true } } },
    });

    const occupiedByKey = new Map<string, number>();
    for (const roomNight of roomNights) {
      const key = `${roomNight.room.roomTypeId}_${roomNight.date.toISOString().slice(0, 10)}`;
      occupiedByKey.set(key, (occupiedByKey.get(key) ?? 0) + 1);
    }

    const typesChambre = await Promise.all(
      roomTypes.map(async (roomType) => {
        const totalChambres = roomType.rooms.length;
        const seasonRates =
          await this.parametersService.getSeasonRatesForRoomType(roomType.id);

        const previsions = dates.map((date) => {
          const key = `${roomType.id}_${date.toISOString().slice(0, 10)}`;
          // min() : garde-fou si des chambres ont été supprimées (soft
          // delete) depuis la création de RoomNight, ne devrait jamais
          // dépasser totalChambres en fonctionnement normal.
          const chambresOccupees = Math.min(
            occupiedByKey.get(key) ?? 0,
            totalChambres,
          );
          const tauxOccupation =
            totalChambres > 0 ? (chambresOccupees / totalChambres) * 100 : 0;
          const prixActuel = calculateNightlyTotal(
            [date],
            roomType.prixBase,
            seasonRates,
          );
          const { recommandation, ajustementSuggerePct } =
            classifyOccupancy(tauxOccupation);
          const prixSuggere = prixActuel.mul(1 + ajustementSuggerePct / 100);

          return {
            date: date.toISOString().slice(0, 10),
            chambresOccupees,
            totalChambres,
            tauxOccupation: Number(tauxOccupation.toFixed(1)),
            prixActuel: prixActuel.toFixed(2),
            recommandation,
            ajustementSuggerePct,
            prixSuggere: prixSuggere.toFixed(2),
          };
        });

        const tauxOccupationMoyen =
          previsions.reduce((sum, p) => sum + p.tauxOccupation, 0) /
          previsions.length;

        return {
          roomTypeId: roomType.id,
          nom: roomType.nom,
          totalChambres,
          tauxOccupationMoyen: Number(tauxOccupationMoyen.toFixed(1)),
          previsions,
        };
      }),
    );

    return { periode: { dateDebut, dateFin }, typesChambre };
  }
}
