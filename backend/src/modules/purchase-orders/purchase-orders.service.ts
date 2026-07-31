import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  Prisma,
  StatutBonCommande,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StockService } from '../stock/stock.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ValidatePurchaseOrderDto } from './dto/validate-purchase-order.dto';
import { CancelPurchaseOrderDto } from './dto/cancel-purchase-order.dto';
import { PurchaseOrderLineDto } from './dto/purchase-order-line.dto';
import { generatePurchaseOrderNumber } from './utils/purchase-order-number.util';

// Propriétaire exclusif de Supplier/PurchaseOrder/PurchaseOrderLine (Lot 8,
// Handoff final). Module feuille côté écriture (aucune dépendance vers
// reservations/billing/guests) — seule dépendance métier : StockService en
// façade (jamais de Prisma direct sur StockItem), pour vérifier qu'un
// stockItemId référencé sur une ligne existe réellement.
@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly stockService: StockService,
  ) {}

  // --- Fournisseurs (carnet d'adresses, non audité — voir schema.prisma) --

  findAllSuppliers() {
    return this.prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: { nom: 'asc' },
    });
  }

  async findSupplierByIdOrThrow(id: number) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier || supplier.deletedAt) {
      throw new NotFoundException(`Fournisseur ${id} introuvable.`);
    }
    return supplier;
  }

  createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  async updateSupplier(id: number, dto: UpdateSupplierDto) {
    await this.findSupplierByIdOrThrow(id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  // Soft delete (ADR-005) — refusé si le fournisseur porte encore un bon de
  // commande actif (non ANNULEE), pour ne jamais casser l'historique d'un
  // bon déjà validé/en cours.
  async deleteSupplier(id: number) {
    await this.findSupplierByIdOrThrow(id);
    const bonActif = await this.prisma.purchaseOrder.findFirst({
      where: {
        supplierId: id,
        deletedAt: null,
        statut: { not: StatutBonCommande.ANNULEE },
      },
    });
    if (bonActif) {
      throw new ConflictException(
        `Impossible de supprimer ce fournisseur : le bon de commande ${bonActif.numero} y est encore actif.`,
      );
    }
    return this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // --- Bons de commande ----------------------------------------------------

  findAllPurchaseOrders(statut?: StatutBonCommande) {
    return this.prisma.purchaseOrder.findMany({
      where: { deletedAt: null, statut },
      include: {
        supplier: true,
        lignes: true,
        createdBy: true,
        validatedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPurchaseOrderByIdOrThrow(id: number) {
    const bon = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        lignes: true,
        createdBy: true,
        validatedBy: true,
      },
    });
    if (!bon || bon.deletedAt) {
      throw new NotFoundException(`Bon de commande ${id} introuvable.`);
    }
    return bon;
  }

  private async buildLinesData(lignes: PurchaseOrderLineDto[]) {
    const data: Prisma.PurchaseOrderLineCreateManyPurchaseOrderInput[] = [];
    for (const ligne of lignes) {
      if (ligne.stockItemId !== undefined) {
        await this.stockService.findByIdOrThrow(ligne.stockItemId);
      }
      const montant = new Prisma.Decimal(ligne.prixUnitaire).mul(
        ligne.quantite,
      );
      data.push({
        stockItemId: ligne.stockItemId,
        reference: ligne.reference,
        designation: ligne.designation,
        quantite: ligne.quantite,
        prixUnitaire: new Prisma.Decimal(ligne.prixUnitaire),
        montant,
      });
    }
    return data;
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, userId: number) {
    await this.findSupplierByIdOrThrow(dto.supplierId);
    const linesData = await this.buildLinesData(dto.lignes);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          numero: generatePurchaseOrderNumber(0), // remplacé ci-dessous une fois l'id réel connu
          supplierId: dto.supplierId,
          demandeur: dto.demandeur,
          dateLivraisonSouhaitee: dto.dateLivraisonSouhaitee
            ? new Date(dto.dateLivraisonSouhaitee)
            : undefined,
          createdById: userId,
          lignes: { createMany: { data: linesData } },
        },
        include: { supplier: true, lignes: true },
      });

      const updated = await tx.purchaseOrder.update({
        where: { id: created.id },
        data: { numero: generatePurchaseOrderNumber(created.id) },
        include: { supplier: true, lignes: true },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CREATE_PURCHASE_ORDER,
        targetEntity: AuditEntity.PurchaseOrder,
        targetId: updated.id,
        newValue: {
          numero: updated.numero,
          supplierId: updated.supplierId,
          nbLignes: linesData.length,
        },
        motif: `Création du bon de commande ${updated.numero} (${linesData.length} ligne(s)).`,
      });

      return updated;
    });
  }

  // Modification autorisée uniquement en BROUILLON (avant soumission) —
  // même logique que ReservationsService.update qui rejette certains
  // statuts pour empêcher un contournement du workflow de validation.
  async updatePurchaseOrder(
    id: number,
    dto: UpdatePurchaseOrderDto,
    userId: number,
  ) {
    const existing = await this.findPurchaseOrderByIdOrThrow(id);
    if (existing.statut !== StatutBonCommande.BROUILLON) {
      throw new ConflictException(
        `Le bon de commande ${existing.numero} n'est plus modifiable (statut ${existing.statut}).`,
      );
    }
    if (dto.supplierId !== undefined) {
      await this.findSupplierByIdOrThrow(dto.supplierId);
    }
    const linesData = dto.lignes
      ? await this.buildLinesData(dto.lignes)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (linesData) {
        await tx.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId: id },
        });
      }

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: dto.supplierId,
          demandeur: dto.demandeur,
          dateLivraisonSouhaitee: dto.dateLivraisonSouhaitee
            ? new Date(dto.dateLivraisonSouhaitee)
            : undefined,
          lignes: linesData ? { createMany: { data: linesData } } : undefined,
        },
        include: { supplier: true, lignes: true },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.UPDATE_PURCHASE_ORDER,
        targetEntity: AuditEntity.PurchaseOrder,
        targetId: id,
        oldValue: { supplierId: existing.supplierId },
        newValue: { supplierId: updated.supplierId },
        motif: `Modification du bon de commande ${updated.numero}.`,
      });

      return updated;
    });
  }

  // BROUILLON -> EN_ATTENTE_VALIDATION (l'auteur soumet son propre bon,
  // pas de motif exigé — la décision exceptionnelle est la validation par
  // la Direction, pas la soumission).
  async submitPurchaseOrder(id: number, userId: number) {
    const existing = await this.findPurchaseOrderByIdOrThrow(id);
    if (existing.statut !== StatutBonCommande.BROUILLON) {
      throw new ConflictException(
        `Le bon de commande ${existing.numero} n'est pas en brouillon (statut ${existing.statut}).`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { statut: StatutBonCommande.EN_ATTENTE_VALIDATION },
        include: { supplier: true, lignes: true },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.SUBMIT_PURCHASE_ORDER,
        targetEntity: AuditEntity.PurchaseOrder,
        targetId: id,
        oldValue: { statut: StatutBonCommande.BROUILLON },
        newValue: { statut: StatutBonCommande.EN_ATTENTE_VALIDATION },
        motif: `Soumission du bon de commande ${updated.numero} pour validation.`,
      });

      return updated;
    });
  }

  // EN_ATTENTE_VALIDATION -> VALIDEE (Direction uniquement,
  // purchase-orders:valider — action distincte de write, non exprimable par
  // @RequirePermission (typé statiquement), vérifiée ici manuellement même
  // pattern que checkin:force-checkout/guests:blacklist/payments:refund).
  async validatePurchaseOrder(
    id: number,
    dto: ValidatePurchaseOrderDto,
    userId: number,
    roleId: number,
  ) {
    const existing = await this.findPurchaseOrderByIdOrThrow(id);
    if (existing.statut !== StatutBonCommande.EN_ATTENTE_VALIDATION) {
      throw new ConflictException(
        `Le bon de commande ${existing.numero} n'est pas en attente de validation (statut ${existing.statut}).`,
      );
    }

    const grant = await this.prisma.permission.findFirst({
      where: {
        module: 'purchase-orders',
        action: 'valider',
        roles: { some: { roleId } },
      },
    });
    if (!grant) {
      throw new ForbiddenException(
        'Permission requise : purchase-orders:valider.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          statut: StatutBonCommande.VALIDEE,
          validatedById: userId,
          validatedAt: new Date(),
        },
        include: { supplier: true, lignes: true },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.VALIDATE_PURCHASE_ORDER,
        targetEntity: AuditEntity.PurchaseOrder,
        targetId: id,
        oldValue: { statut: StatutBonCommande.EN_ATTENTE_VALIDATION },
        newValue: { statut: StatutBonCommande.VALIDEE },
        motif: dto.motif,
      });

      return updated;
    });
  }

  // BROUILLON/EN_ATTENTE_VALIDATION -> ANNULEE. Un bon déjà VALIDEE engage
  // l'hôtel vis-à-vis du fournisseur (mockup : « Ce bon de commande engage
  // Makarim Hôtel... ») — son annulation, si un jour nécessaire, resterait
  // une décision humaine hors PMS (contact fournisseur), pas un simple clic.
  async cancelPurchaseOrder(
    id: number,
    dto: CancelPurchaseOrderDto,
    userId: number,
  ) {
    const existing = await this.findPurchaseOrderByIdOrThrow(id);
    if (
      existing.statut !== StatutBonCommande.BROUILLON &&
      existing.statut !== StatutBonCommande.EN_ATTENTE_VALIDATION
    ) {
      throw new ConflictException(
        `Le bon de commande ${existing.numero} ne peut plus être annulé (statut ${existing.statut}).`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { statut: StatutBonCommande.ANNULEE },
        include: { supplier: true, lignes: true },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CANCEL_PURCHASE_ORDER,
        targetEntity: AuditEntity.PurchaseOrder,
        targetId: id,
        oldValue: { statut: existing.statut },
        newValue: { statut: StatutBonCommande.ANNULEE },
        motif: dto.motif,
      });

      return updated;
    });
  }
}
