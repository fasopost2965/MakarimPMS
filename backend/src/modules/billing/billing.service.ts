import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AddFolioLineDto } from './dto/add-folio-line.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  calculateInvoiceTotal,
  generateInvoiceNumber,
} from './utils/invoice-calc';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  // Ajouter une charge (ligne) à un folio. Les frais annexes (extra,
  // services, etc.) sont rattachés aux folios existants plutôt que créant
  // un nouveau folio (CLAUDE.md règle 2 : un séjour peut avoir plusieurs
  // folios, mais les lignes s'ajoutent au folio principal en Phase 1).
  async addFolioLine(folioId: number, dto: AddFolioLineDto) {
    const folio = await this.prisma.folio.findUnique({
      where: { id: folioId },
      include: { stay: true },
    });
    if (!folio) {
      throw new NotFoundException(`Folio ${folioId} introuvable.`);
    }

    // Vérifier que le séjour est encore en cours (check-out verrouille les
    // modifications de folio via la suppression des RoomNight et la
    // clôture du séjour, donc c'est cohérent).
    if (folio.stay.statut !== 'EN_COURS') {
      throw new ConflictException(
        "Impossible d'ajouter une ligne à un folio d'un séjour déjà clôturé.",
      );
    }

    const montantDecimal = new Prisma.Decimal(dto.montant);

    // Remarque : tauxTva n'est PAS calculé ici pour les extras génériques.
    // En Phase 2 avec le workflow de tickets/tâches (5.8), les taux seront
    // appliqués selon le type de charge. Pour l'instant (Phase 1), on laisse
    // tauxTva à sa valeur par défaut (0) — la TVA s'applique lors de la
    // génération de facture depuis le type de ligne.
    return this.prisma.folioLine.create({
      data: {
        folioId,
        type: dto.type,
        libelle: dto.libelle,
        montant: montantDecimal,
        tauxTva: new Prisma.Decimal(0),
      },
    });
  }

  // Générer une facture depuis un folio. Règle non négociable : une fois
  // émise, une facture est immuable — elle est toujours EMISE, et ne peut
  // être modifiée que par un avoir (CreditNote, module 5.13 Phase 2).
  async generateInvoice(folioId: number) {
    const folio = await this.prisma.folio.findUnique({
      where: { id: folioId },
      include: {
        lignes: true,
        invoices: true,
      },
    });
    if (!folio) {
      throw new NotFoundException(`Folio ${folioId} introuvable.`);
    }

    // Vérifier qu'une facture n'existe pas déjà pour ce folio (en Phase 1,
    // un folio = une facture maximum).
    if (folio.invoices.length > 0) {
      throw new ConflictException(
        `Une facture existe déjà pour le folio ${folioId}.`,
      );
    }

    // Charger les taux TVA/taxe depuis TaxRateConfig (jamais en dur).
    const taxRates = await this.prisma.taxRateConfig.findMany();
    const taxRateMap = new Map<string, Prisma.Decimal>();
    for (const config of taxRates) {
      taxRateMap.set(config.type, config.taux);
    }

    // Calculer le montant total avec les taux actuels de TaxRateConfig.
    const montantTotal = calculateInvoiceTotal(folio.lignes, taxRateMap);

    // Créer la facture avec un numéro unique et immutable.
    const invoice = await this.prisma.invoice.create({
      data: {
        folioId,
        montantTotal,
        statut: 'EMISE',
        numero: generateInvoiceNumber(0), // sera remplacé après la création avec l'ID réel
      },
    });

    // Mettre à jour le numéro avec l'ID de la facture pour la séquence.
    const updatedInvoice = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { numero: generateInvoiceNumber(invoice.id) },
    });

    return updatedInvoice;
  }

  // Créer un paiement avec vérification idempotence via idempotencyKey.
  // Règle non négociable : envoi deux fois la même requête avec la même
  // clé → un seul paiement créé (pas de double-encaissement).
  async createPayment(dto: CreatePaymentDto) {
    const montantDecimal = new Prisma.Decimal(dto.montant);

    try {
      return await this.prisma.payment.create({
        data: {
          invoiceId: dto.invoiceId || null,
          moyen: dto.moyen,
          montant: montantDecimal,
          idempotencyKey: dto.idempotencyKey,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // La clé idempotence existe déjà : retourner le paiement existant.
        const existing = await this.prisma.payment.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (!existing) {
          throw error;
        }
        return existing;
      }
      throw error;
    }
  }

  async findFolioById(id: number) {
    const folio = await this.prisma.folio.findUnique({
      where: { id },
      include: {
        stay: true,
        lignes: true,
        invoices: {
          include: {
            creditNotes: true,
            payments: true,
          },
        },
      },
    });
    if (!folio) {
      throw new NotFoundException(`Folio ${id} introuvable.`);
    }
    return folio;
  }

  async findInvoiceById(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        folio: {
          include: { lignes: true, stay: true },
        },
        creditNotes: true,
        payments: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException(`Facture ${id} introuvable.`);
    }
    return invoice;
  }

  // Lister les folios d'un séjour.
  async findFoliosByStayId(stayId: number) {
    return this.prisma.folio.findMany({
      where: { stayId },
      include: {
        lignes: true,
        invoices: {
          include: {
            creditNotes: true,
            payments: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
