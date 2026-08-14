import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MoyenPaiement, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { computeSoldeDu } from '../stay/utils/solde';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  // Créer un paiement avec vérification idempotence via idempotencyKey.
  // Règle non négociable : envoi deux fois la même requête avec la même
  // clé → un seul paiement créé, une seule ligne créditrice (pas de
  // double-encaissement). Le crédit du folio (docs/modules/payments.md §2 :
  // "imputation créditrice automatique sur les folios") passe exclusivement
  // par BillingService.creditFolioLine, jamais par une écriture Prisma
  // directe sur FolioLine — payments ne dépend que de billing (§10).
  //
  // PAY-001B — correctif d'un incident réel de production (voir rapport
  // PAY-001A) : aucun contrôle de solde n'existait avant cette mission, un
  // paiement était accepté et persisté quel que soit son montant, même sur
  // un folio déjà entièrement réglé. Ordre transactionnel strict imposé par
  // le correctif validé (ne pas réordonner) :
  //   1. idempotencyKey traitée en tout premier (pré-check hors transaction,
  //      filet de sécurité P2002 en cas de course résiduelle) — le
  //      comportement de rejeu existant, déjà testé, doit rester intact : un
  //      rejeu de la même clé sur un folio désormais soldé renvoie le
  //      paiement déjà créé, jamais une PAYMENT_NOT_REQUIRED
  //   2. verrou du Folio ciblé (SELECT ... FOR UPDATE)
  //   3. verrou de ses FolioLine actives
  //   4. recalcul du solde via computeSoldeDu (jamais une formule dupliquée)
  //   5. gardes OVERPAYMENT / PAYMENT_NOT_REQUIRED
  //   6. création du Payment
  //   7. création de la FolioLine PAIEMENT (creditFolioLine, inchangé)
  async createPayment(dto: CreatePaymentDto) {
    const montantDecimal = new Prisma.Decimal(dto.montant);

    // 1. idempotencyKey traitée en premier, avant tout verrou/garde — un
    // rejeu de la même requête (même clé) après qu'un paiement a déjà
    // ramené le solde à 0 doit renvoyer le paiement existant tel quel,
    // jamais être intercepté par la garde PAYMENT_NOT_REQUIRED ci-dessous
    // (qui, elle, ne s'applique qu'à une NOUVELLE tentative de paiement).
    const existingByKey = await this.prisma.payment.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existingByKey) {
      return existingByKey;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 2. Verrou du Folio ciblé — même convention que
        // StayService (extend-stay/checkout) : un INSERT FolioLine (paiement
        // concurrent ou charge ajoutée via addFolioLine) prend un verrou
        // implicite sur la ligne parente Folio pour la vérification de
        // contrainte FK, donc est sérialisé tant que ce FOR UPDATE tient la
        // transaction.
        const lockedFolio = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM Folio WHERE id = ${dto.folioId} FOR UPDATE
        `;
        if (lockedFolio.length === 0) {
          throw new NotFoundException(`Folio ${dto.folioId} introuvable.`);
        }

        // 3. Verrou explicite des FolioLine existantes du folio — un INSERT
        // seul (verrou implicite ci-dessus) ne bloque pas une annulation
        // concurrente d'une ligne existante (BillingService.cancelFolioLine
        // fait un UPDATE FolioLine.annulee, aucune vérification de
        // contrainte FK déclenchée, donc non couvert par le seul verrou
        // Folio) — même raisonnement documenté dans
        // StayService.runExtendStayTransaction. Sans ce verrou, une
        // annulation de charge concurrente pourrait changer le solde entre
        // notre lecture et le commit sans être bloquée.
        await tx.$queryRaw`
          SELECT id FROM FolioLine WHERE folioId = ${dto.folioId} FOR UPDATE
        `;

        // 4. Solde recalculé sous verrou, sur ce seul folio — même périmètre
        // que celui affiché à l'agent (BillingService.findFolioById /
        // RecordPaymentDialog, computeFolioSummary([folio])), jamais un
        // second calcul indépendant.
        const folio = await tx.folio.findUnique({
          where: { id: dto.folioId },
          include: { lignes: true },
        });
        if (!folio) {
          throw new NotFoundException(`Folio ${dto.folioId} introuvable.`);
        }
        const soldeDu = computeSoldeDu([folio]);

        // 5. Gardes — la validation DTO garantit déjà montant > 0.
        if (soldeDu.lte(0)) {
          throw new ConflictException({
            code: 'PAYMENT_NOT_REQUIRED',
            message:
              "Ce dossier est déjà entièrement réglé, aucun paiement supplémentaire n'est requis.",
            balanceTTC: soldeDu.lt(0) ? '0.00' : soldeDu.toFixed(2),
          });
        }
        if (montantDecimal.gt(soldeDu)) {
          throw new ConflictException({
            code: 'OVERPAYMENT',
            message: `Le montant saisi (${montantDecimal.toFixed(2)} MAD) dépasse le reste à payer (${soldeDu.toFixed(2)} MAD).`,
            balanceTTC: soldeDu.toFixed(2),
            montantDemande: montantDecimal.toFixed(2),
          });
        }

        // 6. Création du Payment.
        const payment = await tx.payment.create({
          data: {
            folioId: dto.folioId,
            invoiceId: dto.invoiceId ?? null,
            moyen: dto.moyen,
            montant: montantDecimal,
            idempotencyKey: dto.idempotencyKey,
          },
        });

        // 7. Ligne créditrice PAIEMENT — comportement interne inchangé
        // (assertFolioWritable y vérifie toujours le statut du séjour).
        await this.billingService.creditFolioLine(
          dto.folioId,
          montantDecimal,
          `Règlement ${dto.moyen}`,
          tx,
        );

        return payment;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Filet de sécurité pour la course résiduelle entre le pré-check de
        // l'étape 1 (hors verrou) et l'insertion : deux requêtes concurrentes
        // portant la même idempotencyKey peuvent toutes deux passer le
        // pré-check avant qu'aucune n'ait committé. La contrainte unique DB
        // sur Payment.idempotencyKey tranche : la transaction perdante est
        // annulée avant toute écriture (Payment ET FolioLine), on retourne
        // simplement le paiement déjà créé par la gagnante, sans rien
        // recréer.
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

  // GL-003B — écriture financière déléguée par StayService.createExtensionDeposit
  // (POST /stays/:id/extension-deposit, avance bornée de prolongation).
  // Distincte de createPayment à dessein : le montant est ici déjà calculé
  // et pré-autorisé par l'appelant (StayService.computeExtensionPricing +
  // computeSoldeDu sous verrou) — jamais fourni par le client, donc les
  // gardes OVERPAYMENT/PAYMENT_NOT_REQUIRED de createPayment ne s'appliquent
  // pas ici. `tx` est obligatoire et n'est JAMAIS une nouvelle transaction :
  // l'appelant détient déjà les verrous FOR UPDATE (Stay/Room/RoomNight/
  // Folio/FolioLine) nécessaires à l'atomicité de ce calcul — ouvrir une
  // seconde transaction ici casserait cette garantie. L'idempotence
  // (pré-check par idempotencyKey, filet P2002) reste de la responsabilité
  // de l'appelant, exactement comme createPayment le fait pour la sienne.
  async createExtensionDeposit(
    folioId: number,
    moyen: MoyenPaiement,
    montant: Prisma.Decimal,
    idempotencyKey: string,
    reference: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    const payment = await tx.payment.create({
      data: {
        folioId,
        moyen,
        montant,
        idempotencyKey,
      },
    });

    await this.billingService.creditFolioLine(
      folioId,
      montant,
      reference
        ? `Avance prolongation ${moyen} — ${reference}`
        : `Avance prolongation ${moyen}`,
      tx,
    );

    return payment;
  }

  async findById(id: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException(`Paiement ${id} introuvable.`);
    }
    return payment;
  }

  // DESIGN-010 (Billing Center) — GET /payments, registre global paginé.
  // Date filtrée sur Payment.createdAt (date d'encaissement). Jamais de
  // champ "encaissé par" (Payment n'a pas de userId fiable, mission §4) —
  // sélection volontairement étroite, alignée sur ce que l'écran affiche
  // réellement (client/séjour/chambre/moyen/montant/facture liée).
  async findPaginated(query: ListPaymentsQueryDto) {
    const { page, limit, from, to, moyen, folioId, invoiceId, guestId } = query;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const where: Prisma.PaymentWhereInput = { deletedAt: null };
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }
    if (moyen) where.moyen = moyen;
    if (folioId) where.folioId = folioId;
    if (invoiceId) where.invoiceId = invoiceId;
    if (guestId) where.folio = { stay: { guestId } };

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          moyen: true,
          montant: true,
          createdAt: true,
          folioId: true,
          invoiceId: true,
          invoice: { select: { id: true, numero: true } },
          folio: {
            select: {
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
      this.prisma.payment.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }
}
