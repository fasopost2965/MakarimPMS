import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ReplenishStockDto } from './dto/replenish-stock.dto';
import { LaundryMovementDto } from './dto/laundry-movement.dto';
import { UpdateRoomDotationDto } from './dto/room-dotation.dto';
import { RoomLinenChangeDto } from './dto/room-linen-change.dto';
import { estSousSeuilAlerte } from './utils/seuil-alerte.util';
import { StockThresholdAlertEvent } from './events/stock-threshold-alert.event';

export type StockCategory = 'LINGERIE' | 'EQUIPEMENT' | 'KIT_ACCUEIL';

export interface RoomTypeDotationConfig {
  roomTypeId: number;
  roomTypeName: string;
  items: {
    stockItemId: number;
    code: string;
    libelle: string;
    categorie: StockCategory;
    quantiteDotation: number;
    uniteMesure: string;
  }[];
}

// Suivi en mémoire de la lingerie sale en buanderie / blanchisserie
const dirtyLinenInLaundry: Record<number, number> = {};

// Dotations personnalisées en mémoire par type de chambre
const customDotations: Record<number, Record<number, number>> = {};

const DEFAULT_ITEMS_CATALOG = [
  // LINGERIE
  {
    code: 'LINGE-DRAP-01',
    libelle: 'Drap housse Grand Lit (140x190/160x200)',
    quantiteDisponible: 80,
    seuilAlerte: 20,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'LINGERIE' as StockCategory,
  },
  {
    code: 'LINGE-DRAP-02',
    libelle: 'Drap housse Lit Simple (90x190)',
    quantiteDisponible: 50,
    seuilAlerte: 15,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'LINGERIE' as StockCategory,
  },
  {
    code: 'LINGE-TAIE-01',
    libelle: 'Taie d\'oreiller Coton Supérieur (50x70)',
    quantiteDisponible: 140,
    seuilAlerte: 30,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'LINGERIE' as StockCategory,
  },
  {
    code: 'LINGE-COUV-01',
    libelle: 'Couette / Couvre-lit Douillet Grand Lit',
    quantiteDisponible: 35,
    seuilAlerte: 10,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'LINGERIE' as StockCategory,
  },
  {
    code: 'LINGE-COUV-02',
    libelle: 'Couette / Couvre-lit Lit Simple',
    quantiteDisponible: 25,
    seuilAlerte: 8,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'LINGERIE' as StockCategory,
  },
  {
    code: 'LINGE-SERV-01',
    libelle: 'Drap de bain Éponge Moelleux (70x140)',
    quantiteDisponible: 110,
    seuilAlerte: 25,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'LINGERIE' as StockCategory,
  },
  {
    code: 'LINGE-SERV-02',
    libelle: 'Serviette visage & mains (50x90)',
    quantiteDisponible: 90,
    seuilAlerte: 20,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'LINGERIE' as StockCategory,
  },
  {
    code: 'LINGE-TAPIS-01',
    libelle: 'Tapis de sortie de bain',
    quantiteDisponible: 45,
    seuilAlerte: 12,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'LINGERIE' as StockCategory,
  },
  {
    code: 'LINGE-PEIGN-01',
    libelle: 'Peignoir de luxe Nid d\'abeille',
    quantiteDisponible: 25,
    seuilAlerte: 6,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'LINGERIE' as StockCategory,
  },

  // MATERIEL & EQUIPEMENTS
  {
    code: 'EQP-FRIGO-01',
    libelle: 'Mini-Réfrigérateur Silencieux 40L',
    quantiteDisponible: 26,
    seuilAlerte: 2,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'EQUIPEMENT' as StockCategory,
  },
  {
    code: 'EQP-TV-01',
    libelle: 'Téléviseur Smart LED 43"',
    quantiteDisponible: 28,
    seuilAlerte: 2,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'EQUIPEMENT' as StockCategory,
  },
  {
    code: 'EQP-COFFRE-01',
    libelle: 'Coffre-Fort Électronique à Code',
    quantiteDisponible: 25,
    seuilAlerte: 2,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'EQUIPEMENT' as StockCategory,
  },
  {
    code: 'EQP-SECHE-01',
    libelle: 'Sèche-Cheveux Mural Pro 2000W',
    quantiteDisponible: 26,
    seuilAlerte: 2,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'EQUIPEMENT' as StockCategory,
  },
  {
    code: 'EQP-BOUILL-01',
    libelle: 'Bouilloire Électrique Inox 1L',
    quantiteDisponible: 26,
    seuilAlerte: 3,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'EQUIPEMENT' as StockCategory,
  },
  {
    code: 'EQP-CLIM-01',
    libelle: 'Climatiseur Split Inverter 12000 BTU',
    quantiteDisponible: 26,
    seuilAlerte: 1,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'EQUIPEMENT' as StockCategory,
  },
  {
    code: 'EQP-CAFE-01',
    libelle: 'Machine Espresso (Suites)',
    quantiteDisponible: 8,
    seuilAlerte: 1,
    uniteMesure: 'unité',
    kitAccueil: false,
    categorie: 'EQUIPEMENT' as StockCategory,
  },

  // KITS D'ACCUEIL & CONSOMMABLES
  {
    code: 'AMEN-SOAP-01',
    libelle: 'Mini Savon Makarim 15g',
    quantiteDisponible: 200,
    seuilAlerte: 40,
    uniteMesure: 'unité',
    kitAccueil: true,
    categorie: 'KIT_ACCUEIL' as StockCategory,
  },
  {
    code: 'AMEN-SHMP-01',
    libelle: 'Mini Shampoing Makarim 30ml',
    quantiteDisponible: 200,
    seuilAlerte: 40,
    uniteMesure: 'unité',
    kitAccueil: true,
    categorie: 'KIT_ACCUEIL' as StockCategory,
  },
  {
    code: 'AMEN-BONNET-01',
    libelle: 'Bonnet de Douche Individuel',
    quantiteDisponible: 150,
    seuilAlerte: 30,
    uniteMesure: 'unité',
    kitAccueil: true,
    categorie: 'KIT_ACCUEIL' as StockCategory,
  },
  {
    code: 'AMEN-CAFE-01',
    libelle: 'Sachet Café & Thé Dégustation',
    quantiteDisponible: 300,
    seuilAlerte: 50,
    uniteMesure: 'unité',
    kitAccueil: true,
    categorie: 'KIT_ACCUEIL' as StockCategory,
  },
  {
    code: 'AMEN-EAU-01',
    libelle: 'Bouteille d\'Eau Minérale 50cl',
    quantiteDisponible: 250,
    seuilAlerte: 40,
    uniteMesure: 'unité',
    kitAccueil: true,
    categorie: 'KIT_ACCUEIL' as StockCategory,
  },
  {
    code: 'AMEN-PQ-01',
    libelle: 'Papier Hygiénique Douceur',
    quantiteDisponible: 180,
    seuilAlerte: 35,
    uniteMesure: 'rouleau',
    kitAccueil: true,
    categorie: 'KIT_ACCUEIL' as StockCategory,
  },
];

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // S'assure que les articles de référence existent en base
  async ensureDefaultItems() {
    for (const def of DEFAULT_ITEMS_CATALOG) {
      const existing = await this.prisma.stockItem.findUnique({
        where: { code: def.code },
      });
      if (!existing) {
        await this.prisma.stockItem.create({
          data: {
            code: def.code,
            libelle: def.libelle,
            quantiteDisponible: def.quantiteDisponible,
            seuilAlerte: def.seuilAlerte,
            uniteMesure: def.uniteMesure,
            kitAccueil: def.kitAccueil,
          },
        });
      }
    }
  }

  // Helper pour déduire la catégorie d'un article
  getCategorie(code: string, kitAccueil: boolean): StockCategory {
    if (code.startsWith('LINGE-')) return 'LINGERIE';
    if (code.startsWith('EQP-')) return 'EQUIPEMENT';
    if (code.startsWith('AMEN-') || kitAccueil) return 'KIT_ACCUEIL';
    return 'KIT_ACCUEIL';
  }

  async findAll() {
    await this.ensureDefaultItems();
    const items = await this.prisma.stockItem.findMany({
      orderBy: { code: 'asc' },
    });

    const roomDotations = await this.getRoomDotations();

    // Somme du besoin total installé dans l'hôtel
    const totalRoomsCount = await this.prisma.room.count({
      where: { deletedAt: null },
    });

    return items.map((item) => {
      const categorie = this.getCategorie(item.code, item.kitAccueil);
      const quantiteSaleBuanderie = dirtyLinenInLaundry[item.id] || 0;

      // Calcul de la dotation minimum théorique par chambre & total hôtel
      let dotationUnitairePonderee = 0;
      if (roomDotations.length > 0) {
        let totalItemsInHotel = 0;
        let totalRoomsCalculated = 0;

        for (const rd of roomDotations) {
          const match = rd.items.find((i) => i.stockItemId === item.id);
          const qtyPerRoom = match ? match.quantiteDotation : 0;
          const roomCount = rd.roomCount || 1;
          totalItemsInHotel += qtyPerRoom * roomCount;
          totalRoomsCalculated += roomCount;
        }

        dotationUnitairePonderee = totalRoomsCalculated > 0 
          ? Math.round(totalItemsInHotel / totalRoomsCalculated) 
          : 0;
      }

      const quantiteEnChambre = dotationUnitairePonderee * (totalRoomsCount || 24);
      const stockMinimumHotel = quantiteEnChambre;
      const quantitePropreReserve = item.quantiteDisponible;
      const quantiteTotale = quantitePropreReserve + quantiteEnChambre + quantiteSaleBuanderie;

      return {
        ...item,
        categorie,
        sousSeuilAlerte: estSousSeuilAlerte(item),
        quantitePropreReserve,
        quantiteEnChambre,
        quantiteSaleBuanderie,
        quantiteTotale,
        stockMinimumHotel,
        dotationUnitairePonderee,
      };
    });
  }

  findMovements(stockItemId?: number) {
    return this.prisma.stockMovement.findMany({
      where: { stockItemId },
      orderBy: { createdAt: 'desc' },
      include: {
        stockItem: true,
        room: true,
      },
    });
  }

  // Configuration des dotations standards par type de chambre
  async getRoomDotations() {
    await this.ensureDefaultItems();
    const roomTypes = await this.prisma.roomType.findMany({
      include: {
        rooms: {
          where: { deletedAt: null },
        },
      },
      orderBy: { id: 'asc' },
    });

    const allItems = await this.prisma.stockItem.findMany({
      orderBy: { code: 'asc' },
    });

    return roomTypes.map((rt) => {
      const roomCount = rt.rooms.length;
      const customForType = customDotations[rt.id];

      const items = allItems.map((item) => {
        const categorie = this.getCategorie(item.code, item.kitAccueil);
        let defaultQty = 0;

        const isSuite = rt.nom.toLowerCase().includes('suite') || rt.nom.toLowerCase().includes('exec');
        const isDouble = rt.nom.toLowerCase().includes('double') || rt.nom.toLowerCase().includes('king') || rt.capacite >= 2;

        if (customForType && customForType[item.id] !== undefined) {
          defaultQty = customForType[item.id];
        } else {
          // Rôles de dotation par défaut
          if (item.code === 'LINGE-DRAP-01') defaultQty = isDouble || isSuite ? 1 : 0;
          else if (item.code === 'LINGE-DRAP-02') defaultQty = !isDouble && !isSuite ? 1 : 0;
          else if (item.code === 'LINGE-TAIE-01') defaultQty = isSuite ? 6 : isDouble ? 4 : 2;
          else if (item.code === 'LINGE-COUV-01') defaultQty = isDouble || isSuite ? 1 : 0;
          else if (item.code === 'LINGE-COUV-02') defaultQty = !isDouble && !isSuite ? 1 : 0;
          else if (item.code === 'LINGE-SERV-01') defaultQty = isSuite ? 6 : isDouble ? 4 : 2;
          else if (item.code === 'LINGE-SERV-02') defaultQty = isSuite ? 4 : isDouble ? 2 : 1;
          else if (item.code === 'LINGE-TAPIS-01') defaultQty = isSuite ? 2 : 1;
          else if (item.code === 'LINGE-PEIGN-01') defaultQty = isSuite ? 2 : 0;

          // Équipements
          else if (item.code === 'EQP-FRIGO-01') defaultQty = 1;
          else if (item.code === 'EQP-TV-01') defaultQty = isSuite ? 2 : 1;
          else if (item.code === 'EQP-COFFRE-01') defaultQty = 1;
          else if (item.code === 'EQP-SECHE-01') defaultQty = 1;
          else if (item.code === 'EQP-BOUILL-01') defaultQty = isDouble || isSuite ? 1 : 0;
          else if (item.code === 'EQP-CLIM-01') defaultQty = isSuite ? 2 : 1;
          else if (item.code === 'EQP-CAFE-01') defaultQty = isSuite ? 1 : 0;

          // Consommables
          else if (item.code === 'AMEN-SOAP-01') defaultQty = isSuite ? 4 : isDouble ? 2 : 1;
          else if (item.code === 'AMEN-SHMP-01') defaultQty = isSuite ? 4 : isDouble ? 2 : 1;
          else if (item.code === 'AMEN-BONNET-01') defaultQty = isSuite ? 2 : 1;
          else if (item.code === 'AMEN-CAFE-01') defaultQty = isSuite ? 6 : isDouble ? 4 : 2;
          else if (item.code === 'AMEN-EAU-01') defaultQty = isSuite ? 4 : isDouble ? 2 : 2;
          else if (item.code === 'AMEN-PQ-01') defaultQty = 2;
        }

        return {
          stockItemId: item.id,
          code: item.code,
          libelle: item.libelle,
          categorie,
          quantiteDotation: defaultQty,
          uniteMesure: item.uniteMesure,
        };
      });

      return {
        roomTypeId: rt.id,
        roomTypeName: rt.nom,
        capacite: rt.capacite,
        roomCount,
        items,
      };
    });
  }

  // Mise à jour de la dotation d'un type de chambre
  async updateRoomDotation(dto: UpdateRoomDotationDto) {
    if (!customDotations[dto.roomTypeId]) {
      customDotations[dto.roomTypeId] = {};
    }
    for (const d of dto.dotations) {
      customDotations[dto.roomTypeId][d.stockItemId] = d.quantite;
    }
    return this.getRoomDotations();
  }

  // Synthèse du circuit Lingerie & Blanchisserie
  async getLinenStatus() {
    const allItems = await this.findAll();
    const linenItems = allItems.filter((i) => i.categorie === 'LINGERIE');

    let totalPropre = 0;
    let totalEnChambre = 0;
    let totalSaleBuanderie = 0;

    const details = linenItems.map((item) => {
      totalPropre += item.quantitePropreReserve;
      totalEnChambre += item.quantiteEnChambre;
      totalSaleBuanderie += item.quantiteSaleBuanderie;

      return {
        id: item.id,
        code: item.code,
        libelle: item.libelle,
        quantitePropreReserve: item.quantitePropreReserve,
        quantiteEnChambre: item.quantiteEnChambre,
        quantiteSaleBuanderie: item.quantiteSaleBuanderie,
        quantiteTotale: item.quantiteTotale,
        stockMinimumHotel: item.stockMinimumHotel,
        uniteMesure: item.uniteMesure,
        sousSeuilAlerte: item.sousSeuilAlerte,
      };
    });

    return {
      totalPropre,
      totalEnChambre,
      totalSaleBuanderie,
      totalLinge: totalPropre + totalEnChambre + totalSaleBuanderie,
      details,
    };
  }

  // Gestion des mouvements de buanderie / blanchisserie
  async handleLaundryMovement(dto: LaundryMovementDto, userId: number) {
    const item = await this.prisma.stockItem.findUnique({
      where: { id: dto.stockItemId },
    });
    if (!item || item.deletedAt) {
      throw new NotFoundException(`Article de stock ${dto.stockItemId} introuvable.`);
    }

    const currentDirty = dirtyLinenInLaundry[item.id] || 0;

    if (dto.action === 'ENVOI_BUANDERIE') {
      // Transfert vers la blanchisserie
      dirtyLinenInLaundry[item.id] = currentDirty + dto.quantite;

      await this.prisma.stockMovement.create({
        data: {
          stockItemId: dto.stockItemId,
          typeMouvement: 'SORTIE',
          quantite: dto.quantite,
          motif: dto.motif || `Envoi à la buanderie/blanchisserie (${dto.prestataire || 'Interne'})`,
          userId,
        },
      });
    } else {
      // Retour propre de la blanchisserie
      if (currentDirty < dto.quantite) {
        dirtyLinenInLaundry[item.id] = 0;
      } else {
        dirtyLinenInLaundry[item.id] = currentDirty - dto.quantite;
      }

      // Augmente le stock propre disponible
      await this.prisma.stockItem.update({
        where: { id: dto.stockItemId },
        data: { quantiteDisponible: { increment: dto.quantite } },
      });

      await this.prisma.stockMovement.create({
        data: {
          stockItemId: dto.stockItemId,
          typeMouvement: 'ENTREE',
          quantite: dto.quantite,
          motif: dto.motif || `Retour de blanchisserie - Linge propre (${dto.prestataire || 'Interne'})`,
          userId,
        },
      });
    }

    return this.getLinenStatus();
  }

  // Renouvellement de linge pour une chambre spécifique (Rotation ménage)
  async handleRoomLinenChange(dto: RoomLinenChangeDto, userId: number) {
    const room = await this.prisma.room.findUnique({
      where: { id: dto.roomId },
      include: { roomType: true },
    });

    if (!room) {
      throw new NotFoundException(`Chambre ${dto.roomId} introuvable.`);
    }

    const dotations = await this.getRoomDotations();
    const typeDotation = dotations.find((d) => d.roomTypeId === room.roomTypeId);

    if (!typeDotation) {
      throw new NotFoundException(`Dotation introuvable pour le type de chambre ${room.roomType.nom}.`);
    }

    const linenDotations = typeDotation.items.filter((i) => i.categorie === 'LINGERIE' && i.quantiteDotation > 0);

    for (const ld of linenDotations) {
      try {
        // Soustrait du propre pour la chambre
        await this.sortir(
          ld.stockItemId,
          ld.quantiteDotation,
          dto.motif || `Renouvellement linge propre — Chambre ${room.numero}`,
          { userId, roomId: room.id },
        );

        // Ajoute au stock sale buanderie
        const currentDirty = dirtyLinenInLaundry[ld.stockItemId] || 0;
        dirtyLinenInLaundry[ld.stockItemId] = currentDirty + ld.quantiteDotation;
      } catch (err) {
        this.logger.warn(`Impossible d'échanger le linge pour ${ld.code} chambre ${room.numero}: ${(err as Error).message}`);
      }
    }

    return {
      success: true,
      message: `Linge renouvelé avec succès pour la chambre ${room.numero}`,
      roomId: room.id,
      roomNumero: room.numero,
    };
  }

  // Réassort manuel (livraison fournisseur)
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

  // BR-STK-001 : décompte automatique du kit d'accueil
  async decompterKitAccueil(roomId: number, capaciteChambre: number) {
    const kitItems = await this.prisma.stockItem.findMany({
      where: { kitAccueil: true },
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

  // Sortie de stock générique
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
