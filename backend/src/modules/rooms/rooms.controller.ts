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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { DeleteRoomDto } from './dto/delete-room.dto';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';

// CH-038 (RD-024, docs/modules/rooms.md §16) — routes de CONFIGURATION
// uniquement (rooms:read/rooms:write). GET /rooms et PATCH /rooms/:id/statut
// restent volontairement sur HousekeepingController (housekeeping:read/
// write) : écart RBAC résiduel assumé, pour ne pas casser le frontend
// existant sans nécessité (§7/§16 du même document).
@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @RequirePermission('rooms', 'read')
  @ApiOperation({ summary: 'Liste les types de chambre' })
  @Get('types')
  findAllRoomTypes() {
    return this.roomsService.findAllRoomTypes();
  }

  @RequirePermission('rooms', 'write')
  @ApiOperation({ summary: 'Crée un type de chambre (motif obligatoire)' })
  @Post('types')
  createRoomType(
    @Body() dto: CreateRoomTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomsService.createRoomType(dto, user.sub);
  }

  @RequirePermission('rooms', 'write')
  @ApiOperation({ summary: 'Modifie un type de chambre (motif obligatoire)' })
  @Patch('types/:id')
  updateRoomType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoomTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomsService.updateRoomType(id, dto, user.sub);
  }

  @RequirePermission('rooms', 'write')
  @ApiOperation({
    summary:
      'Crée une chambre — inventaire configurable, RD-024 (motif obligatoire)',
  })
  @Post()
  createRoom(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomsService.createRoom(dto, user.sub);
  }

  @RequirePermission('rooms', 'write')
  @ApiOperation({ summary: 'Modifie une chambre (motif obligatoire)' })
  @Patch(':id')
  updateRoom(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomsService.updateRoom(id, dto, user.sub);
  }

  // Soft delete uniquement (ADR-005) — refusé si la chambre est encore
  // engagée dans un cycle d'occupation, voir RoomsService.deleteRoom.
  @RequirePermission('rooms', 'write')
  @ApiOperation({
    summary: 'Supprime (soft delete) une chambre — motif obligatoire',
  })
  @Delete(':id')
  deleteRoom(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeleteRoomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roomsService.deleteRoom(id, dto, user.sub);
  }
}
