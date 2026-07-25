import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  Prisma,
  TypeLigneFolio,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ParametersService } from '../parameters/parameters.service';
import { AuditService } from '../audit/audit.service';
// Utilitaire pur (aucun Prisma/DI), même précédent que
// StayService.createFolioPrincipal — pas une façade de module à contourner.
import { getNightsBetween } from '../reservations/utils/nights';
import { AddFolioLineDto } from './dto/add-folio-line.dto';
import { ExcludeFolioTaxesDto } from './dto/exclude-folio-taxes.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import {
  calculateInvoiceTotal,
  computeTaxLineAmount,
  generateInvoiceNumber,
} from './utils/invoice-calc';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametersService: ParametersService,
    private readonly auditService: AuditService,
  ) {}

  // Vérifie qu'un folio existe et que son séjour est encore en cours
  // (check-out verrouille les modifications de folio via la suppression des
  // RoomNight et la clôture du séjour). Partagé entre addFolioLine et
  // creditFolioLine (façade du module payments) : les deux créent des
  // FolioLine et doivent respecter la même garde d'écriture.
  private async assertFolioWritable(
    folioId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const folio = await client.folio.findUnique({
      where: { id: folioId },
      include: { stay: true },
    });
    if (!folio) {
      throw new NotFoundException(`Folio ${folioId} introuvable.`);
    }
    if (folio.stay.statut !== 'EN_COURS') {
      throw new ConflictException(
        "Impossible de modifier un folio d'un séjour déjà clôturé.",
      );
    }
    return folio;
  }

  // Ajouter une charge (ligne) à un folio. Les frais annexes (extra,
  // services, etc.) sont rattachés aux folios existants plutôt que créant
  // un nouveau folio (CLAUDE.md règle 2 : un séjour peut avoir plusieurs
  // folios, mais les lignes s'ajoutent au folio principal en Phase 1).
  async addFolioLine(folioId: number, dto: AddFolioLineDto) {
    await this.assertFolioWritable(folioId);

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
  // être modifiée que par un avoir (CreditNote — CH-001,
  // docs/governance/REGISTRE_CHANTIERS.md, avoir total uniquement : voir
  // createCreditNote ci-dessous).
  //
  // Avant de calculer le total, matérialise en FolioLine chaque taxe
  // configurable applicable (TAXE_SEJOUR et toute taxe créée depuis
  // /parameters/tax-rates) — c'était le trou identifié dans le référentiel :
  // TypeLigneFolio.TAXE_SEJOUR était géré partout en aval (invoice-calc,
  // solde, ventilation fiscale) mais jamais généré en amont. La TVA
  // (TVA_HEBERGEMENT/TVA_ANNEXE) reste appliquée en marge par
  // calculateInvoiceTotal comme avant — elle est explicitement exclue de
  // cette injection pour ne jamais être comptée deux fois.
  async generateInvoice(folioId: number) {
    return this.prisma.$transaction(async (tx) => {
      const folio = await tx.folio.findUnique({
        where: { id: folioId },
        include: {
          lignes: true,
          invoices: true,
          taxExclusions: true,
          // Lecture de Stay/Room/RoomType via la relation du Folio, jamais
          // via StayModule/RoomsModule (docs/modules/billing.md §"stay" —
          // dépendance déjà établie et documentée par assertFolioWritable
          // ci-dessus, étendue ici aux champs nécessaires au calcul de la
          // taxe de séjour). billing→stay n'est PAS une arête sanctionnée
          // par docs/DEPENDENCY_GRAPH.md pour un import de module — ceci
          // reste une lecture de relation Prisma locale à Folio, pas un
          // import de StayModule.
          stay: { include: { room: { include: { roomType: true } } } },
        },
      });
      if (!folio) {
        throw new NotFoundException(`Folio ${folioId} introuvable.`);
      }

      // Une facture ACTIVE (EMISE) bloque toute nouvelle génération — mais
      // une facture déjà ANNULEE_PAR_AVOIR (CH-001) ne doit plus bloquer :
      // c'est précisément ce qui permet de régénérer une facture corrigée
      // sur le même folio après un avoir. `length > 0` seul aurait empêché
      // toute correction, contredisant l'objet même de l'avoir.
      const factureActive = folio.invoices.find((i) => i.statut === 'EMISE');
      if (factureActive) {
        throw new ConflictException(
          `Une facture active existe déjà pour le folio ${folioId} (facture ${factureActive.numero}) — génère un avoir avant d'en créer une nouvelle.`,
        );
      }

      // Taxes applicables chargées via le module parameters (jamais en dur,
      // jamais de lecture Prisma directe de TaxRateConfig hors de ce
      // module).
      const applicableTaxes =
        await this.parametersService.getApplicableTaxes(tx);
      const excludedIds = new Set(
        folio.taxExclusions.map((e) => e.taxRateConfigId),
      );
      // TVA_HEBERGEMENT/TVA_ANNEXE restent une marge appliquée par
      // calculateInvoiceTotal, jamais une FolioLine propre — voir
      // commentaire ci-dessus.
      const taxesToApply = applicableTaxes.filter(
        (t) =>
          t.type !== 'TVA_HEBERGEMENT' &&
          t.type !== 'TVA_ANNEXE' &&
          !excludedIds.has(t.id),
      );

      // Ne jamais réinjecter les lignes TAXE_SEJOUR si une génération
      // précédente (avant un avoir) les a déjà matérialisées sur ce folio —
      // sinon une régénération après avoir double la taxe de séjour. Les
      // lignes de taxe restent sur le folio après un avoir (l'avoir annule
      // la facture, pas les charges réelles sous-jacentes).
      const taxeDejaMaterialisee = folio.lignes.some(
        (l) => l.type === TypeLigneFolio.TAXE_SEJOUR,
      );

      const nouvellesLignes: Prisma.FolioLineCreateManyInput[] = [];
      if (taxesToApply.length > 0 && !taxeDejaMaterialisee) {
        const nights = getNightsBetween(
          folio.stay.dateCheckin,
          folio.stay.dateCheckoutReelle ?? folio.stay.dateCheckoutPrevue,
        ).length;
        // Proxy nombre d'adultes : RoomType.capacite (aucun champ dédié dans
        // le schéma — même convention que Priorité 3 Formules
        // d'hébergement, cf. reservations/utils/pricing.ts).
        const nbPersonnes = folio.stay.room.roomType.capacite;
        const sousTotalHebergementHt = folio.lignes
          .filter((l) => l.type === TypeLigneFolio.HEBERGEMENT && !l.annulee)
          .reduce((acc, l) => acc.add(l.montant), new Prisma.Decimal(0));

        for (const tax of taxesToApply) {
          const montant = computeTaxLineAmount(
            tax,
            nights,
            nbPersonnes,
            sousTotalHebergementHt,
          );
          nouvellesLignes.push({
            folioId,
            type: TypeLigneFolio.TAXE_SEJOUR,
            libelle: tax.type,
            montant,
            tauxTva: new Prisma.Decimal(0),
            taxRateConfigId: tax.id,
          });
        }
        await tx.folioLine.createMany({ data: nouvellesLignes });
      }

      // Re-lit les lignes complètes (avec id/createdAt) si de nouvelles
      // lignes de taxe viennent d'être créées, pour donner à
      // calculateInvoiceTotal des FolioLine réelles plutôt que les objets
      // d'insertion — évite aussi de dupliquer la logique de filtrage.
      const toutesLesLignes = nouvellesLignes.length
        ? await tx.folioLine.findMany({ where: { folioId } })
        : folio.lignes;

      // Marge TVA (HEBERGEMENT/EXTRA) chargée via le module parameters.
      const taxRateMap = await this.parametersService.getTaxRateMap(tx);
      const montantTotal = calculateInvoiceTotal(toutesLesLignes, taxRateMap);

      // Créer la facture avec un numéro unique et immutable.
      const invoice = await tx.invoice.create({
        data: {
          folioId,
          montantTotal,
          statut: 'EMISE',
          numero: generateInvoiceNumber(0), // sera remplacé après la création avec l'ID réel
        },
      });

      // Mettre à jour le numéro avec l'ID de la facture pour la séquence.
      return tx.invoice.update({
        where: { id: invoice.id },
        data: { numero: generateInvoiceNumber(invoice.id) },
      });
    });
  }

  // Exclut (ou réintègre) des taxes applicables par défaut pour un folio
  // donné (client exonéré) — sémantique PATCH idempotente : remplace
  // l'ensemble complet des exclusions à chaque appel. Interdit tant qu'une
  // facture ACTIVE existe (INV-FAC-001 : la facture ne doit jamais pouvoir
  // changer rétroactivement suite à une exclusion tardive) — mais autorisé
  // de nouveau après un avoir (CH-001), même logique que generateInvoice :
  // c'est ce qui permet de corriger l'exclusion avant de régénérer.
  async excludeTaxes(
    folioId: number,
    dto: ExcludeFolioTaxesDto,
    userId?: number,
  ) {
    const folio = await this.prisma.folio.findUnique({
      where: { id: folioId },
      include: { invoices: true, taxExclusions: true },
    });
    if (!folio) {
      throw new NotFoundException(`Folio ${folioId} introuvable.`);
    }
    if (folio.invoices.some((i) => i.statut === 'EMISE')) {
      throw new ConflictException(
        `Une facture active existe déjà pour le folio ${folioId} — les exclusions de taxe ne sont plus modifiables.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.folioTaxExclusion.deleteMany({ where: { folioId } });
      if (dto.taxeIds.length > 0) {
        await tx.folioTaxExclusion.createMany({
          data: dto.taxeIds.map((taxRateConfigId) => ({
            folioId,
            taxRateConfigId,
            motif: dto.motif,
            userId,
          })),
        });
      }

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.EXCLUDE_FOLIO_TAX,
        targetEntity: AuditEntity.Folio,
        targetId: folioId,
        oldValue: {
          taxeIds: folio.taxExclusions.map((e) => e.taxRateConfigId),
        },
        newValue: { taxeIds: dto.taxeIds },
        motif: dto.motif,
      });

      return tx.folioTaxExclusion.findMany({ where: { folioId } });
    });
  }

  // Avoir sur une facture émise (CH-001, docs/governance/REGISTRE_CHANTIERS.md
  // — arbitrage confirmé : avoir TOTAL uniquement, jamais partiel). Chemin
  // d'écriture unique de CreditNote et du passage Invoice.statut à
  // ANNULEE_PAR_AVOIR : la facture d'origine n'est jamais modifiée
  // (montantTotal/numero/lignes restent figés, immuabilité ADR-004
  // préservée), seul son statut change. Les FolioLine sous-jacentes
  // (HEBERGEMENT/EXTRA/TAXE_SEJOUR déjà matérialisées) ne sont jamais
  // touchées ici — l'avoir annule le document fiscal, pas les charges
  // réelles du séjour. Une fois l'avoir posé, generateInvoice() peut être
  // rappelé sur le même folio pour émettre la facture corrigée (garde
  // assouplie ci-dessus pour n'exclure que les factures encore actives).
  async createCreditNote(
    invoiceId: number,
    dto: CreateCreditNoteDto,
    userId?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) {
        throw new NotFoundException(`Facture ${invoiceId} introuvable.`);
      }
      if (invoice.statut !== 'EMISE') {
        throw new ConflictException(
          `La facture ${invoice.numero} est déjà annulée par avoir.`,
        );
      }

      const creditNote = await tx.creditNote.create({
        data: {
          invoiceId,
          motif: dto.motif,
          montant: invoice.montantTotal,
        },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { statut: 'ANNULEE_PAR_AVOIR' },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CREATE_CREDIT_NOTE,
        targetEntity: AuditEntity.Invoice,
        targetId: invoiceId,
        oldValue: { statut: invoice.statut },
        newValue: {
          statut: 'ANNULEE_PAR_AVOIR',
          creditNoteId: creditNote.id,
          montant: invoice.montantTotal.toString(),
        },
        motif: dto.motif,
      });

      return creditNote;
    });
  }

  // Façade pour le module payments (docs/modules/payments.md §10 : payments
  // ne dépend que de billing, jamais de Prisma direct sur Folio/FolioLine).
  // Crée la ligne créditrice PAIEMENT correspondant à un règlement encaissé
  // — jamais l'inverse, payments n'écrit jamais dans FolioLine lui-même.
  // tx obligatoire : doit s'exécuter dans la même transaction que
  // l'écriture du Payment (même logique qu'AuditService.writeLog).
  async creditFolioLine(
    folioId: number,
    montant: Prisma.Decimal,
    libelle: string,
    tx: Prisma.TransactionClient,
  ) {
    await this.assertFolioWritable(folioId, tx);
    return tx.folioLine.create({
      data: { folioId, type: TypeLigneFolio.PAIEMENT, libelle, montant },
    });
  }

  async findFolioById(id: number) {
    const folio = await this.prisma.folio.findUnique({
      where: { id },
      include: {
        stay: true,
        lignes: true,
        payments: true,
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
        payments: true,
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

  // Façade exposée aux autres modules (docs/modules/guests.md §11 :
  // "guests ne doit jamais interroger directement billing/payments") — le
  // module guests appelle cette méthode au lieu de lire prisma.invoice
  // lui-même, préservant la propriété du domaine facturation sur ses
  // propres tables.
  async findInvoicesByGuestId(guestId: number) {
    return this.prisma.invoice.findMany({
      where: { folio: { stay: { guestId } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
