import { BadRequestException, Injectable } from '@nestjs/common';
import { StatutChambre, StatutSejour } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OperationalReportingService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDates(dateDebut: string, dateFin: string) {
    const debut = new Date(dateDebut);
    const finExclusive = new Date(
      new Date(dateFin).getTime() + 24 * 60 * 60 * 1000,
    );
    if (debut >= finExclusive) {
      throw new BadRequestException(
        'dateDebut doit être strictement antérieure à dateFin.',
      );
    }
    return { debut, finExclusive };
  }

  /**
   * Synthèse d'occupation & hébergement (ADR, RevPAR, Taux d'occupation Net/Brut, Arrivées/Départs)
   */
  async getOccupancySummary(dateDebut: string, dateFin: string) {
    const { debut, finExclusive } = this.parseDates(dateDebut, dateFin);

    // 1. Total chambres physiques et hors service
    const totalRooms = await this.prisma.room.count({
      where: { deletedAt: null },
    });
    const maintenanceRooms = await this.prisma.room.count({
      where: { deletedAt: null, statut: StatutChambre.EN_MAINTENANCE },
    });
    const vendibleRooms = Math.max(1, totalRooms - maintenanceRooms);

    // Calculate number of days in range
    const diffTime = Math.abs(finExclusive.getTime() - debut.getTime());
    const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const totalAvailableRoomNights = vendibleRooms * totalDays;

    // 2. RoomNights occupés sur la période
    const roomNights = await this.prisma.roomNight.findMany({
      where: { date: { gte: debut, lt: finExclusive } },
      include: {
        room: {
          select: {
            id: true,
            numero: true,
            roomTypeId: true,
            roomType: { select: { nom: true } },
          },
        },
      },
    });
    const occupiedNightsCount = roomNights.length;

    // 3. Taux d'occupation Net & Brut
    const tauxOccupationNet = Number(
      ((occupiedNightsCount / totalAvailableRoomNights) * 100).toFixed(1),
    );
    const tauxOccupationBrut = Number(
      ((occupiedNightsCount / (totalRooms * totalDays)) * 100).toFixed(1),
    );

    // 4. Revenu hébergement sur la période (FolioLines type HEBERGEMENT)
    const linesHebergement = await this.prisma.folioLine.aggregate({
      where: {
        type: 'HEBERGEMENT',
        annulee: false,
        createdAt: { gte: debut, lt: finExclusive },
      },
      _sum: { montant: true },
    });
    const caHebergement = Number(linesHebergement._sum.montant || 0);

    // 5. ADR (Prix Moyen par Chambre Occupée) = CA Hébergement / Nuitées vendues
    const adr =
      occupiedNightsCount > 0
        ? Number((caHebergement / occupiedNightsCount).toFixed(2))
        : 0;

    // 6. RevPAR = CA Hébergement / Chambres Disponibles Totales (ou TO * ADR)
    const revpar = Number(
      (caHebergement / totalAvailableRoomNights).toFixed(2),
    );

    // 7. Arrivées & Départs sur la période
    const checkinsCount = await this.prisma.stay.count({
      where: { dateCheckin: { gte: debut, lt: finExclusive }, deletedAt: null },
    });
    const checkoutsCount = await this.prisma.stay.count({
      where: {
        dateCheckoutReelle: { gte: debut, lt: finExclusive },
        deletedAt: null,
      },
    });
    const staysEnCours = await this.prisma.stay.count({
      where: { statut: StatutSejour.EN_COURS, deletedAt: null },
    });

    // 8. Répartition par canal de réservation
    const reservationsByCanal = await this.prisma.reservation.groupBy({
      by: ['canal'],
      where: { createdAt: { gte: debut, lt: finExclusive }, deletedAt: null },
      _count: true,
    });

    // 9. Répartition par Type de Chambre
    const roomTypeStats = await this.prisma.roomType.findMany({
      include: {
        rooms: { select: { id: true } },
      },
    });

    const roomTypeBreakdown = roomTypeStats.map((rt) => {
      const typeRoomIds = new Set(rt.rooms.map((r) => r.id));
      const nightsForType = roomNights.filter((rn) =>
        typeRoomIds.has(rn.roomId),
      ).length;
      return {
        roomTypeId: rt.id,
        nom: rt.nom,
        totalChambres: rt.rooms.length,
        nuiteesVendues: nightsForType,
      };
    });

    return {
      periode: { dateDebut, dateFin },
      kpis: {
        totalRooms,
        maintenanceRooms,
        vendibleRooms,
        totalDays,
        totalAvailableRoomNights,
        occupiedNightsCount,
        tauxOccupationNet,
        tauxOccupationBrut,
        caHebergement: caHebergement.toFixed(2),
        adr: adr.toFixed(2),
        revpar: revpar.toFixed(2),
        checkinsCount,
        checkoutsCount,
        staysEnCours,
      },
      canalBreakdown: reservationsByCanal.map((c) => ({
        canal: c.canal,
        count: c._count,
      })),
      roomTypeBreakdown,
    };
  }

  /**
   * Synthèse de Gouvernance & Lingerie / Consommables
   */
  async getHousekeepingSummary() {
    // 1. Répartition du statut courant des 24 chambres
    const rooms = await this.prisma.room.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        numero: true,
        statut: true,
        roomType: { select: { nom: true } },
      },
    });

    const roomStatusCounts = rooms.reduce(
      (acc, r) => {
        acc[r.statut] = (acc[r.statut] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // 2. Liste des articles de stock & Lingerie
    const stockItems = await this.prisma.stockItem.findMany({
      where: { deletedAt: null },
      orderBy: { libelle: 'asc' },
    });

    // 3. Mouvements récents de stock
    const recentMovements = await this.prisma.stockMovement.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        stockItem: true,
        user: { select: { nom: true } },
        room: { select: { numero: true } },
      },
    });

    return {
      chambresParStatut: roomStatusCounts,
      chambresTotal: rooms.length,
      chambresDetails: rooms,
      stockItems,
      recentMovements,
    };
  }

  /**
   * Synthèse Maintenance & Pannes
   */
  async getMaintenanceSummary() {
    const tickets = await this.prisma.maintenanceTicket.findMany({
      orderBy: { createdAt: 'desc' },
      include: { room: { select: { numero: true } } },
    });

    const openTickets = tickets.filter((t) => !t.resoluAt);
    const resolvedTickets = tickets.filter((t) => t.resoluAt);

    const byPriority = tickets.reduce(
      (acc, t) => {
        acc[t.priorite] = (acc[t.priorite] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const roomsInMaintenance = await this.prisma.room.findMany({
      where: { statut: StatutChambre.EN_MAINTENANCE, deletedAt: null },
      select: { id: true, numero: true, roomType: { select: { nom: true } } },
    });

    return {
      totalTickets: tickets.length,
      openTicketsCount: openTickets.length,
      resolvedTicketsCount: resolvedTickets.length,
      byPriority,
      roomsInMaintenanceCount: roomsInMaintenance.length,
      roomsInMaintenance,
      recentTickets: tickets.slice(0, 20),
    };
  }

  /**
   * Synthèse Police, Clients & Démographie
   */
  async getPoliceAndGuestStats(dateDebut: string, dateFin: string) {
    const { debut, finExclusive } = this.parseDates(dateDebut, dateFin);

    const records = await this.prisma.policeRecord.findMany({
      where: { dateArrivee: { gte: debut, lt: finExclusive } },
      include: {
        guest: {
          select: { id: true, nom: true, email: true, telephone: true },
        },
        stay: { select: { room: { select: { numero: true } } } },
      },
    });

    const nationalityMap = new Map<string, number>();
    for (const r of records) {
      const nat = r.nationalite || 'Inconnue';
      nationalityMap.set(nat, (nationalityMap.get(nat) || 0) + 1);
    }

    const nationalities = Array.from(nationalityMap.entries()).map(
      ([nationalite, count]) => ({
        nationalite,
        count,
      }),
    );

    return {
      periode: { dateDebut, dateFin },
      totalFichesPolice: records.length,
      nationalities,
      records: records.map((r) => ({
        id: r.id,
        nom: r.guest.nom,
        chambre: r.stay?.room?.numero || 'N/A',
        typePiece: r.typePiece,
        numeroPiece: r.numeroPiece,
        nationalite: r.nationalite,
        paysProvenance: r.paysProvenance,
        dateArrivee: r.dateArrivee.toISOString().slice(0, 10),
      })),
    };
  }
}
