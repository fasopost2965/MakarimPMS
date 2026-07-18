import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CheckinService } from './checkin.service';
import { WalkinCheckinDto } from './dto/walkin-checkin.dto';

@Controller()
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @RequirePermission('checkin', 'write')
  @Post('checkin/walk-in')
  checkinWalkIn(@Body() dto: WalkinCheckinDto) {
    return this.checkinService.checkinWalkIn(dto);
  }

  @RequirePermission('checkin', 'write')
  @Post('checkin/:reservationId')
  checkinFromReservation(
    @Param('reservationId', ParseIntPipe) reservationId: number,
  ) {
    return this.checkinService.checkinFromReservation(reservationId);
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
  checkout(@Param('stayId', ParseIntPipe) stayId: number) {
    return this.checkinService.checkout(stayId);
  }
}
