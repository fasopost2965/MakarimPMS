import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
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
import { HousekeepingTaskService } from './housekeeping-task.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { MobileRoomStatusUpdateDto } from './dto/mobile-room-status-update.dto';
import { MobileTaskQueryDto } from './dto/mobile-task-query.dto';
import { MobileInspectionQueueQueryDto } from './dto/mobile-inspection-queue-query.dto';
import { HousekeepingTaskActionDto } from './dto/housekeeping-task-action.dto';
import { ReportIncidentDto } from './dto/report-incident.dto';
import { toMobileRoomSummary } from './utils/mobile-room.mapper';

// F9 — surface dédiée à l'app mobile housekeeping (même domaine, transport
// différent, voir CLAUDE.md/roadmap : pas de nouveau module, hébergé ici
// comme /checkin/* l'est dans stay). Aucune logique métier dupliquée :
// login() délègue à AuthService.loginMobile() (même vérification
// d'identifiants que le desktop), la mise à jour de statut délègue à
// HousekeepingService.updateStatus() (même chemin d'écriture unique que
// PATCH /rooms/:id/statut desktop, jamais un second point d'écriture pour
// Room.statut).
//
// B0.4A (DESIGN-004B, design gelé) — endpoints additifs délégateurs vers
// HousekeepingTaskService/MaintenanceService, imposés par JwtAuthGuard : un
// jeton scope="mobile-housekeeping" est rejeté hors de
// /api/mobile/housekeeping/* (voir jwt-auth.guard.ts), donc impossible
// d'appeler HousekeepingTaskController ou MaintenanceController
// directement depuis le mobile. PATCH rooms/:id/statut (legacy) reste en
// place dans ce lot — sa suppression est un lot ultérieur, après
// déploiement du nouveau frontend mobile.
@ApiTags('mobile-housekeeping')
@Controller('mobile/housekeeping')
export class MobileHousekeepingController {
  constructor(
    private readonly authService: AuthService,
    private readonly housekeepingService: HousekeepingService,
    private readonly taskService: HousekeepingTaskService,
    private readonly maintenanceService: MaintenanceService,
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

  // B0.4A — liste des tâches assignées à l'agent connecté uniquement.
  // assignedUserId n'est jamais lu depuis la requête (MobileTaskQueryDto n'a
  // pas ce champ ; forbidNonWhitelisted global le rejetterait en 400 s'il
  // était présent) — toujours forcé à user.sub, anti-IDOR (même convention
  // que CreatePublicReservationDto pour guestId, F4).
  @RequirePermission('housekeeping', 'write')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Tâches de ménage assignées à l'agent mobile connecté",
  })
  @Get('tasks/mine')
  findMyTasks(
    @Query() query: MobileTaskQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.findAll({ ...query, assignedUserId: user.sub });
  }

  // B0.4B suite (Supervisor Inspection Queue Fix, DESIGN-004B) — GET
  // tasks/mine force assignedUserId au user connecté (voir plus haut) :
  // une Gouvernante non assignée à une tâche TERMINEE ne pouvait donc pas la
  // voir ni la valider/refuser depuis mobile. Cet endpoint comble ce vide
  // sans dupliquer de logique : délègue à HousekeepingTaskService.findAll()
  // en forçant systématiquement statut=TERMINEE et active=true côté
  // serveur — jamais un filtre choisi par le client (aucun champ statut ni
  // active ni assignedUserId dans MobileInspectionQueueQueryDto,
  // forbidNonWhitelisted global rejetterait sinon la tentative en 400).
  // housekeeping:control (Gouvernante uniquement, même permission que
  // validate/refuse ci-dessous) — un compte sans cette permission reçoit
  // 403, PermissionsGuard vérifié à chaque appel.
  @RequirePermission('housekeeping', 'control')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'File des tâches terminées en attente de contrôle, tous agents confondus (Gouvernante)',
  })
  @Get('tasks/to-inspect')
  findTasksToInspect(@Query() query: MobileInspectionQueueQueryDto) {
    return this.taskService.findAll({
      ...query,
      statut: 'TERMINEE' as const,
      active: true,
    });
  }

  @RequirePermission('housekeeping', 'write')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Démarrage d'une tâche depuis le mobile — délègue à HousekeepingTaskService.start()",
  })
  @Post('tasks/:id/start')
  startTask(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.start(id, user.sub);
  }

  @RequirePermission('housekeeping', 'write')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Complétion d'une tâche depuis le mobile — délègue à HousekeepingTaskService.complete()",
  })
  @Post('tasks/:id/complete')
  completeTask(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.complete(id, user.sub);
  }

  // housekeeping:control (Gouvernante) — même permission, mêmes garde-fous
  // que le desktop (auto-validation interdite, motif ≥ 10 caractères), rien
  // de dupliqué : ce endpoint ne fait que déléguer.
  @RequirePermission('housekeeping', 'control')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Validation d'une tâche terminée depuis le mobile (Gouvernante)",
  })
  @Post('tasks/:id/validate')
  validateTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HousekeepingTaskActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.validate(id, user.sub, dto.motif);
  }

  @RequirePermission('housekeeping', 'control')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Refus de contrôle d'une tâche terminée depuis le mobile (Gouvernante)",
  })
  @Post('tasks/:id/refuse')
  refuseTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HousekeepingTaskActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.refuse(id, user.sub, dto.motif);
  }

  // B0.4A (DESIGN-004B, Finding 2) — signalement d'un incident terrain sans
  // jamais réintroduire EN_MAINTENANCE manuel : délègue exclusivement à
  // MaintenanceService.createTicket(), qui crée un vrai MaintenanceTicket
  // (bloqueVente=true par défaut dès qu'un roomId est fourni) et projette
  // la chambre en EN_MAINTENANCE via son propre chemin canonique
  // (projectBlockingRoom) — jamais d'écriture directe de Room.statut ici.
  // Permission dédiée housekeeping:report-incident (jamais maintenance:write
  // accordé au terrain pour ce seul besoin).
  @RequirePermission('housekeeping', 'report-incident')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Signale un incident/panne depuis le mobile — crée un vrai MaintenanceTicket',
  })
  @Post('incidents')
  reportIncident(
    @Body() dto: ReportIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.maintenanceService.createTicket(dto, user.sub);
  }
}
