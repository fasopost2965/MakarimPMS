import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SelfCheckinService } from './self-checkin.service';
import { SubmitSelfCheckinDto } from './dto/submit-self-checkin.dto';

@ApiTags('self-checkin')
@Controller()
export class SelfCheckinController {
  constructor(private readonly selfCheckinService: SelfCheckinService) {}

  // --- Surface publique (BR-RES-004 : throttling strict, pas de wildcard
  // d'authentification) --------------------------------------------------

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary:
      "Résumé public d'une réservation pour un lien de self check-in valide",
  })
  @Get('self-checkin/:token')
  getSummary(@Param('token') token: string) {
    return this.selfCheckinService.getPublicSummary(token);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Soumet les informations de self check-in (identité, pièce)',
  })
  @Post('self-checkin/:token')
  submit(@Param('token') token: string, @Body() dto: SubmitSelfCheckinDto) {
    return this.selfCheckinService.submit(token, dto);
  }

  // --- Surface réception (authentifiée) -----------------------------------

  @ApiBearerAuth()
  @RequirePermission('reservations', 'write')
  @ApiOperation({
    summary:
      'Génère (ou régénère) le lien de self check-in pour une réservation et envoie un email',
  })
  @Post('reservations/:id/self-checkin-link')
  generateLink(@Param('id', ParseIntPipe) reservationId: number) {
    return this.selfCheckinService.generateLink(reservationId);
  }

  @ApiBearerAuth()
  @RequirePermission('reservations', 'read')
  @ApiOperation({
    summary:
      'Données de self check-in déjà soumises par le client pour une réservation (pré-remplissage fiche de police)',
  })
  @Get('reservations/:id/self-checkin-pending')
  findPending(@Param('id', ParseIntPipe) reservationId: number) {
    return this.selfCheckinService.findPending(reservationId);
  }
}
