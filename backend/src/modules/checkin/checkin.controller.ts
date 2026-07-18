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
import { CheckinService } from './checkin.service';
import { WalkinCheckinDto } from './dto/walkin-checkin.dto';

@Controller()
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @RequirePermission('checkin', 'write')
  @Post('checkin/walk-in')
  checkinWalkIn(
    @Body() dto: WalkinCheckinDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkinService.checkinWalkIn(dto, user.sub);
  }

  @RequirePermission('checkin', 'write')
  @Post('checkin/:reservationId')
  checkinFromReservation(
    @Param('reservationId', ParseIntPipe) reservationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkinService.checkinFromReservation(reservationId, user.sub);
  }

  @RequirePermission('checkin', 'read')
  @Get('stays/en-cours')
  findEnCours() {
    return this.checkinService.findEnCours();
  }

  @RequirePermission('checkin', 'read')
  @Get('stays/departs-du-jour')
  departsToday() {
    return this.checkinService.departsToday();
  }

  @RequirePermission('checkin', 'read')
  @Get('stays/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.checkinService.findOne(id);
  }

  @RequirePermission('checkin', 'write')
  @Post('checkout/:stayId')
  checkout(
    @Param('stayId', ParseIntPipe) stayId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkinService.checkout(stayId, user.sub);
  }
}
