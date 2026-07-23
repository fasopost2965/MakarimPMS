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
import { DepositsService } from './deposits.service';
import { CreateReservationDepositDto } from './dto/create-reservation-deposit.dto';
import { RembourserDepositDto } from './dto/rembourser-deposit.dto';

@ApiTags('payments-deposits')
@ApiBearerAuth()
@Controller('reservations')
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @RequirePermission('payments', 'write')
  @ApiOperation({ summary: 'Enregistre un acompte versé sur une réservation' })
  @Post(':id/deposits')
  create(
    @Param('id', ParseIntPipe) reservationId: number,
    @Body() dto: CreateReservationDepositDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.depositsService.create(reservationId, dto, user.sub);
  }

  @RequirePermission('payments', 'read')
  @ApiOperation({ summary: "Liste les acomptes d'une réservation" })
  @Get(':id/deposits')
  findByReservation(@Param('id', ParseIntPipe) reservationId: number) {
    return this.depositsService.findByReservation(reservationId);
  }

  // payments:write comme garde générique (décorateur statique) + vérification
  // manuelle de payments:refund dans le service — même pattern que
  // GuestsService.updateCategorie/guests:blacklist (CLAUDE.md §RBAC) : une
  // action dédiée hors de la grille read/write/delete/export ne peut pas
  // s'exprimer via @RequirePermission, dont le type est restreint aux 4
  // actions génériques.
  @RequirePermission('payments', 'write')
  @ApiOperation({
    summary:
      "Rembourse un acompte (réservé Administrateur, motif obligatoire) — un acompte déjà imputé à un folio exige d'abord l'annulation par avoir de toute facture émise active sur ce folio (CH-012)",
  })
  @Post(':id/deposits/:depositId/rembourser')
  rembourser(
    @Param('id', ParseIntPipe) reservationId: number,
    @Param('depositId', ParseIntPipe) depositId: number,
    @Body() dto: RembourserDepositDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.depositsService.rembourser(
      reservationId,
      depositId,
      dto,
      user.sub,
      user.roleId,
    );
  }
}
