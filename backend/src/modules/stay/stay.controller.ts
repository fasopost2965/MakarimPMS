import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { StayService } from './stay.service';
import { WalkinDto } from './dto/walkin.dto';

// Routes HTTP et clé de permission ('checkin') volontairement inchangées
// malgré le renommage du module (voir CLAUDE.md) — aucun consommateur
// (frontend, tests) n'a besoin d'être touché pour ce renommage interne.
@Controller()
export class StayController {
  constructor(private readonly stayService: StayService) {}

  @RequirePermission('checkin', 'write')
  @Post('checkin/walk-in')
  checkinWalkIn(
    @Body() dto: WalkinDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stayService.checkinWalkIn(dto, user.sub);
  }

  @RequirePermission('checkin', 'write')
  @Post('checkin/:reservationId')
  checkinFromReservation(
    @Param('reservationId', ParseIntPipe) reservationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stayService.checkinFromReservation(reservationId, user.sub);
  }

  @RequirePermission('checkin', 'read')
  @Get('stays/en-cours')
  findEnCours() {
    return this.stayService.findEnCours();
  }

  @RequirePermission('checkin', 'read')
  @Get('stays/departs-du-jour')
  departsToday() {
    return this.stayService.departsToday();
  }

  @RequirePermission('checkin', 'read')
  @Get('stays/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.stayService.findOne(id);
  }

  @RequirePermission('checkin', 'write')
  @Post('checkout/:stayId')
  checkout(
    @Param('stayId', ParseIntPipe) stayId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stayService.checkout(stayId, user.sub);
  }
}
