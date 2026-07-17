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
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';

// TODO(core 5.1/5.2) : protéger ces routes avec JwtAuthGuard + RolesGuard
// une fois le module core (auth/rôles) livré — voir skill creer-module-brique.
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get('rooms')
  listRooms() {
    return this.reservationsService.listRooms();
  }

  @Get('arrivees-du-jour')
  arrivalsToday() {
    return this.reservationsService.arrivalsToday();
  }

  @Get('disponibilites')
  checkAvailability(@Query() dto: CheckAvailabilityDto) {
    return this.reservationsService.checkAvailability(dto);
  }

  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
  }

  @Get()
  findAll(
    @Query('du') du?: string,
    @Query('au') au?: string,
    @Query('statut') statut?: StatutReservation,
  ) {
    return this.reservationsService.findAll({ du, au, statut });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reservationsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.reservationsService.remove(id);
  }
}
