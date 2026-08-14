import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes } from 'node:crypto';
import {
  AuditAction,
  AuditEntity,
  FolioLine,
  Prisma,
  TypeLigneFolio,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ParametersService } from '../parameters/parameters.service';
import { AuditService } from '../audit/audit.service';
import { getTodayRange } from '../../common/utils/date-range';
// Utilitaire pur (aucun Prisma/DI), même précédent que
// StayService.createFolioPrincipal — pas une façade de module à contourner.
import { getNightsBetween } from '../reservations/utils/nights';
// UX-001B — même précédent que getNightsBetween ci-dessus : utilitaire pur
// (aucun Prisma/DI), computeFolioSummary délègue à computeSoldeDu (LA
// fonction canonique unique de calcul du solde, jamais réimplémentée ici).
import { computeFolioSummary, computeSoldeDu } from '../stay/utils/solde';
import { AddFolioLineDto } from './dto/add-folio-line.dto';
import { ExcludeFolioTaxesDto } from './dto/exclude-folio-taxes.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { CancelFolioLineDto } from './dto/cancel-folio-line.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { ListStaysFacturablesQueryDto } from './dto/list-stays-facturables-query.dto';
import {
  calculateInvoiceTotal,
  computeTaxLineAmount,
  generateInvoiceNumber,
} from './utils/invoice-calc';
import { buildInvoicePdf } from './utils/invoice.pdf';
import { FactureEnvoiDemandeEvent } from './events/facture-envoi-demande.event';

