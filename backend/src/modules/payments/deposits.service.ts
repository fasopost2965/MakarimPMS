import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatutAcompte } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateReservationDepositDto } from './dto/create-reservation-deposit.dto';
import { RembourserDepositDto } from './dto/rembourser-deposit.dto';

// Acomptes versés à la réservation (avant l'existence d'un séjour/folio).
// reservationId n'est jamais vérifié via une lecture directe de la table
// Reservation (payments ne dépend que de billing, docs/modules/payments.md
// §10) — une réservation inexistante échoue nativement sur la contrainte de
// clé étrangère (P2002/P2003, traduits en réponse HTTP propre par
// AllExceptionsFilter).
@Injectable()
export class DepositsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // Idempotence : même pattern que PaymentsService.createPayment (clé
  // unique, on renvoie l'acompte existant plutôt que de lever une erreur).
  async create(
    reservationId: number,
    dto: CreateReservationDepositDto,
    userId?: number,
  ) {
    const montantDecimal = new Prisma.Decimal(dto.montant);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const deposit = await tx.reservationDeposit.create({
          data: {
            reservationId,
            montant: montantDecimal,
            moyen: dto.moyen,
            statut: dto.statut ?? StatutAcompte.ENCAISSE,
            idempotencyKey: dto.idempotencyKey,
          },
        });

        await this.auditService.writeLog(tx, {
          userId,
          action: 'CREATE_DEPOSIT',
          targetEntity: 'RESERVATION_DEPOSIT',
          targetId: deposit.id,
          newValue: deposit,
          motif: `Enregistrement d'un acompte de ${dto.montant} MAD (réservation ${reservationId}).`,
        });

        return deposit;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.reservationDeposit.findUnique({
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

  findByReservation(reservationId: number) {
    return this.prisma.reservationDeposit.findMany({
      where: { reservationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  // "admin seulement" : payments:write (décorateur, guard générique) ouvre la
  // route, mais rembourser de l'argent déjà encaissé exige en plus la
  // permission dédiée payments:refund (réservée à l'Administrateur dans
  // prisma/seed.ts) — vérifiée manuellement ici, même pattern que
  // GuestsService.updateCategorie/guests:blacklist (contenu de l'action, pas
  // exprimable par le décorateur statique).
  async rembourser(
    reservationId: number,
    depositId: number,
    dto: RembourserDepositDto,
    userId?: number,
    roleId?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const grant = await tx.permission.findFirst({
        where: {
          module: 'payments',
          action: 'refund',
          roles: { some: { roleId } },
        },
      });
      if (!grant) {
        throw new ForbiddenException('Permission requise : payments:refund.');
      }

      const deposit = await tx.reservationDeposit.findUnique({
        where: { id: depositId },
      });
      if (
        !deposit ||
        deposit.reservationId !== reservationId ||
        deposit.deletedAt
      ) {
        throw new NotFoundException(
          `Acompte ${depositId} introuvable pour la réservation ${reservationId}.`,
        );
      }
      if (deposit.statut === StatutAcompte.IMPUTE) {
        throw new ConflictException(
          'Cet acompte a déjà été imputé à un folio — le remboursement passe désormais par une note de crédit sur la facture, pas par cette route.',
        );
      }
      if (deposit.statut === StatutAcompte.REMBOURSE) {
        throw new ConflictException('Cet acompte est déjà remboursé.');
      }

      const updated = await tx.reservationDeposit.update({
        where: { id: depositId },
        data: { statut: StatutAcompte.REMBOURSE },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: 'REFUND_DEPOSIT',
        targetEntity: 'RESERVATION_DEPOSIT',
        targetId: depositId,
        oldValue: { statut: deposit.statut },
        newValue: { statut: updated.statut },
        motif: dto.motif,
      });

      return updated;
    });
  }
}
