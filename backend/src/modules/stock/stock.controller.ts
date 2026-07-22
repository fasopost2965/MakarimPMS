import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { StockService } from './stock.service';
import { ReplenishStockDto } from './dto/replenish-stock.dto';

@ApiTags('stock')
@ApiBearerAuth()
@Controller('stocks')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @RequirePermission('stock', 'read')
  @ApiOperation({ summary: 'Liste les articles de stock avec alerte de seuil' })
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
}
