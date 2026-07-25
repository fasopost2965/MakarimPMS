import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CanalReservation } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ChannelManagerService } from './channel-manager.service';
import { ChannelWebhookGuard } from './guards/channel-webhook.guard';
import { ChannelReservationWebhookDto } from './dto/channel-reservation-webhook.dto';
import { ChannelCancellationWebhookDto } from './dto/channel-cancellation-webhook.dto';
import { CreateChannelRoomTypeMappingDto } from './dto/create-channel-room-type-mapping.dto';
import { DeleteChannelRoomTypeMappingDto } from './dto/delete-channel-room-type-mapping.dto';

// Sous-ensemble de CanalReservation réellement utilisable comme canal OTA
// (WALK_IN/DIRECT ne sont jamais l'origine d'un webhook entrant).
const OTA_CANAUX = {
  BOOKING_COM: CanalReservation.BOOKING_COM,
  EXPEDIA: CanalReservation.EXPEDIA,
  AIRBNB: CanalReservation.AIRBNB,
} as const;

@ApiTags('channel-manager')
@Controller('channel-manager')
export class ChannelManagerController {
  constructor(private readonly channelManagerService: ChannelManagerService) {}

  // --- Webhooks OTA (serveur-à-serveur, secret partagé) --------------------

  @Public()
  @UseGuards(ChannelWebhookGuard)
  @ApiOperation({
    summary:
      "Réception d'une réservation OTA (Booking.com/Expedia/Airbnb) — idempotent sur otaReservationId",
  })
  @Post(':canal/reservations')
  importReservation(
    @Param('canal', new ParseEnumPipe(OTA_CANAUX)) canal: CanalReservation,
    @Body() dto: ChannelReservationWebhookDto,
  ) {
    return this.channelManagerService.importReservation(canal, dto);
  }

  @Public()
  @UseGuards(ChannelWebhookGuard)
  @ApiOperation({
    summary: "Annulation d'une réservation précédemment importée depuis un OTA",
  })
  @Post(':canal/cancellations')
  cancelReservation(
    @Param('canal', new ParseEnumPipe(OTA_CANAUX)) canal: CanalReservation,
    @Body() dto: ChannelCancellationWebhookDto,
  ) {
    return this.channelManagerService.cancelReservation(canal, dto);
  }

  // --- Synchronisation sortante (staff, authentifiée) -----------------------

  @RequirePermission('parameters', 'read')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Pousse la disponibilité réelle vers un OTA pour une période (simulé/journalisé tant qu'aucun compte partenaire réel n'est connecté)",
  })
  @Post(':canal/sync-availability')
  syncAvailability(
    @Param('canal', new ParseEnumPipe(OTA_CANAUX)) canal: CanalReservation,
    @Query('dateDebut') dateDebut: string,
    @Query('dateFin') dateFin: string,
  ) {
    return this.channelManagerService.syncAvailability(
      canal,
      dateDebut,
      dateFin,
    );
  }

  // --- Mapping type de chambre externe → RoomType (staff, authentifiée) -----

  @RequirePermission('parameters', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Liste les mappings type de chambre configurés' })
  @Get('mappings')
  findMappings(@Query('canal') canal?: CanalReservation) {
    return this.channelManagerService.findMappings(canal);
  }

  @RequirePermission('parameters', 'write')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Crée un mapping type de chambre externe → interne',
  })
  @Post('mappings')
  createMapping(
    @Body() dto: CreateChannelRoomTypeMappingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.channelManagerService.createMapping(dto, user.sub);
  }

  @RequirePermission('parameters', 'write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprime un mapping type de chambre' })
  @Delete('mappings/:id')
  removeMapping(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeleteChannelRoomTypeMappingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.channelManagerService.removeMapping(id, dto, user.sub);
  }
}
