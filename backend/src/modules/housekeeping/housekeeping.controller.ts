import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { HousekeepingService } from './housekeeping.service';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';

@ApiTags('housekeeping')
@ApiBearerAuth()
@Controller()
export class HousekeepingController {
  constructor(private readonly housekeepingService: HousekeepingService) {}

  @RequirePermission('housekeeping', 'read')
  @ApiOperation({ summary: 'Liste les chambres avec leur statut courant' })
  @Get('rooms')
  findAll() {
    return this.housekeepingService.findAllRooms();
  }

  // CH-014 (docs/governance/REGISTRE_CHANTIERS.md) — RoomStatusLog était
  // peuplée à chaque transition mais jamais lue par aucune route.
  @RequirePermission('housekeeping', 'read')
  @ApiOperation({
    summary: "Historique des changements de statut d'une chambre",
  })
  @Get('rooms/:id/historique-statuts')
  historiqueStatuts(@Param('id', ParseIntPipe) id: number) {
    return this.housekeepingService.findStatusHistory(id);
  }

  @RequirePermission('housekeeping', 'write')
  @ApiOperation({ summary: "Change manuellement le statut d'une chambre" })
  @Patch('rooms/:id/statut')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoomStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housekeepingService.updateStatus(id, dto.statut, user.sub);
  }
}
