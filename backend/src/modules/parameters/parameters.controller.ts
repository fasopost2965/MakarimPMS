import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ParametersService } from './parameters.service';

@Controller('parameters')
export class ParametersController {
  constructor(private readonly parametersService: ParametersService) {}

  @RequirePermission('parameters', 'read')
  @Get('hotel')
  getHotelConfig() {
    return this.parametersService.getHotelConfig();
  }

  @RequirePermission('parameters', 'write')
  @Patch('hotel')
  updateHotelConfig(
    @Body()
    dto: {
      raisonSociale?: string;
      ice?: string;
      identifiantFiscal?: string;
      rc?: string;
      adresse?: string;
      categorieEtoiles?: number;
    },
  ) {
    return this.parametersService.updateHotelConfig(dto);
  }

  @RequirePermission('parameters', 'read')
  @Get('taxes')
  getTaxRates() {
    return this.parametersService.getTaxRates();
  }

  @RequirePermission('parameters', 'write')
  @Patch('taxes/:id')
  updateTaxRate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { taux: number },
  ) {
    return this.parametersService.updateTaxRate(id, dto);
  }

  @RequirePermission('parameters', 'read')
  @Get('seasons')
  getSeasonRates() {
    return this.parametersService.getSeasonRates();
  }

  @RequirePermission('parameters', 'write')
  @Post('seasons')
  createSeasonRate(
    @Body()
    dto: {
      libelle: string;
      dateDebut: string;
      dateFin: string;
      prixNuit: number;
      roomTypeId: number;
    },
  ) {
    return this.parametersService.createSeasonRate(dto);
  }

  @RequirePermission('parameters', 'write')
  @Patch('seasons/:id')
  updateSeasonRate(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    dto: {
      libelle?: string;
      dateDebut?: string;
      dateFin?: string;
      prixNuit?: number;
      roomTypeId?: number;
    },
  ) {
    return this.parametersService.updateSeasonRate(id, dto);
  }

  @RequirePermission('parameters', 'write')
  @Delete('seasons/:id')
  deleteSeasonRate(@Param('id', ParseIntPipe) id: number) {
    return this.parametersService.deleteSeasonRate(id);
  }
}
