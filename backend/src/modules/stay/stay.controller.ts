import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { StayService } from './stay.service';
import { WalkinDto } from './dto/walkin.dto';

// Routes HTTP et clé de permission ('checkin') volontairement inchangées
// malgré le renommage du module (voir CLAUDE.md) — aucun consommateur
// (frontend, tests) n'a besoin d'être touché pour ce renommage interne.
@ApiTags('stay')
@ApiBearerAuth()
@Controller()
export class StayController {
  constructor(private readonly stayService: StayService) {}

  @RequirePermission('checkin', 'write')
  @ApiOperation({ summary: 'Check-in walk-in (client sans réservation)' })
  @Post('checkin/walk-in')
  checkinWalkIn(
    @Body() dto: WalkinDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stayService.checkinWalkIn(dto, user.sub);
  }

  @RequirePermission('checkin', 'write')
  @ApiOperation({ summary: "Check-in à partir d'une réservation existante" })
  @Post('checkin/:reservationId')
  checkinFromReservation(
    @Param('reservationId', ParseIntPipe) reservationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stayService.checkinFromReservation(reservationId, user.sub);
  }

  @RequirePermission('checkin', 'read')
  @ApiOperation({ summary: 'Séjours en cours' })
  @Get('stays/en-cours')
  findEnCours() {
    return this.stayService.findEnCours();
  }

  @RequirePermission('checkin', 'read')
  @ApiOperation({ summary: "Départs prévus aujourd'hui" })
  @Get('stays/departs-du-jour')
  departsToday() {
    return this.stayService.departsToday();
  }

  @RequirePermission('checkin', 'read')
  @ApiOperation({ summary: "Détail d'un séjour" })
  @Get('stays/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.stayService.findOne(id);
  }

  @RequirePermission('checkin', 'write')
  @ApiOperation({ summary: "Check-out d'un séjour" })
  @Post('checkout/:stayId')
  checkout(
    @Param('stayId', ParseIntPipe) stayId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stayService.checkout(stayId, user.sub);
  }
}
