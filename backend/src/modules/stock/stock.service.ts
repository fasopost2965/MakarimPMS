import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ReplenishStockDto } from './dto/replenish-stock.dto';
import { estSousSeuilAlerte } from './utils/seuil-alerte.util';
import { StockThresholdAlertEvent } from './events/stock-threshold-alert.event';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll() {
    const items = await this.prisma.stockItem.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    });
    return items.map((item) => ({
      ...item,
      sousSeuilAlerte: estSousSeuilAlerte(item),
    }));
  }

  findMovements(stockItemId?: number) {
    return this.prisma.stockMovement.findMany({
      where: { stockItemId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Réassort manuel (livraison fournisseur) — toujours une ENTREE, jamais de
  // vérification de non-négativité nécessaire (une entrée ne peut
  // qu'augmenter le stock).
  async replenish(dto: ReplenishStockDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.findUnique({
        where: { id: dto.stockItemId },
      });
      if (!item || item.deletedAt) {
        throw new NotFoundException(
          `Article de stock ${dto.stockItemId} introuvable.`,
        );
      }

      const updated = await tx.stockItem.update({
        where: { id: dto.stockItemId },
        data: { quantiteDisponible: { increment: dto.quantite } },
      });

      await tx.stockMovement.create({
        data: {
          stockItemId: dto.stockItemId,
          typeMouvement: 'ENTREE',
          quantite: dto.quantite,
          motif: dto.motif,
          referenceFournisseur: dto.referenceFournisseur,
          userId,
        },
      });

      return { ...updated, sousSeuilAlerte: estSousSeuilAlerte(updated) };
    });
  }

  // BR-STK-001 : décompte automatique du kit d'accueil (1 unité par article
  // kitAccueil, par occupant théorique de la chambre) déclenché par
  // NettoyageValideListener. Isolé article par article : l'échec d'un
  // article (ex. rupture totale, INV-STK-001) n'empêche jamais le décompte
  // des autres, et ne remonte jamais au flux de ménage appelant
  // (SPRINT_12.md §5 — voir HousekeepingService.updateStatus, emit() non
  // attendu).
  async decompterKitAccueil(roomId: number, capaciteChambre: number) {
    const kitItems = await this.prisma.stockItem.findMany({
      where: { kitAccueil: true, deletedAt: null },
    });

    for (const item of kitItems) {
      try {
        await this.sortir(
          item.id,
          capaciteChambre,
          `Décompte automatique — nettoyage validé, chambre ${roomId} (capacité ${capaciteChambre})`,
          { roomId },
        );
      } catch (error) {
        this.logger.warn(
          `Décompte automatique impossible pour l'article "${item.code}" (chambre ${roomId}) : ${(error as Error).message}`,
        );
      }
    }
  }

  // Sortie de stock générique (INV-STK-001 : quantité jamais négative).
  // Utilisée à la fois par le décompte automatique (roomId renseigné, pas
  // de userId — aucun auteur humain direct) et par une future sortie
  // manuelle. Émet StockThresholdAlertEvent (BR-STK-002) si le nouveau
  // niveau franchit le seuil.
  private async sortir(
    stockItemId: number,
    quantite: number,
    motif: string,
    opts: { userId?: number; roomId?: number } = {},
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.findUnique({
        where: { id: stockItemId },
      });
      if (!item || item.deletedAt) {
        throw new NotFoundException(
          `Article de stock ${stockItemId} introuvable.`,
        );
      }

      const nouvelleQuantite = item.quantiteDisponible - quantite;
      if (nouvelleQuantite < 0) {
        throw new BadRequestException(
          `Stock insuffisant pour "${item.libelle}" (disponible ${item.quantiteDisponible}, demandé ${quantite}) — INV-STK-001.`,
        );
      }

      const result = await tx.stockItem.update({
        where: { id: stockItemId },
        data: { quantiteDisponible: nouvelleQuantite },
      });

      await tx.stockMovement.create({
        data: {
          stockItemId,
          typeMouvement: 'SORTIE',
          quantite,
          motif,
          userId: opts.userId,
          roomId: opts.roomId,
        },
      });

      return result;
    });

    if (estSousSeuilAlerte(updated)) {
      await this.eventEmitter.emitAsync(
        'stock.seuil_critique',
        new StockThresholdAlertEvent(
          updated.id,
          updated.code,
          updated.quantiteDisponible,
          updated.seuilAlerte,
        ),
      );
    }

    return updated;
  }
}
