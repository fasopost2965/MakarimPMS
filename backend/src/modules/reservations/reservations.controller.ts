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
import { CheckRoomAvailabilityDto } from './dto/check-room-availability.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { NoShowReservationDto } from './dto/no-show-reservation.dto';
import { EstimatePriceDto } from './dto/estimate-price.dto';

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

  // F8 — pré-vérification par chambre précise pour le drag-and-drop du
  // planning (griser une case cible invalide avant le drop) — purement
  // consultatif, update() (PATCH ci-dessous) reste le seul point d'écriture
  // et l'arbitre final en cas de course résiduelle.
  @RequirePermission('reservations', 'read')
  @ApiOperation({
    summary:
      "Pré-vérifie la disponibilité d'une chambre précise sur une période (drag-and-drop planning), sans effectuer de déplacement",
  })
  @Get('availability')
  checkRoomAvailability(@Query() dto: CheckRoomAvailabilityDto) {
    return this.reservationsService.checkRoomAvailability(dto);
  }

  // CH-061 (Lot #3 design) — permet aux formulaires réception (nouvelle
  // réservation, check-in walk-in) d'afficher un prix avant confirmation.
  // Route statique déclarée avant @Get(':id') pour ne jamais être capturée
  // par ce dernier.
  @RequirePermission('reservations', 'read')
  @ApiOperation({
    summary:
      'Estimation de prix (type de chambre, dates, formule), sans créer de réservation',
  })
  @Get('estimation-prix')
  async estimatePrice(@Query() dto: EstimatePriceDto) {
    const estimate = await this.reservationsService.estimatePrixDetail(
      dto.roomTypeId,
      dto.dateArrivee,
      dto.dateDepart,
      dto.formule,
    );
    return {
      // Compatibilité obligatoire avec le formulaire walk-in et les clients
      // existants de cette route.
      prixEstime: estimate.totalEstime.toString(),
      detail: {
        nombreNuits: estimate.nombreNuits,
        hebergement: estimate.hebergement.toString(),
        supplementFormule: estimate.supplementFormule.toString(),
        totalEstime: estimate.totalEstime.toString(),
      },
    };
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

  @RequirePermission('reservations', 'delete')
  @ApiOperation({
    summary:
      'Marque une réservation non-présentation / no-show (motif obligatoire, calcule la pénalité BR-RES-006)',
  })
  @Post(':id/no-show')
  markNoShow(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: NoShowReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservationsService.markNoShow(id, dto, user.sub);
  }
}
