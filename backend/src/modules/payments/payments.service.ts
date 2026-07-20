import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

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
  async createPayment(dto: CreatePaymentDto) {
    const montantDecimal = new Prisma.Decimal(dto.montant);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            folioId: dto.folioId,
            invoiceId: dto.invoiceId ?? null,
            moyen: dto.moyen,
            montant: montantDecimal,
            idempotencyKey: dto.idempotencyKey,
          },
        });

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
        // La clé idempotence existe déjà : la transaction ci-dessus a été
        // annulée avant toute écriture (Payment ET FolioLine), on retourne
        // simplement le paiement existant sans rien recréer.
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

  async findById(id: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException(`Paiement ${id} introuvable.`);
    }
    return payment;
  }
}
