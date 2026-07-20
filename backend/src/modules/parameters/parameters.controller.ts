import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ParametersService } from './parameters.service';
import { UpdateHotelConfigDto } from './dto/update-hotel-config.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';
import { CreateSeasonRateDto } from './dto/create-season-rate.dto';
import { UpdateSeasonRateDto } from './dto/update-season-rate.dto';
import { DeleteSeasonRateDto } from './dto/delete-season-rate.dto';

@Controller()
export class ParametersController {
  constructor(private readonly parametersService: ParametersService) {}

  @RequirePermission('parameters', 'read')
  @Get('hotel-config')
  getHotelConfig() {
    return this.parametersService.getHotelConfig();
  }

  @RequirePermission('parameters', 'write')
  @Patch('hotel-config')
  updateHotelConfig(
    @Body() dto: UpdateHotelConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.updateHotelConfig(dto, user.sub);
  }

  @RequirePermission('parameters', 'read')
  @Get('tax-rates')
  findTaxRates() {
    return this.parametersService.findTaxRates();
  }

  @RequirePermission('parameters', 'write')
  @Patch('tax-rates/:id')
  updateTaxRate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaxRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.updateTaxRate(id, dto, user.sub);
  }

  @RequirePermission('parameters', 'read')
  @Get('season-rates')
  findSeasonRates(@Query('roomTypeId') roomTypeId?: string) {
    return this.parametersService.findSeasonRates(
      roomTypeId ? Number(roomTypeId) : undefined,
    );
  }

  @RequirePermission('parameters', 'write')
  @Post('season-rates')
  createSeasonRate(
    @Body() dto: CreateSeasonRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.createSeasonRate(dto, user.sub);
  }

  @RequirePermission('parameters', 'write')
  @Patch('season-rates/:id')
  updateSeasonRate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSeasonRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.updateSeasonRate(id, dto, user.sub);
  }

  @RequirePermission('parameters', 'write')
  @Delete('season-rates/:id')
  removeSeasonRate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeleteSeasonRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.removeSeasonRate(id, dto, user.sub);
  }
}
