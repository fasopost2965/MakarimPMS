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
import { ForceCheckoutDto } from './dto/force-checkout.dto';

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

  // checkin:write comme garde générique (décorateur statique) + vérification
  // manuelle de checkin:force-checkout dans le service quand force=true —
  // même pattern que DepositsController.rembourser/payments:refund (CH-005) :
  // une action dédiée hors de la grille read/write/delete/export ne peut pas
  // s'exprimer via @RequirePermission.
  @RequirePermission('checkin', 'write')
  @ApiOperation({
    summary:
      "Check-out d'un séjour — bloqué si le solde du séjour est positif (CH-005), sauf check-out forcé (force: true, motif obligatoire, réservé Administrateur — checkin:force-checkout)",
  })
  @Post('checkout/:stayId')
  checkout(
    @Param('stayId', ParseIntPipe) stayId: number,
    @Body() dto: ForceCheckoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stayService.checkout(stayId, dto, user.sub, user.roleId);
  }
}
