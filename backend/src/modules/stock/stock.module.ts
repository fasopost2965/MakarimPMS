import { Module } from '@nestjs/common';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { NettoyageValideListener } from './listeners/nettoyage-valide.listener';

// Aucun import d'autre module métier (docs/modules/stock.md §10/§11 :
// dépendance autorisée à `rooms` uniquement, interdite à housekeeping/
// billing/payments/guests/reservations/hr). Le découplage avec
// housekeeping passe exclusivement par l'événement nettoyage.valide
// (NettoyageValideListener), jamais par un import de HousekeepingModule.
@Module({
  controllers: [StockController],
  providers: [StockService, NettoyageValideListener],
  exports: [StockService],
})
export class StockModule {}
