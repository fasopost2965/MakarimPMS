import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { AuditModule } from '../audit/audit.module';
import { StockModule } from '../stock/stock.module';

// Lot 8 (Handoff final) — propriétaire exclusif de Supplier/PurchaseOrder/
// PurchaseOrderLine. Deux dépendances métier explicites : AuditModule
// (motif + trace obligatoires sur toute mutation de PurchaseOrder) et
// StockModule (façade StockService.findByIdOrThrow, jamais de Prisma direct
// sur StockItem) pour valider un stockItemId référencé sur une ligne.
@Module({
  imports: [AuditModule, StockModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
