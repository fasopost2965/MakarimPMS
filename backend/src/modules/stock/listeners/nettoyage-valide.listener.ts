import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StockService } from '../stock.service';
import { NettoyageValideEvent } from '../../housekeeping/events/nettoyage-valide.event';

// Concrétise BR-STK-001. try/catch en plus de celui déjà présent dans
// StockService.decompterKitAccueil (défense en profondeur) : HousekeepingService
// utilise emit() (non attendu) — une exception non interceptée ici
// deviendrait une unhandled promise rejection au niveau du process Node,
// ce qui est strictement pire que l'isolation recherchée par SPRINT_12.md §5.
@Injectable()
export class NettoyageValideListener {
  private readonly logger = new Logger(NettoyageValideListener.name);

  constructor(private readonly stockService: StockService) {}

  @OnEvent('nettoyage.valide')
  async handle(event: NettoyageValideEvent) {
    try {
      await this.stockService.decompterKitAccueil(
        event.roomId,
        event.capaciteChambre,
      );
    } catch (error) {
      this.logger.warn(
        `Décompte de stock automatique en échec pour la chambre ${event.roomId} : ${(error as Error).message}`,
      );
    }
  }
}
