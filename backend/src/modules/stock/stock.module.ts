import { Module } from '@nestjs/common';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { NettoyageValideListener } from './listeners/nettoyage-valide.listener';
import { RoomsModule } from '../rooms/rooms.module';

// Un seul import d'autre module métier — `rooms`, explicitement autorisé
// (docs/modules/stock.md §10 : « valider que le lieu physique de
// destination ou de retrait d'articles correspond à une chambre réelle et
// existante ») depuis CH-039 (validation de `roomId` sur la sortie
// manuelle). Toujours interdit : housekeeping/billing/payments/guests/
// reservations/hr (§11). Le découplage avec housekeeping passe
// exclusivement par l'événement nettoyage.valide (NettoyageValideListener),
// jamais par un import de HousekeepingModule.
@Module({
  imports: [RoomsModule],
  controllers: [StockController],
  providers: [StockService, NettoyageValideListener],
  exports: [StockService],
})
export class StockModule {}
