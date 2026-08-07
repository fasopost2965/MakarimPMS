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
import { CheckinFromReservationDto } from './dto/checkin-from-reservation.dto';
import { ForceCheckoutDto } from './dto/force-checkout.dto';
import { ChangeRoomDto } from './dto/change-room.dto';
import { ExtendStayDto } from './dto/extend-stay.dto';

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
  @ApiOperation({
    summary:
      "Check-in à partir d'une réservation existante — nombreOccupants " +
      'requis dans le corps de la requête si la réservation ne le ' +
      'renseigne pas déjà (FIN-102B)',
  })
  @Post('checkin/:reservationId')
  checkinFromReservation(
    @Param('reservationId', ParseIntPipe) reservationId: number,
    @Body() dto: CheckinFromReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stayService.checkinFromReservation(
      reservationId,
      dto,
      user.sub,
    );
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

  // GL-002 — changement de chambre pendant un séjour (transfert vers une
  // chambre disponible). Permission dédiée stay:change-room (Administrateur
  // + Réception), gardée directement par @RequirePermission — contrairement
  // à checkin:force-checkout/guests:blacklist, l'exigibilité de cette
  // permission ne dépend jamais du contenu de la requête (toujours requise
  // pour atteindre cette route), donc pas besoin du pattern de vérification
  // dynamique ; même précédent que housekeeping:control. StayService
  // revérifie la même permission en interne (défense en profondeur), mais
  // ce décorateur reste la barrière principale.
  @RequirePermission('stay', 'change-room')
  @ApiOperation({
    summary:
      'Changement de chambre pendant un séjour — transfert vers une chambre disponible (GL-002), réservé à stay:change-room (Administrateur + Réception)',
  })
  @Post('stays/:id/change-room')
  changeRoom(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeRoomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stayService.changeRoom(
      id,
      dto.newRoomId,
      dto.motif,
      user.sub,
      user.roleId,
    );
  }

  // GL-003 — prolongation de séjour (ajout de nuits sur la chambre actuelle).
  // Permission dédiée stay:extend (Administrateur + Réception), même
  // convention que stay:change-room ci-dessus — pas de vérification
  // dynamique nécessaire (exigibilité indépendante du contenu de la
  // requête). StayService revérifie la même permission en interne (défense
  // en profondeur), mais ce décorateur reste la barrière principale.
  @RequirePermission('stay', 'extend')
  @ApiOperation({
    summary:
      'Prolongation de séjour (GL-003) — ajout de nuits sur la chambre actuelle, réservé à stay:extend (Administrateur + Réception)',
  })
  @Post('stays/:id/extend')
  extendStay(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExtendStayDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stayService.extendStay(
      id,
      dto.nouvelleDateCheckoutPrevue,
      dto.motif,
      user.sub,
      user.roleId,
    );
  }
}
