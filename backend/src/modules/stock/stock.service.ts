import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { ReplenishStockDto } from './dto/replenish-stock.dto';
import { ManualStockOutDto } from './dto/manual-stock-out.dto';
import { estSousSeuilAlerte } from './utils/seuil-alerte.util';
import { StockThresholdAlertEvent } from './events/stock-threshold-alert.event';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly roomsService: RoomsService,
  ) {}

  async findAll() {
    const items = await this.prisma.stockItem.findMany({
      orderBy: { code: 'asc' },
    });
    return items.map((item) => ({
      ...item,
      sousSeuilAlerte: estSousSeuilAlerte(item),
    }));
  }

  // Façade en lecture seule pour un module tiers (Lot 8, purchase-orders)
  // qui a besoin de vérifier qu'un stockItemId référencé sur une ligne de
  // bon de commande existe réellement — jamais de Prisma direct sur
  // StockItem depuis un autre module (CLAUDE.md, frontières de module).
  async findByIdOrThrow(id: number) {
    const item = await this.prisma.stockItem.findUnique({ where: { id } });
    if (!item || item.deletedAt) {
      throw new NotFoundException(`Article de stock ${id} introuvable.`);
    }
    return item;
  }

  // CH-052 (docs/execution/PLAN_FRONTEND_PARITE_ADMIN.md §2) — inclut
  // l'article/la chambre pour affichage lisible côté frontend (libellé,
  // numéro de chambre) plutôt que de forcer un second aller-retour réseau
  // par mouvement ; lecture seule, aucun changement de contrat d'écriture.
  findMovements(stockItemId?: number) {
    return this.prisma.stockMovement.findMany({
      where: { stockItemId },
      orderBy: { createdAt: 'desc' },
      include: { stockItem: true, room: true },
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

  // Traite les intentions durables créées par HousekeepingTaskService.validate.
  // L'événement qui appelle cette méthode n'est qu'un accélérateur : un rejeu
  // ne traite que les lignes PENDING, et une ligne DONE est toujours un no-op.
  async processHousekeepingCycle(housekeepingTaskId: number, cycle: number) {
    const pending = await this.prisma.housekeepingStockConsumption.findMany({
      where: {
        housekeepingTaskId,
        cycle,
        statut: 'PENDING',
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    for (const consumption of pending) {
      await this.processHousekeepingConsumption(consumption.id);
    }
  }

  private async processHousekeepingConsumption(consumptionId: number) {
    // Resolve the room before opening the mutation transaction. Keeping the
    // task relation out of the locked section avoids a Room-first lifecycle
    // transition deadlock while preserving the durable consumption lock.
    const context = await this.prisma.housekeepingStockConsumption.findUnique({
      where: { id: consumptionId },
      select: { housekeepingTask: { select: { roomId: true } } },
    });
    if (!context) return;
    const roomId = context.housekeepingTask.roomId;
    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: number;
          housekeepingTaskId: number;
          cycle: number;
          stockItemId: number;
          quantite: number;
          statut: string;
        }>
      >`
        SELECT id, housekeepingTaskId, cycle, stockItemId, quantite, statut
        FROM HousekeepingStockConsumption
        WHERE id = ${consumptionId}
        FOR UPDATE
      `;
      const consumption = rows[0];
      if (
        !consumption ||
        consumption.statut === 'DONE' ||
        consumption.statut === 'FAILED'
      ) {
        return null;
      }

      const items = await tx.$queryRaw<
        Array<{
          id: number;
          code: string;
          libelle: string;
          quantiteDisponible: number;
          seuilAlerte: number;
          uniteMesure: string;
          kitAccueil: boolean;
          deletedAt: Date | null;
        }>
      >`
        SELECT id, code, libelle, quantiteDisponible, seuilAlerte,
               uniteMesure, kitAccueil, deletedAt
        FROM StockItem
        WHERE id = ${consumption.stockItemId}
        FOR UPDATE
      `;
      const item = items[0];
      if (!item || item.deletedAt) {
        throw new NotFoundException(
          `Article de stock ${consumption.stockItemId} introuvable.`,
        );
      }

      if (item.quantiteDisponible < consumption.quantite) {
        await tx.housekeepingStockConsumption.update({
          where: { id: consumption.id },
          data: {
            statut: 'FAILED',
            erreur: `Stock insuffisant pour ${item.code}.`,
            processedAt: new Date(),
          },
        });
        return null;
      }

      const updated = await tx.stockItem.update({
        where: { id: item.id },
        data: {
          quantiteDisponible: item.quantiteDisponible - consumption.quantite,
        },
      });

      await tx.stockMovement.create({
        data: {
          stockItemId: item.id,
          typeMouvement: 'SORTIE',
          quantite: consumption.quantite,
          motif: `Décompte automatique — nettoyage validé, tâche ${consumption.housekeepingTaskId}, cycle ${consumption.cycle}`,
          roomId,
          housekeepingStockConsumptionId: consumption.id,
        },
      });

      await tx.housekeepingStockConsumption.update({
        where: { id: consumption.id },
        data: {
          statut: 'DONE',
          erreur: null,
          processedAt: new Date(),
        },
      });

      return updated;
    });

    if (result && estSousSeuilAlerte(result)) {
      await this.eventEmitter.emitAsync(
        'stock.seuil_critique',
        new StockThresholdAlertEvent(
          result.id,
          result.code,
          result.quantiteDisponible,
          result.seuilAlerte,
        ),
      );
    }
  }

  // CH-039 (docs/modules/stock.md §8) — sortie manuelle déclarée par un
  // humain : réfection de chambre (linge/produits d'accueil), consommation
  // minibar à l'inspection de départ, ou constat de perte/casse/péremption
  // (BR-STK-003, motif écrit toujours exigé par le DTO). roomId validé via
  // la façade RoomsService (dépendance explicitement autorisée, stock.md
  // §10) plutôt qu'une FK Prisma nue — un roomId invalide renvoie un 404
  // clair plutôt qu'une erreur de contrainte opaque.
  async manualStockOut(dto: ManualStockOutDto, userId: number) {
    if (dto.roomId !== undefined) {
      await this.roomsService.findByIdOrThrow(dto.roomId);
    }

    const updated = await this.sortir(
      dto.stockItemId,
      dto.quantite,
      dto.motif,
      {
        userId,
        roomId: dto.roomId,
      },
    );

    return { ...updated, sousSeuilAlerte: estSousSeuilAlerte(updated) };
  }

  // Sortie de stock générique (INV-STK-001 : quantité jamais négative).
  // Utilisée à la fois par le décompte automatique (roomId renseigné, pas
  // de userId — aucun auteur humain direct) et par la sortie manuelle
  // ci-dessus. Émet StockThresholdAlertEvent (BR-STK-002) si le nouveau
  // niveau franchit le seuil.
  private async sortir(
    stockItemId: number,
    quantite: number,
    motif: string,
    opts: { userId?: number; roomId?: number } = {},
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const items = await tx.$queryRaw<
        Array<{
          id: number;
          libelle: string;
          quantiteDisponible: number;
        }>
      >`
        SELECT id, libelle, quantiteDisponible
        FROM StockItem
        WHERE id = ${stockItemId} AND deletedAt IS NULL
        FOR UPDATE
      `;
      const item = items[0];
      if (!item) {
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
