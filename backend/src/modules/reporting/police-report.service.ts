import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toCsv } from './utils/csv.util';

// BR-CLI-003 (enregistrement obligatoire des pièces d'identité) : ce
// service compile les arrivées d'une journée (date de check-in) pour la
// déclaration réglementaire marocaine. Lecture seule (INV-REP-001).
//
// Point de vigilance non résolu (voir SPRINT_13.md §6) : Guest.pieceIdentite
// est actuellement stocké en clair — aucun chiffrement au repos n'existe
// dans ce code base (GO_LIVE_CHECKLIST.md réclame un ENCRYPTION_KEY jamais
// implémenté). Ce service lit le champ tel qu'il existe ; le chiffrement
// est un chantier de sécurité séparé, pas construit ici.
@Injectable()
export class PoliceReportService {
  constructor(private readonly prisma: PrismaService) {}

  private journeeDate(date: string) {
    const debut = new Date(date);
    if (Number.isNaN(debut.getTime())) {
      throw new BadRequestException(`Date invalide : "${date}".`);
    }
    const finExclusive = new Date(debut.getTime() + 24 * 60 * 60 * 1000);
    return { debut, finExclusive };
  }

  async getDailyReport(date: string) {
    const { debut, finExclusive } = this.journeeDate(date);

    return this.prisma.stay.findMany({
      where: {
        deletedAt: null,
        dateCheckin: { gte: debut, lt: finExclusive },
      },
      include: {
        guest: true,
        room: true,
      },
      orderBy: { dateCheckin: 'asc' },
    });
  }

  async exportDailyReportCsv(date: string): Promise<string> {
    const arrivees = await this.getDailyReport(date);

    return toCsv(
      [
        'nom',
        'prenom',
        'nationalite',
        'pieceIdentite',
        'chambre',
        'dateArrivee',
        'dateDepartPrevue',
      ],
      arrivees.map((stay) => [
        stay.guest.nom,
        stay.guest.prenom,
        stay.guest.nationalite ?? '',
        stay.guest.pieceIdentite ?? '',
        stay.room.numero,
        stay.dateCheckin.toISOString(),
        stay.dateCheckoutPrevue.toISOString().slice(0, 10),
      ]),
    );
  }
}
