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
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { GuestsService } from './guests.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { UpdateGuestCategorieDto } from './dto/update-guest-categorie.dto';

@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @RequirePermission('guests', 'read')
  @Get()
  search(@Query('q') q?: string) {
    return this.guestsService.search(q);
  }

  @RequirePermission('guests', 'write')
  @Post()
  create(@Body() dto: CreateGuestDto) {
    return this.guestsService.create(dto);
  }

  @RequirePermission('guests', 'read')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.guestsService.findOne(id);
  }

  @RequirePermission('guests', 'write')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGuestDto) {
    return this.guestsService.update(id, dto);
  }

  @RequirePermission('guests', 'write')
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
  @Get(':id/historique')
  historique(@Param('id', ParseIntPipe) id: number) {
    return this.guestsService.historique(id);
  }

  @RequirePermission('guests', 'read')
  @Get(':id/factures')
  factures(@Param('id', ParseIntPipe) id: number) {
    return this.guestsService.factures(id);
  }
}
