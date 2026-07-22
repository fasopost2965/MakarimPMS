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
import { GuestsService } from './guests.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { UpdateGuestCategorieDto } from './dto/update-guest-categorie.dto';

@ApiTags('guests')
@ApiBearerAuth()
@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @RequirePermission('guests', 'read')
  @ApiOperation({ summary: 'Recherche des clients par nom' })
  @Get()
  search(@Query('q') q?: string) {
    return this.guestsService.search(q);
  }

  @RequirePermission('guests', 'write')
  @ApiOperation({ summary: 'Crée une fiche client' })
  @Post()
  create(@Body() dto: CreateGuestDto) {
    return this.guestsService.create(dto);
  }

  @RequirePermission('guests', 'read')
  @ApiOperation({ summary: "Détail d'un client" })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.guestsService.findOne(id);
  }

  @RequirePermission('guests', 'write')
  @ApiOperation({ summary: 'Met à jour une fiche client' })
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGuestDto) {
    return this.guestsService.update(id, dto);
  }

  @RequirePermission('guests', 'write')
  @ApiOperation({
    summary: 'Change la catégorie client (VIP/entreprise/agence/liste noire)',
  })
  @Patch(':id/categorie')
  updateCategorie(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGuestCategorieDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guestsService.updateCategorie(
      id,
      dto.categorie,
      dto.motif,
      user.sub,
      user.roleId,
    );
  }

  @RequirePermission('guests', 'read')
  @ApiOperation({ summary: 'Historique des catégories client' })
  @Get(':id/historique')
  historique(@Param('id', ParseIntPipe) id: number) {
    return this.guestsService.historique(id);
  }

  @RequirePermission('guests', 'read')
  @ApiOperation({ summary: "Factures d'un client" })
  @Get(':id/factures')
  factures(@Param('id', ParseIntPipe) id: number) {
    return this.guestsService.factures(id);
  }
}
