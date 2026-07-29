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
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { RestaurantService } from './restaurant.service';
import { CreateRestaurantChargeDto } from './dto/create-restaurant-charge.dto';
import { UpdateRestaurantChargeDto } from './dto/update-restaurant-charge.dto';

@ApiTags('restaurant')
@ApiBearerAuth()
@Controller('restaurant')
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}

  @RequirePermission('restaurant', 'write')
  @ApiOperation({
    summary:
      'Liste des séjours en cours (chambre + client), jamais de donnée financière',
  })
  @Get('stays-in-house')
  findStaysInHouse() {
    return this.restaurantService.findStaysInHouse();
  }

  @RequirePermission('restaurant', 'write')
  @ApiOperation({ summary: 'Ajoute une note restaurant directement au folio' })
  @Post('charges')
  addCharge(
    @Body() dto: CreateRestaurantChargeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.restaurantService.addCharge(dto, user.sub);
  }

  @RequirePermission('restaurant', 'write')
  @ApiOperation({
    summary:
      'Corrige une note restaurant (annulation soft + recréation, jamais de mutation directe)',
  })
  @Patch('charges/:folioLineId')
  updateCharge(
    @Param('folioLineId', ParseIntPipe) folioLineId: number,
    @Body() dto: UpdateRestaurantChargeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.restaurantService.updateCharge(folioLineId, dto, user.sub);
  }

  @RequirePermission('restaurant', 'write')
  @ApiOperation({
    summary:
      'Mini-rapport du jour groupé par chambre (double vérification a posteriori, jamais bloquant)',
  })
  @Get('charges/rapport')
  getDailyReport(@Query('date') date: string) {
    return this.restaurantService.getDailyReport(date);
  }
}