// CH-050 suite — durée de vie d'un lien de téléchargement de facture
// (InvoiceDownloadToken). Assez court pour limiter la fenêtre d'exposition
// d'un lien non authentifié, assez long pour qu'un client WhatsApp/email
// lent (ou consulté quelques jours plus tard) puisse encore l'ouvrir.
const DOWNLOAD_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametersService: ParametersService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
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
  //
  // Bug réel identifié en câblant l'UI de cette route (CH-050,
  // docs/execution/PLAN_MODULE_FACTURATION.md) : assertFolioWritable ne
  // vérifie que le statut du séjour, jamais celui des factures — une charge
  // ajoutée après l'émission d'une facture (INV-FAC-001, immuable) ne
  // pouvait donc jamais y apparaître, sans que rien ne le signale à la
  // réception (montant silencieusement non facturé). Garde ajoutée ici
  // uniquement (pas dans creditFolioLine ci-dessous, appelée par
  // payments/stay pour créditer un règlement ou un acompte — un client doit
  // pouvoir payer une facture déjà émise, cas normal, pas un bug).
  // F11 (CH-056) — tx optionnel ajouté pour permettre à RestaurantService
  // d'écrire la FolioLine RESTAURANT et son AuditLog dans une seule
  // transaction (ADR-005) sans dupliquer cette méthode, même pattern que
  // creditFolioLine/assertFolioWritable ci-dessous.
  async addFolioLine(
    folioId: number,
    dto: AddFolioLineDto,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    await this.assertFolioWritable(folioId, tx);
    const invoices = await client.invoice.findMany({
      where: { folioId },
    });
    if (invoices.some((i) => i.statut === 'EMISE')) {
      throw new ConflictException(
        `Une facture active existe déjà pour le folio ${folioId} — impossible d'ajouter une charge qui n'y apparaîtrait jamais. Génère un avoir avant d'ajouter puis de refacturer.`,
      );
    }

    const montantDecimal = new Prisma.Decimal(dto.montant);

    // Remarque : tauxTva n'est PAS calculé ici pour les extras génériques.
    // En Phase 2 avec le workflow de tickets/tâches (5.8), les taux seront
    // appliqués selon le type de charge. Pour l'instant (Phase 1), on laisse
    // tauxTva à sa valeur par défaut (0) — la TVA s'applique lors de la
    // génération de facture depuis le type de ligne.
    return client.folioLine.create({
      data: {
        folioId,
        type: dto.type,
        libelle: dto.libelle,
        montant: montantDecimal,
        tauxTva: new Prisma.Decimal(0),
      },
    });
  }

  // CH-040 (BR-AUD-002, docs/modules/billing.md §5) — annulation contrôlée
  // d'une ligne EXTRA : le schéma portait déjà `FolioLine.annulee`/
  // `motifAnnulation` et toute la lecture en aval (computeSoldeDu exclut
  // déjà les lignes annulées, generateInvoice filtre déjà .annulee) —
  // seul manquait ce point d'écriture. Restreint aux lignes EXTRA/RESTAURANT
  // (HEBERGEMENT/TAXE_SEJOUR sont générées par le système, jamais annulées
  // à la main ; PAIEMENT a son propre flux dédié, payments:refund).
  // F11 (CH-056) — RESTAURANT ajouté à la garde de type : RD-F11-02 réutilise
  // ce chemin d'écriture pour la première moitié (annulation) d'une
  // correction de note restaurant (annulation + recréation via addFolioLine
  // ci-dessus, jamais de mutation directe d'une ligne existante). tx
  // optionnel ajouté pour que RestaurantService compose annulation+
  // recréation dans une seule transaction. Mêmes gardes qu'addFolioLine
  // ci-dessus (séjour en cours, pas de facture déjà émise sur ce folio) —
  // sinon une ligne facturée disparaîtrait du solde sans que la facture
  // immuable (INV-FAC-001) ne le reflète jamais.
  async cancelFolioLine(
    lineId: number,
    dto: CancelFolioLineDto,
    userId?: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const ligne = await client.folioLine.findUnique({
      where: { id: lineId },
      include: { folio: { include: { invoices: true } } },
    });
    if (!ligne) {
      throw new NotFoundException(`Ligne de folio ${lineId} introuvable.`);
    }
    if (ligne.annulee) {
      throw new ConflictException(`Ligne de folio ${lineId} déjà annulée.`);
    }
    if (
      ligne.type !== TypeLigneFolio.EXTRA &&
      ligne.type !== TypeLigneFolio.RESTAURANT
    ) {
      throw new ConflictException(
        `Seules les lignes de type EXTRA ou RESTAURANT peuvent être annulées manuellement (BR-AUD-002) — la ligne ${lineId} est de type ${ligne.type}.`,
      );
    }
    await this.assertFolioWritable(ligne.folioId, tx);
    if (ligne.folio.invoices.some((i) => i.statut === 'EMISE')) {
      throw new ConflictException(
        `Une facture active existe déjà pour le folio ${ligne.folioId} — impossible d'annuler une ligne déjà facturée. Génère un avoir avant d'annuler.`,
      );
    }

    const run = async (activeTx: Prisma.TransactionClient) => {
      const updated = await activeTx.folioLine.update({
        where: { id: lineId },
        data: { annulee: true, motifAnnulation: dto.motif },
      });

      await this.auditService.writeLog(activeTx, {
        userId,
        action: AuditAction.CANCEL_FOLIO_LINE,
        targetEntity: AuditEntity.FolioLine,
        targetId: lineId,
        oldValue: { annulee: false, montant: ligne.montant.toString() },
        newValue: { annulee: true, motifAnnulation: dto.motif },
        motif: dto.motif,
      });

      return updated;
    };

    return tx ? run(tx) : this.prisma.$transaction(run);
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
  // solde, ventilation fiscale) mais jamais généré en amont. ADR-008/
  // FIN-101B : TVA_HEBERGEMENT/TVA_ANNEXE ne sont plus jamais ajoutées en
  // marge par calculateInvoiceTotal (les montants HEBERGEMENT/EXTRA/
  // RESTAURANT sont déjà TTC dès leur écriture) — elles restent exclues de
  // cette injection de FolioLine, il ne s'agit jamais d'une charge propre.
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
      // TVA_HEBERGEMENT/TVA_ANNEXE exclues ici (jamais matérialisées en
      // FolioLine propre) — depuis ADR-008/FIN-101B, HEBERGEMENT/EXTRA/
      // RESTAURANT sont déjà TTC et calculateInvoiceTotal n'ajoute plus
      // aucune marge de TVA dessus (voir invoice-calc.ts). TAXE_SEJOUR reste
      // une ligne statutaire distincte — FIN-102 (composition du tarif
      // public TTC) : pour un séjour non-legacy (Stay.nombreOccupants IS NOT
      // NULL), TAXE_SEJOUR est désormais matérialisée dès le check-in/à la
      // prolongation (StayService, common/fiscal/tarif-decomposition.ts) et
      // ce bloc ne s'exécute plus jamais pour lui — generateInvoice reste
      // strictement lecture seule sur les charges de son folio. Seul un
      // séjour legacy (Stay.nombreOccupants IS NULL, créé avant ce
      // déploiement) continue de passer par ce fallback historique — aucune
      // recomposition rétroactive de son folio, comportement inchangé.
      const legacySansOccupation = folio.stay.nombreOccupants === null;
      const taxesToApply = legacySansOccupation
        ? applicableTaxes.filter(
            (t) =>
              t.type !== 'TVA_HEBERGEMENT' &&
              t.type !== 'TVA_ANNEXE' &&
              !excludedIds.has(t.id),
          )
        : [];

      // Ne jamais réinjecter les lignes TAXE_SEJOUR si une génération
      // précédente (avant un avoir) les a déjà matérialisées sur ce folio —
      // sinon une régénération après avoir double la taxe de séjour. Les
      // lignes de taxe restent sur le folio après un avoir (l'avoir annule
      // la facture, pas les charges réelles sous-jacentes). Pour un séjour
      // non-legacy, TAXE_SEJOUR est toujours déjà présente (matérialisée au
      // check-in) — cette garde reste doublement vraie, jamais contournée.
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

      // Défense en profondeur n°1 (ADR-008/FIN-101B) : les lignes PAIEMENT
      // ne doivent jamais entrer dans le calcul du total de facture — un
      // règlement/acompte déjà encaissé (imputerAcomptes crédite une ligne
      // PAIEMENT dès le check-in, avant toute génération de facture) n'est
      // pas une charge. Filtré ici en amont ; la défense en profondeur n°2
      // est l'exclusion propre à calculateInvoiceTotal elle-même (voir
      // invoice-calc.ts) — les deux coexistent volontairement.
      const lignesFacturables = toutesLesLignes.filter(
        (l) => l.type !== TypeLigneFolio.PAIEMENT,
      );
      const montantTotal = calculateInvoiceTotal(lignesFacturables);

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
    // UX-001B — synthèse de solde (totalChargesTTC/totalPaidTTC/balanceTTC),
    // calculée sur ce seul folio via computeFolioSummary (computeSoldeDu en
    // interne pour balanceTTC, jamais une seconde formule) : évite que le
    // frontend (RecordPaymentDialog notamment) n'ait à recalculer un solde
    // à partir des lignes brutes.
    return { ...folio, synthese: computeFolioSummary([folio]) };
  }

  // CH-050 (docs/execution/PLAN_MODULE_FACTURATION.md) — génère le PDF d'une
  // facture déjà émise. Réutilise le même principe que
  // PoliceService.generatePdf (utilitaire pur buildInvoicePdf, aucune
  // persistance disque — régénéré à la demande à chaque appel). HotelConfig
  // lu via la façade ParametersService (jamais Prisma direct sur cette
  // table, docs/modules/parameters.md §10) — même convention que
  // generateInvoice ci-dessus pour les taux de taxe.
  async generateInvoicePdf(invoiceId: number): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        folio: {
          include: {
            lignes: true,
            stay: {
              include: { guest: true, room: { include: { roomType: true } } },
            },
          },
        },
      },
    });
    if (!invoice) {
      throw new NotFoundException(`Facture ${invoiceId} introuvable.`);
    }

    const hotelConfig = await this.parametersService.getHotelConfig();

    return buildInvoicePdf({
      hotel: {
        raisonSociale: hotelConfig.raisonSociale,
        adresse: hotelConfig.adresse,
        ice: hotelConfig.ice,
        identifiantFiscal: hotelConfig.identifiantFiscal,
        rc: hotelConfig.rc,
        categorieEtoiles: hotelConfig.categorieEtoiles,
        logoUrl: hotelConfig.logoUrl,
      },
      guest: {
        nom: invoice.folio.stay.guest.nom,
        prenom: invoice.folio.stay.guest.prenom,
        email: invoice.folio.stay.guest.email,
      },
      stay: {
        id: invoice.folio.stay.id,
        roomNumero: invoice.folio.stay.room.numero,
        roomTypeNom: invoice.folio.stay.room.roomType.nom,
      },
      invoice: {
        numero: invoice.numero,
        createdAt: invoice.createdAt,
        montantTotal: invoice.montantTotal.toString(),
        statut: invoice.statut,
      },
      lignes: invoice.folio.lignes.map((l) => ({
        libelle: l.libelle,
        montant: l.montant.toString(),
        annulee: l.annulee,
        type: l.type,
      })),
    });
  }

  // CH-050 suite — demande d'envoi d'une facture par email/WhatsApp. Ne fait
  // qu'émettre l'évènement (découplage volontaire, même convention que
  // ReservationsService.create()/StayService.checkout() — le listener vit
  // dans le module consommateur, notifications, jamais importé ici en
  // retour). emitAsync (pas emit) : NotificationsService.notify() écrit des
  // NotificationLog qui référencent guestId — l'appelant doit pouvoir
  // attendre que l'écriture ait eu lieu avant de répondre 200 au client HTTP
  // (même règle générale que reservation.confirmee, CLAUDE.md).
  async requestDelivery(invoiceId: number, userId?: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException(`Facture ${invoiceId} introuvable.`);
    }
    await this.eventEmitter.emitAsync(
      'facture.envoi-demande',
      new FactureEnvoiDemandeEvent(invoiceId, userId),
    );
  }

  // Contexte complet nécessaire à l'envoi (guest, montants, PDF déjà généré)
  // — appelé par le listener notifications (façade, jamais de Prisma direct
  // sur Invoice/Folio/Stay/Guest hors de ce module). Réutilise
  // generateInvoicePdf() plutôt que de dupliquer la requête Prisma.
  async getInvoiceDeliveryContext(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        folio: { include: { stay: { include: { guest: true } } } },
      },
    });
    if (!invoice) {
      throw new NotFoundException(`Facture ${invoiceId} introuvable.`);
    }
    const pdf = await this.generateInvoicePdf(invoiceId);
    return {
      guestId: invoice.folio.stay.guest.id,
      numero: invoice.numero,
      montantTotal: invoice.montantTotal.toString(),
      pdf,
    };
  }

  // Jeton de téléchargement public à durée limitée (voir InvoiceDownloadToken
  // en schéma pour le contexte complet) — un jeton par demande d'envoi,
  // jamais réutilisé/régénéré en place.
  async createDownloadToken(invoiceId: number) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + DOWNLOAD_TOKEN_TTL_MS);
    await this.prisma.invoiceDownloadToken.create({
      data: { token, invoiceId, expiresAt },
    });
    return token;
  }

  // Résout un jeton public en PDF (voir GET /invoices/download/:token,
  // @Public()) — jamais de fuite d'information sur la raison d'un échec
  // (jeton inconnu vs expiré) au-delà d'un 404 générique, même posture que
  // les autres jetons publics du projet (SelfCheckinToken).
  async resolveDownloadToken(token: string): Promise<Buffer> {
    const record = await this.prisma.invoiceDownloadToken.findUnique({
      where: { token },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new NotFoundException('Lien de téléchargement invalide ou expiré.');
    }
    return this.generateInvoicePdf(record.invoiceId);
  }

  // DESIGN-010 — stay.guest/stay.room.roomType ajoutés à l'include (absents
  // avant cette itération) : le panneau facture du Billing Center (mission
  // §14) a besoin du client/de la chambre affichés sans requête
  // supplémentaire, même contexte que generateInvoicePdf ci-dessus, qui
  // charge déjà exactement ces mêmes relations pour construire le PDF.
  async findInvoiceById(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        folio: {
          include: {
            lignes: true,
            stay: {
              include: { guest: true, room: { include: { roomType: true } } },
            },
          },
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

  // DESIGN-010 (Billing Center) — GET /invoices, registre global paginé.
  // Date filtrée sur Invoice.createdAt (date d'émission, jamais modifiée —
  // mission §3). Sélection volontairement étroite (pas d'`include` complet
  // du folio/de ses lignes) : seuls les champs affichés par le registre
  // (client/séjour/chambre/montant/statut) sont chargés, pour éviter
  // l'over-fetch explicitement proscrit par la mission.
  async findInvoicesPaginated(query: ListInvoicesQueryDto) {
    const { page, limit, from, to, numero, statut, guestId, stayId, roomId } =
      query;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const where: Prisma.InvoiceWhereInput = {};
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }
    if (numero) where.numero = { contains: numero };
    if (statut) where.statut = statut;
    if (guestId || stayId || roomId) {
      where.folio = {
        stay: {
          ...(guestId ? { guestId } : {}),
          ...(stayId ? { id: stayId } : {}),
          ...(roomId ? { roomId } : {}),
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          numero: true,
          montantTotal: true,
          statut: true,
          createdAt: true,
          folio: {
            select: {
              id: true,
              stay: {
                select: {
                  id: true,
                  guest: { select: { id: true, nom: true, prenom: true } },
                  room: { select: { id: true, numero: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }

  // DESIGN-010 — GET /stays/facturables. Définition v1 gelée (mission §5) :
  // Stay.statut = CHECKOUT ET aucune Invoice EMISE active sur son/ses
  // folio(s) (une facture ANNULEE_PAR_AVOIR ne bloque jamais une nouvelle
  // facturation — `none: { invoices: { some: { statut: EMISE } } }` exclut
  // donc bien uniquement les folios encore couverts par une facture
  // active).
  //
  // Champ de période choisi : Stay.dateCheckoutReelle (jamais
  // dateCheckoutPrevue, qui reste une prévision, ni Folio.createdAt, qui
  // date de l'ouverture du folio — au check-in, bien avant que le séjour ne
  // devienne facturable). dateCheckoutReelle est renseigné exactement au
  // moment où StayService.checkout() fait passer Stay.statut à CHECKOUT
  // (même transaction) — c'est donc la seule date qui correspond
  // exactement à "quand ce séjour est devenu facturable".
  async findStaysFacturables(query: ListStaysFacturablesQueryDto) {
    const { page, limit, from, to, guestId, roomId } = query;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const where: Prisma.StayWhereInput = {
      statut: 'CHECKOUT',
      folios: { none: { invoices: { some: { statut: 'EMISE' } } } },
      ...(guestId ? { guestId } : {}),
      ...(roomId ? { roomId } : {}),
    };
    if (from || to) {
      where.dateCheckoutReelle = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [stays, total] = await Promise.all([
      this.prisma.stay.findMany({
        where,
        skip,
        take,
        orderBy: { dateCheckoutReelle: 'desc' },
        select: {
          id: true,
          dateCheckin: true,
          dateCheckoutPrevue: true,
          dateCheckoutReelle: true,
          guest: { select: { id: true, nom: true, prenom: true } },
          room: { select: { id: true, numero: true } },
          folios: {
            select: {
              id: true,
              lignes: {
                select: { type: true, montant: true, annulee: true },
              },
            },
          },
        },
      }),
      this.prisma.stay.count({ where }),
    ]);

    // Total facturable — même formule que BillingService.generateInvoice
    // appliquerait sur ces lignes (calculateInvoiceTotal), jamais une
    // seconde formule financière inventée pour cet écran (mission §6.D).
    // N'inclut pas d'éventuelles taxes de séjour encore à matérialiser pour
    // un séjour legacy (Stay.nombreOccupants IS NULL, cf.
    // generateInvoice) — limitation acceptée, ce total reste indicatif tant
    // que la facture n'est pas réellement générée.
    const data = stays.map((stay) => {
      const totalFacturable = stay.folios.reduce(
        (acc, folio) =>
          acc.add(
            calculateInvoiceTotal(folio.lignes as unknown as FolioLine[]),
          ),
        new Prisma.Decimal(0),
      );
      return { ...stay, totalFacturable: totalFacturable.toFixed(2) };
    });

    return {
      data,
      meta: { page, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }

  // DESIGN-010 — bande de KPI du Billing Center. Formules gelées par la
  // mission (§6) :
  //   A. Factures aujourd'hui = COUNT(Invoice créée aujourd'hui), toute
  //      facture confondue (EMISE ou déjà ANNULEE_PAR_AVOIR — l'émission a
  //      bien eu lieu aujourd'hui, ce compteur d'activité n'est pas un
  //      indicateur de CA).
  //   B. CA facturé = SUM(Invoice.montantTotal) sur la période demandée,
  //      EXCLUT les factures ANNULEE_PAR_AVOIR (préférence produit
  //      explicite, mission §6.B).
  //   C. À facturer = COUNT(résultat de findStaysFacturables), mêmes
  //      filtres from/to/guestId/roomId.
  //   D. À encaisser = SUM(computeSoldeDu par folio, folios à solde
  //      positif) — jamais une formule financière divergente (mission
  //      §6.D exige de réutiliser computeSoldeDu). Périmètre volontairement
  //      borné (voir commentaire ci-dessous) plutôt que de charger tous les
  //      folios existants de l'hôtel.
  async getKpis(from?: string, to?: string) {
    const { today, tomorrow } = getTodayRange();
    const period: { gte?: Date; lte?: Date } = {};
    if (from) period.gte = new Date(from);
    if (to) period.lte = new Date(to);
    const hasPeriod = Boolean(from || to);

    const [facturesAujourdhui, invoicesActivesPeriode, staysFacturables] =
      await Promise.all([
        this.prisma.invoice.count({
          where: { createdAt: { gte: today, lt: tomorrow } },
        }),
        this.prisma.invoice.findMany({
          where: {
            statut: 'EMISE',
            ...(hasPeriod ? { createdAt: period } : {}),
          },
          select: { montantTotal: true },
        }),
        this.findStaysFacturables({
          from,
          to,
          page: 1,
          limit: 1,
        }),
      ]);

    const caFacture = invoicesActivesPeriode.reduce(
      (acc, i) => acc.add(i.montantTotal),
      new Prisma.Decimal(0),
    );

    // À encaisser — périmètre réel couvert (documenté, mission §6.D) :
    // uniquement les folios des séjours EN_COURS (dette active en cours de
    // séjour) et des séjours CHECKOUT dont le départ réel remonte à moins
    // de 30 jours (fenêtre de recouvrement usuelle pour un solde résiduel
    // post-séjour). Un solde positif oublié sur un séjour clôturé il y a
    // plus de 30 jours n'apparaît PAS dans ce total — parcourir tous les
    // folios de l'historique complet de l'hôtel à chaque affichage du
    // tableau de bord n'est pas une requête raisonnable pour ce projet
    // (aucune agrégation SQL du solde n'existe : computeSoldeDu s'applique
    // en mémoire sur les FolioLine chargées, jamais recalculée en SQL,
    // CLAUDE.md règle 3).
    const trenteJoursAvant = new Date(today);
    trenteJoursAvant.setUTCDate(trenteJoursAvant.getUTCDate() - 30);
    const foliosPourEncaisser = await this.prisma.folio.findMany({
      where: {
        stay: {
          OR: [
            { statut: 'EN_COURS' },
            {
              statut: 'CHECKOUT',
              dateCheckoutReelle: { gte: trenteJoursAvant },
            },
          ],
        },
      },
      select: {
        lignes: { select: { type: true, montant: true, annulee: true } },
      },
    });
    const aEncaisser = foliosPourEncaisser.reduce((acc, folio) => {
      const solde = computeSoldeDu([folio]);
      return solde.gt(0) ? acc.add(solde) : acc;
    }, new Prisma.Decimal(0));

    return {
      facturesAujourdhui,
      caFacture: caFacture.toFixed(2),
      aFacturer: staysFacturables.meta.total,
      aEncaisser: aEncaisser.toFixed(2),
    };
  }
}
