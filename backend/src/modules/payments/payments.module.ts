import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { BillingModule } from '../billing/billing.module';
import { AuditModule } from '../audit/audit.module';

// docs/modules/payments.md §10 : payments n'a le droit de dépendre que de
// billing (pour injecter la ligne créditrice via BillingService.creditFolioLine)
// — AuditModule s'ajoute ici au même titre que dans parameters/hr/police,
// pour la traçabilité des acomptes (CREATE_DEPOSIT/REFUND_DEPOSIT).
// DepositsService ne lit jamais Reservation directement : une réservation
// inexistante échoue nativement sur la contrainte de clé étrangère.
@Module({
  imports: [BillingModule, AuditModule],
  controllers: [PaymentsController, DepositsController],
  providers: [PaymentsService, DepositsService],
})
export class PaymentsModule {}
