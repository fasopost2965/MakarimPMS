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
import { StatutReservation } from '@prisma/client';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @RequirePermission('reservations', 'read')
  @Get('arrivees-du-jour')
  arrivalsToday() {
    return this.reservationsService.arrivalsToday();
  }

  @RequirePermission('reservations', 'read')
  @Get('disponibilites')
  checkAvailability(@Query() dto: CheckAvailabilityDto) {
    return this.reservationsService.checkAvailability(dto);
  }

  @RequirePermission('reservations', 'write')
  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
  }

  @RequirePermission('reservations', 'read')
  @Get()
  findAll(
    @Query('du') du?: string,
    @Query('au') au?: string,
    @Query('statut') statut?: StatutReservation,
  ) {
    return this.reservationsService.findAll({ du, au, statut });
  }

  @RequirePermission('reservations', 'read')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reservationsService.findOne(id);
  }

  @RequirePermission('reservations', 'write')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservationsService.update(id, dto, user.sub);
  }

  @RequirePermission('reservations', 'delete')
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservationsService.remove(id, dto, user.sub);
  }
}
