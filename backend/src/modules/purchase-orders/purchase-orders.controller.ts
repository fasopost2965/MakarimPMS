import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatutBonCommande } from '@prisma/client';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ValidatePurchaseOrderDto } from './dto/validate-purchase-order.dto';
import { CancelPurchaseOrderDto } from './dto/cancel-purchase-order.dto';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @RequirePermission('purchase-orders', 'read')
  @ApiOperation({ summary: 'Liste les fournisseurs' })
  @Get('suppliers')
  findAllSuppliers() {
    return this.purchaseOrdersService.findAllSuppliers();
  }

  @RequirePermission('purchase-orders', 'write')
  @ApiOperation({ summary: 'Crée un fournisseur' })
  @Post('suppliers')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.purchaseOrdersService.createSupplier(dto);
  }

  @RequirePermission('purchase-orders', 'write')
  @ApiOperation({ summary: 'Modifie un fournisseur' })
  @Patch('suppliers/:id')
  updateSupplier(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.purchaseOrdersService.updateSupplier(id, dto);
  }

  // Pas de @Delete ici : le carnet fournisseurs n'a pas besoin d'une route
  // HTTP DELETE dédiée dans cette itération (aucun écran ne l'expose encore
  // côté frontend) — deleteSupplier() reste disponible côté service pour un
  // futur écran de gestion sans changement d'API à prévoir.

  @RequirePermission('purchase-orders', 'read')
  @ApiOperation({
    summary: 'Liste les bons de commande (filtre statut optionnel)',
  })
  @Get()
  findAllPurchaseOrders(@Query('statut') statut?: StatutBonCommande) {
    return this.purchaseOrdersService.findAllPurchaseOrders(statut);
  }

  @RequirePermission('purchase-orders', 'read')
  @ApiOperation({ summary: "Détail d'un bon de commande" })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.purchaseOrdersService.findPurchaseOrderByIdOrThrow(id);
  }

  @RequirePermission('purchase-orders', 'write')
  @ApiOperation({ summary: 'Crée un bon de commande (brouillon)' })
  @Post()
  create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchaseOrdersService.createPurchaseOrder(dto, user.sub);
  }

  @RequirePermission('purchase-orders', 'write')
  @ApiOperation({
    summary: 'Modifie un bon de commande (brouillon uniquement)',
  })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchaseOrdersService.updatePurchaseOrder(id, dto, user.sub);
  }

  @RequirePermission('purchase-orders', 'write')
  @ApiOperation({ summary: 'Soumet le bon de commande pour validation' })
  @Patch(':id/soumettre')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchaseOrdersService.submitPurchaseOrder(id, user.sub);
  }

  // purchase-orders:valider est une action dédiée non exprimable par
  // @RequirePermission (typé statiquement à read/write/delete/export) —
  // vérification dynamique dans le service, même pattern que
  // checkin:force-checkout/guests:blacklist/payments:refund.
  // purchase-orders:write reste le garde-fou minimal côté décorateur.
  @RequirePermission('purchase-orders', 'write')
  @ApiOperation({
    summary: 'Valide le bon de commande (Direction, motif obligatoire)',
  })
  @Patch(':id/valider')
  validate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValidatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchaseOrdersService.validatePurchaseOrder(
      id,
      dto,
      user.sub,
      user.roleId,
    );
  }

  @RequirePermission('purchase-orders', 'write')
  @ApiOperation({ summary: 'Annule le bon de commande (motif obligatoire)' })
  @Patch(':id/annuler')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelPurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchaseOrdersService.cancelPurchaseOrder(id, dto, user.sub);
  }
}
