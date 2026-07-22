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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @RequirePermission('reservations', 'read')
  @ApiOperation({ summary: "Réservations attendues aujourd'hui" })
  @Get('arrivees-du-jour')
  arrivalsToday() {
    return this.reservationsService.arrivalsToday();
  }

  @RequirePermission('reservations', 'read')
  @ApiOperation({
    summary: "Vérifie la disponibilité d'un type de chambre sur une période",
  })
  @Get('disponibilites')
  checkAvailability(@Query() dto: CheckAvailabilityDto) {
    return this.reservationsService.checkAvailability(dto);
  }

  @RequirePermission('reservations', 'write')
  @ApiOperation({ summary: 'Crée une réservation' })
  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
  }

  @RequirePermission('reservations', 'read')
  @ApiOperation({
    summary: 'Liste les réservations (filtrable par période/statut)',
  })
  @Get()
  findAll(
    @Query('du') du?: string,
    @Query('au') au?: string,
    @Query('statut') statut?: StatutReservation,
  ) {
    return this.reservationsService.findAll({ du, au, statut });
  }

  @RequirePermission('reservations', 'read')
  @ApiOperation({ summary: "Détail d'une réservation" })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reservationsService.findOne(id);
  }

  @RequirePermission('reservations', 'write')
  @ApiOperation({ summary: 'Met à jour une réservation' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservationsService.update(id, dto, user.sub);
  }

  @RequirePermission('reservations', 'delete')
  @ApiOperation({
    summary: 'Annule une réservation (soft delete, motif obligatoire)',
  })
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservationsService.remove(id, dto, user.sub);
  }
}
