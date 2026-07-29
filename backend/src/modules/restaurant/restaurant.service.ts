import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditAction,
  AuditEntity,
  StatutSejour,
  TypeLigneFolio,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StayService } from '../stay/stay.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import { CreateRestaurantChargeDto } from './dto/create-restaurant-charge.dto';
import { UpdateRestaurantChargeDto } from './dto/update-restaurant-charge.dto';
import { RestaurantChargeAjouteeEvent } from './events/restaurant-charge-ajoutee.event';

export interface RestaurantStayInHouse {
  stayId: number;
  roomNumber: string;
  guestName: string;
  checkoutDate: Date;
}

// F11 (CH-056, RD-025) — intercepte le flux papier « le restaurant envoie
// un ticket à la réception » : un compte RESTAURATEUR saisit directement la
// note, sans validation réception intermédiaire (RD-F11-01). Dépendances
// autorisées uniquement : StayModule (façade lecture, séjours EN_COURS),
// BillingModule (façade écriture, FolioLine RESTAURANT), AuditModule,
// EventEmitter2 — jamais de table Prisma propre.
@Injectable()
export class RestaurantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stayService: StayService,
    private readonly billingService: BillingService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Projection stricte — jamais de solde/folio/donnée financière (le
  // compte RESTAURATEUR n'a pas à voir ce que le client doit déjà à
  // l'hôtel, seulement où l'ajouter). StayService.findEnCours() renvoie
  // l'objet Stay complet (guest/room/folios) : le filtrage a lieu ici,
  // jamais en laissant fuiter le résultat brut vers l'appelant HTTP.
  async findStaysInHouse(): Promise<RestaurantStayInHouse[]> {
    const stays = await this.stayService.findEnCours();
    return stays.map((stay) => ({
      stayId: stay.id,
      roomNumber: stay.room.numero,
      guestName: `${stay.guest.prenom} ${stay.guest.nom}`,
      checkoutDate: stay.dateCheckoutPrevue,
    }));
  }

  async addCharge(dto: CreateRestaurantChargeDto, userId?: number) {
    const stay = await this.stayService.findOne(dto.stayId);
    if (stay.statut !== StatutSejour.EN_COURS) {
      throw new ConflictException(
        `Impossible d'ajouter une note restaurant : le séjour ${dto.stayId} n'est plus en cours (statut ${stay.statut}).`,
      );
    }
    const folio = stay.folios[0];
    if (!folio) {
      throw new NotFoundException(
        `Aucun folio trouvé pour le séjour ${dto.stayId}.`,
      );
    }

    const line = await this.prisma.$transaction(async (tx) => {
      const created = await this.billingService.addFolioLine(
        folio.id,
        {
          type: TypeLigneFolio.RESTAURANT,
          libelle: dto.libelle,
          montant: dto.montant,
        },
        tx,
      );

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CREATE_RESTAURANT_CHARGE,
        targetEntity: AuditEntity.FolioLine,
        targetId: created.id,
        newValue: {
          libelle: dto.libelle,
          montant: dto.montant,
          commentaire: dto.commentaire ?? null,
        },
        motif: `Note restaurant ajoutée au séjour ${dto.stayId} (chambre ${stay.room.numero}) : ${dto.libelle}, ${dto.montant} MAD.`,
      });

      return created;
    });

    await this.eventEmitter.emitAsync(
      'restaurant.charge.ajoutee',
      new RestaurantChargeAjouteeEvent(
        dto.stayId,
        line.id,
        dto.libelle,
        dto.montant,
        userId,
      ),
    );

    return line;
  }

  // RD-F11-02 — jamais de mutation directe d'une FolioLine existante
  // (ADR-002) : annulation soft (BillingService.cancelFolioLine) puis
  // recréation (BillingService.addFolioLine) dans une seule transaction —
  // 2 lignes d'audit distinctes (CANCEL_FOLIO_LINE + CREATE_RESTAURANT_CHARGE),
  // jamais une troisième table parallèle pour tracer la correction.
  // Verrouillé si le séjour est TERMINE (StatutSejour n'a que EN_COURS/
  // CHECKOUT — cancelFolioLine/assertFolioWritable renvoient déjà 409 dès
  // que le séjour n'est plus EN_COURS, ce qui couvre ce cas).
  async updateCharge(
    folioLineId: number,
    dto: UpdateRestaurantChargeDto,
    userId?: number,
  ) {
    const existing = await this.prisma.folioLine.findUnique({
      where: { id: folioLineId },
    });
    if (!existing) {
      throw new NotFoundException(`Ligne de folio ${folioLineId} introuvable.`);
    }
    if (existing.type !== TypeLigneFolio.RESTAURANT) {
      throw new ConflictException(
        `La ligne ${folioLineId} n'est pas une note restaurant (type ${existing.type}).`,
      );
    }

    const newLine = await this.prisma.$transaction(async (tx) => {
      await this.billingService.cancelFolioLine(
        folioLineId,
        { motif: dto.motif },
        userId,
        tx,
      );

      const created = await this.billingService.addFolioLine(
        existing.folioId,
        {
          type: TypeLigneFolio.RESTAURANT,
          libelle: dto.libelle,
          montant: dto.montant,
        },
        tx,
      );

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CREATE_RESTAURANT_CHARGE,
        targetEntity: AuditEntity.FolioLine,
        targetId: created.id,
        oldValue: {
          libelle: existing.libelle,
          montant: existing.montant.toString(),
        },
        newValue: {
          libelle: dto.libelle,
          montant: dto.montant,
          commentaire: dto.commentaire ?? null,
          correctionDe: folioLineId,
        },
        motif: dto.motif,
      });

      return created;
    });

    await this.eventEmitter.emitAsync(
      'restaurant.charge.ajoutee',
      new RestaurantChargeAjouteeEvent(
        existing.folioId,
        newLine.id,
        dto.libelle,
        dto.montant,
        userId,
      ),
    );

    return newLine;
  }

  // Mini-rapport imprimable/email/WhatsApp — double vérification a
  // posteriori (jamais bloquante), regroupé par chambre. Lecture directe
  // FolioLine/Room (même convention que FinancialReportingService pour une
  // lecture cross-domaine simple, pas de nouvelle façade StayService pour
  // ce seul besoin).
  async getDailyReport(date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const lignes = await this.prisma.folioLine.findMany({
      where: {
        type: TypeLigneFolio.RESTAURANT,
        createdAt: { gte: start, lt: end },
      },
      include: {
        folio: { include: { stay: { include: { room: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const parChambre = new Map<
      string,
      {
        roomNumber: string;
        stayId: number;
        charges: {
          id: number;
          libelle: string;
          montant: string;
          annulee: boolean;
          createdAt: Date;
        }[];
      }
    >();

    for (const ligne of lignes) {
      const roomNumber = ligne.folio.stay.room.numero;
      const key = `${ligne.folio.stay.id}`;
      if (!parChambre.has(key)) {
        parChambre.set(key, {
          roomNumber,
          stayId: ligne.folio.stay.id,
          charges: [],
        });
      }
      parChambre.get(key)!.charges.push({
        id: ligne.id,
        libelle: ligne.libelle,
        montant: ligne.montant.toString(),
        annulee: ligne.annulee,
        createdAt: ligne.createdAt,
      });
    }

    return Array.from(parChambre.values());
  }
}
