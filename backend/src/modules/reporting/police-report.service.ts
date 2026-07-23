import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { toCsv } from './utils/csv.util';

// BR-CLI-003 (enregistrement obligatoire des pièces d'identité) : ce
// service compile les arrivées d'une journée (date de check-in) pour la
// déclaration réglementaire marocaine. Lecture seule (INV-REP-001).
//
// CH-004 (docs/governance/REGISTRE_CHANTIERS.md) : Guest.pieceIdentite est
// chiffré au repos (AES-256-GCM). Ce service ne fait rien de spécial pour
// autant — le déchiffrement est transparent (extension Prisma sur le modèle
// Guest, y compris via `include: { guest: true }` comme ci-dessous) ; le
// champ arrive déjà en clair ici.
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

  private plageDates(dateDebut: string, dateFin: string) {
    const debut = new Date(dateDebut);
    const finExclusive = new Date(
      new Date(dateFin).getTime() + 24 * 60 * 60 * 1000,
    );
    if (Number.isNaN(debut.getTime()) || Number.isNaN(finExclusive.getTime())) {
      throw new BadRequestException(
        `Plage de dates invalide : "${dateDebut}" → "${dateFin}".`,
      );
    }
    if (debut >= finExclusive) {
      throw new BadRequestException(
        'dateDebut doit être strictement antérieure à dateFin.',
      );
    }
    return { debut, finExclusive };
  }

  // Registre légal complet (PoliceRecord, obligation DGSN) sur une plage de
  // dates d'arrivée — distinct de getDailyReport (arrivées d'une seule
  // journée, dérivées de Stay/Guest tant qu'aucune fiche n'a été saisie).
  async findRegister(dateDebut: string, dateFin: string) {
    const { debut, finExclusive } = this.plageDates(dateDebut, dateFin);

    return this.prisma.policeRecord.findMany({
      where: { dateArrivee: { gte: debut, lt: finExclusive } },
      include: { guest: true, stay: { include: { room: true } } },
      orderBy: { dateArrivee: 'asc' },
    });
  }

  async exportRegisterCsv(dateDebut: string, dateFin: string): Promise<string> {
    const fiches = await this.findRegister(dateDebut, dateFin);

    return toCsv(
      [
        'nom',
        'prenom',
        'numeroPiece',
        'typePiece',
        'nationalite',
        'dateNaissance',
        'paysProvenance',
        'villeProvenance',
        'paysDestination',
        'villeDestination',
        'chambre',
        'dateArrivee',
        'dateDepart',
      ],
      fiches.map((f) => [
        f.guest.nom,
        f.guest.prenom,
        f.numeroPiece,
        f.typePiece,
        f.nationalite,
        f.dateNaissance.toISOString().slice(0, 10),
        f.paysProvenance ?? '',
        f.villeProvenance ?? '',
        f.paysDestination ?? '',
        f.villeDestination ?? '',
        f.stay.room.numero,
        f.dateArrivee.toISOString(),
        f.dateDepart ? f.dateDepart.toISOString() : '',
      ]),
    );
  }
}
