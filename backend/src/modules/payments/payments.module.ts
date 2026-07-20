import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BillingModule } from '../billing/billing.module';

// docs/modules/payments.md §10 : payments n'a le droit de dépendre que de
// billing (pour injecter la ligne créditrice via BillingService.creditFolioLine).
@Module({
  imports: [BillingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
