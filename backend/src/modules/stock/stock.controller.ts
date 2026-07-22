import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { StockService } from './stock.service';
import { ReplenishStockDto } from './dto/replenish-stock.dto';

@Controller('stocks')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @RequirePermission('stock', 'read')
  @Get()
  findAll() {
    return this.stockService.findAll();
  }

  @RequirePermission('stock', 'write')
  @Post('replenish')
  replenish(
    @Body() dto: ReplenishStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stockService.replenish(dto, user.sub);
  }

  @RequirePermission('stock', 'read')
  @Get('movements')
  movements(@Query('stockItemId') stockItemId?: string) {
    return this.stockService.findMovements(
      stockItemId ? Number(stockItemId) : undefined,
    );
  }
}
