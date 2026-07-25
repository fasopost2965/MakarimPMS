import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { StockService } from './stock.service';
import { ReplenishStockDto } from './dto/replenish-stock.dto';
import { LaundryMovementDto } from './dto/laundry-movement.dto';
import { UpdateRoomDotationDto } from './dto/room-dotation.dto';
import { RoomLinenChangeDto } from './dto/room-linen-change.dto';

@ApiTags('stock')
@ApiBearerAuth()
@Controller('stocks')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @RequirePermission('stock', 'read')
  @ApiOperation({ summary: 'Liste les articles de stock avec alerte de seuil et catégories' })
  @Get()
  findAll() {
    return this.stockService.findAll();
  }

  @RequirePermission('stock', 'write')
  @ApiOperation({ summary: 'Réassort manuel (livraison fournisseur)' })
  @Post('replenish')
  replenish(
    @Body() dto: ReplenishStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stockService.replenish(dto, user.sub);
  }

  @RequirePermission('stock', 'read')
  @ApiOperation({ summary: 'Historique des mouvements de stock' })
  @Get('movements')
  movements(@Query('stockItemId') stockItemId?: string) {
    return this.stockService.findMovements(
      stockItemId ? Number(stockItemId) : undefined,
    );
  }

  @RequirePermission('stock', 'read')
  @ApiOperation({ summary: 'Dotations standards et stock minimum par type de chambre' })
  @Get('room-dotations')
  getRoomDotations() {
    return this.stockService.getRoomDotations();
  }

  @RequirePermission('stock', 'write')
  @ApiOperation({ summary: 'Mettre à jour la dotation d’un type de chambre' })
  @Post('room-dotations')
  updateRoomDotation(@Body() dto: UpdateRoomDotationDto) {
    return this.stockService.updateRoomDotation(dto);
  }

  @RequirePermission('stock', 'read')
  @ApiOperation({ summary: 'Synthèse du circuit Lingerie & Blanchisserie' })
  @Get('laundry-status')
  getLinenStatus() {
    return this.stockService.getLinenStatus();
  }

  @RequirePermission('stock', 'write')
  @ApiOperation({ summary: 'Mouvement de blanchisserie (envoi ou retour)' })
  @Post('laundry-movement')
  handleLaundryMovement(
    @Body() dto: LaundryMovementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stockService.handleLaundryMovement(dto, user.sub);
  }

  @RequirePermission('stock', 'write')
  @ApiOperation({ summary: 'Renouvellement de linge pour une chambre (Rotation)' })
  @Post('room-linen-change')
  handleRoomLinenChange(
    @Body() dto: RoomLinenChangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stockService.handleRoomLinenChange(dto, user.sub);
  }
}
