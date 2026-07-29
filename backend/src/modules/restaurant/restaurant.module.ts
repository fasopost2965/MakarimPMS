import { Module } from '@nestjs/common';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { StayModule } from '../stay/stay.module';
import { BillingModule } from '../billing/billing.module';
import { AuditModule } from '../audit/audit.module';

// F11 (CH-056, RD-025) — dépendances autorisées limitées à StayModule
// (façade lecture) et BillingModule (façade écriture), voir
// docs/governance/REGISTRE_DECISIONS.md RD-025.
@Module({
  imports: [StayModule, BillingModule, AuditModule],
  controllers: [RestaurantController],
  providers: [RestaurantService],
})
export class RestaurantModule {}
