import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuthService } from '../auth/auth.service';
import { LoginDto } from '../auth/dto/login.dto';
import { HousekeepingService } from './housekeeping.service';
import { MobileRoomStatusUpdateDto } from './dto/mobile-room-status-update.dto';
import { toMobileRoomSummary } from './utils/mobile-room.mapper';

// F9 — surface dédiée à l'app mobile housekeeping (même domaine, transport
// différent, voir CLAUDE.md/roadmap : pas de nouveau module, hébergé ici
// comme /checkin/* l'est dans stay). Aucune logique métier dupliquée :
// login() délègue à AuthService.loginMobile() (même vérification
// d'identifiants que le desktop), la mise à jour de statut délègue à
// HousekeepingService.updateStatus() (même chemin d'écriture unique que
// PATCH /rooms/:id/statut desktop, jamais un second point d'écriture pour
// Room.statut).
@ApiTags('mobile-housekeeping')
@Controller('mobile/housekeeping')
export class MobileHousekeepingController {
  constructor(
    private readonly authService: AuthService,
    private readonly housekeepingService: HousekeepingService,
  ) {}

  // Même limite resserrée que /auth/login (cible directe d'une attaque par
  // force brute) — voir AuthController.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Connexion mobile housekeeping — émet un jeton à portée réduite, sans refresh token',
  })
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.loginMobile(dto, ip);
  }

  @RequirePermission('housekeeping', 'read')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Liste les chambres avec leur statut courant — réponse plate, sans arbre imbriqué (app mobile)',
  })
  @Get('rooms')
  async findAll() {
    const rooms = await this.housekeepingService.findAllRooms();
    return rooms.map(toMobileRoomSummary);
  }

  @RequirePermission('housekeeping', 'write')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Change le statut d'une chambre depuis l'app mobile — même chemin d'écriture que le desktop",
  })
  @Patch('rooms/:id/statut')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MobileRoomStatusUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housekeepingService.updateStatus(
      id,
      dto.statut,
      user.sub,
      dto.commentaire,
    );
  }
}
