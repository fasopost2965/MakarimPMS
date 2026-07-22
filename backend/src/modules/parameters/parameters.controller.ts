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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ParametersService } from './parameters.service';
import { UpdateHotelConfigDto } from './dto/update-hotel-config.dto';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';
import { CreateSeasonRateDto } from './dto/create-season-rate.dto';
import { UpdateSeasonRateDto } from './dto/update-season-rate.dto';
import { DeleteSeasonRateDto } from './dto/delete-season-rate.dto';
import { CreateRateRestrictionDto } from './dto/create-rate-restriction.dto';
import { UpdateRateRestrictionDto } from './dto/update-rate-restriction.dto';
import { DeleteRateRestrictionDto } from './dto/delete-rate-restriction.dto';

@ApiTags('parameters')
@ApiBearerAuth()
@Controller()
export class ParametersController {
  constructor(private readonly parametersService: ParametersService) {}

  @RequirePermission('parameters', 'read')
  @ApiOperation({
    summary: "Configuration de l'hôtel (identité, TVA, catégorie)",
  })
  @Get('hotel-config')
  getHotelConfig() {
    return this.parametersService.getHotelConfig();
  }

  @RequirePermission('parameters', 'write')
  @ApiOperation({
    summary: "Met à jour la configuration de l'hôtel (motif obligatoire)",
  })
  @Patch('hotel-config')
  updateHotelConfig(
    @Body() dto: UpdateHotelConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.updateHotelConfig(dto, user.sub);
  }

  @RequirePermission('parameters', 'read')
  @ApiOperation({ summary: 'Liste les taux de TVA / taxe de séjour' })
  @Get('tax-rates')
  findTaxRates() {
    return this.parametersService.findTaxRates();
  }

  @RequirePermission('parameters', 'write')
  @ApiOperation({
    summary:
      'Crée une nouvelle taxe configurable (motif obligatoire) — ex. taxe touristique régionale',
  })
  @Post('tax-rates')
  createTaxRate(
    @Body() dto: CreateTaxRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.createTaxRate(dto, user.sub);
  }

  @RequirePermission('parameters', 'write')
  @ApiOperation({
    summary: 'Met à jour un taux de TVA / taxe de séjour (motif obligatoire)',
  })
  @Patch('tax-rates/:id')
  updateTaxRate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaxRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.updateTaxRate(id, dto, user.sub);
  }

  @RequirePermission('parameters', 'read')
  @ApiOperation({ summary: 'Liste la grille tarifaire saisonnière' })
  @Get('season-rates')
  findSeasonRates(@Query('roomTypeId') roomTypeId?: string) {
    return this.parametersService.findSeasonRates(
      roomTypeId ? Number(roomTypeId) : undefined,
    );
  }

  @RequirePermission('parameters', 'write')
  @ApiOperation({ summary: 'Crée un tarif saisonnier' })
  @Post('season-rates')
  createSeasonRate(
    @Body() dto: CreateSeasonRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.createSeasonRate(dto, user.sub);
  }

  @RequirePermission('parameters', 'write')
  @ApiOperation({ summary: 'Met à jour un tarif saisonnier' })
  @Patch('season-rates/:id')
  updateSeasonRate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSeasonRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.updateSeasonRate(id, dto, user.sub);
  }

  @RequirePermission('parameters', 'write')
  @ApiOperation({ summary: 'Supprime un tarif saisonnier (motif obligatoire)' })
  @Delete('season-rates/:id')
  removeSeasonRate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeleteSeasonRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.removeSeasonRate(id, dto, user.sub);
  }

  @RequirePermission('parameters', 'read')
  @ApiOperation({
    summary: 'Liste les restrictions tarifaires (min stay / stop sale)',
  })
  @Get('rate-restrictions')
  findRateRestrictions(@Query('roomTypeId') roomTypeId?: string) {
    return this.parametersService.findRateRestrictions(
      roomTypeId ? Number(roomTypeId) : undefined,
    );
  }

  @RequirePermission('parameters', 'write')
  @ApiOperation({
    summary: 'Crée une restriction tarifaire (motif obligatoire)',
  })
  @Post('rate-restrictions')
  createRateRestriction(
    @Body() dto: CreateRateRestrictionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.createRateRestriction(dto, user.sub);
  }

  @RequirePermission('parameters', 'write')
  @ApiOperation({
    summary: 'Met à jour une restriction tarifaire (motif obligatoire)',
  })
  @Patch('rate-restrictions/:id')
  updateRateRestriction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRateRestrictionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.updateRateRestriction(id, dto, user.sub);
  }

  @RequirePermission('parameters', 'write')
  @ApiOperation({
    summary: 'Supprime une restriction tarifaire (motif obligatoire)',
  })
  @Delete('rate-restrictions/:id')
  removeRateRestriction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeleteRateRestrictionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.parametersService.removeRateRestriction(id, dto, user.sub);
  }
}
