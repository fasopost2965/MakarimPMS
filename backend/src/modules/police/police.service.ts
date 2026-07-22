import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StayService } from '../stay/stay.service';
import { ParametersService } from '../parameters/parameters.service';
import { UpsertPoliceRecordDto } from './dto/upsert-police-record.dto';
import { buildPoliceRecordPdf } from './utils/police-record.pdf';

// PoliceRecord est une table propre à ce module (pas de frontière à
// respecter pour son écriture), mais la lecture de Stay passe exclusivement
// par StayService.findOne — jamais de `prisma.stay.findUnique` direct ici
// (CLAUDE.md : un module ne lit jamais directement les tables d'un autre
// domaine).
@Injectable()
export class PoliceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly stayService: StayService,
    private readonly parametersService: ParametersService,
  ) {}

  // Créer/mettre à jour la fiche (une seule route pour les deux, la
  // contrainte @unique(stayId) rend l'opération naturellement idempotente).
  // Motif d'audit auto-généré : il s'agit d'une saisie légale obligatoire de
  // routine, pas d'une dérogation métier discrétionnaire — même logique que
  // AttendanceService.clorerShiftsOrphelins (motif système, jamais saisi par
  // un humain).
  async upsert(stayId: number, dto: UpsertPoliceRecordDto, userId?: number) {
    const stay = await this.stayService.findOne(stayId);

    const dateArrivee = dto.dateArrivee
      ? new Date(dto.dateArrivee)
      : stay.dateCheckin;
    const dateDepart = dto.dateDepart
      ? new Date(dto.dateDepart)
      : (stay.dateCheckoutReelle ?? stay.dateCheckoutPrevue);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.policeRecord.findUnique({
        where: { stayId },
      });

      const data = {
        stayId,
        guestId: stay.guestId,
        numeroPiece: dto.numeroPiece,
        typePiece: dto.typePiece,
        nationalite: dto.nationalite,
        dateNaissance: new Date(dto.dateNaissance),
        paysProvenance: dto.paysProvenance,
        villeProvenance: dto.villeProvenance,
        paysDestination: dto.paysDestination,
        villeDestination: dto.villeDestination,
        dateArrivee,
        dateDepart,
      };

      const record = await tx.policeRecord.upsert({
        where: { stayId },
        create: data,
        update: data,
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: 'CREATE_POLICE_RECORD',
        targetEntity: 'POLICE_RECORD',
        targetId: record.id,
        oldValue: existing ?? undefined,
        newValue: record,
        motif: `Enregistrement du registre légal des personnes hébergées (fiche de police), séjour ${stayId}.`,
      });

      return record;
    });
  }

  async findByStay(stayId: number) {
    const record = await this.prisma.policeRecord.findUnique({
      where: { stayId },
    });
    if (!record) {
      throw new NotFoundException(
        `Aucune fiche de police pour le séjour ${stayId}.`,
      );
    }
    return record;
  }

  // F1 — export PDF du registre légal (obligation DGSN). Lecture seule,
  // jamais d'écriture ni d'AuditLog ici (même convention que
  // reporting/police-report.service.ts : un export n'est pas une mutation).
  // stay/guest via StayService.findOne (façade, jamais Prisma direct sur
  // Stay) ; hotelConfig via ParametersService.getHotelConfig (façade,
  // jamais Prisma direct sur HotelConfig).
  async generatePdf(stayId: number): Promise<Buffer> {
    const [record, stay, hotelConfig] = await Promise.all([
      this.findByStay(stayId),
      this.stayService.findOne(stayId),
      this.parametersService.getHotelConfig(),
    ]);

    return buildPoliceRecordPdf({
      hotel: {
        raisonSociale: hotelConfig.raisonSociale,
        adresse: hotelConfig.adresse,
        ice: hotelConfig.ice,
        identifiantFiscal: hotelConfig.identifiantFiscal,
        rc: hotelConfig.rc,
        categorieEtoiles: hotelConfig.categorieEtoiles,
      },
      guest: {
        nom: stay.guest.nom,
        prenom: stay.guest.prenom,
        telephone: stay.guest.telephone,
        email: stay.guest.email,
      },
      stay: {
        id: stay.id,
        roomNumero: stay.room.numero,
        roomTypeNom: stay.room.roomType.nom,
      },
      record: {
        numeroPiece: record.numeroPiece,
        typePiece: record.typePiece,
        nationalite: record.nationalite,
        dateNaissance: record.dateNaissance,
        paysProvenance: record.paysProvenance,
        villeProvenance: record.villeProvenance,
        paysDestination: record.paysDestination,
        villeDestination: record.villeDestination,
        dateArrivee: record.dateArrivee,
        dateDepart: record.dateDepart,
      },
    });
  }
}
