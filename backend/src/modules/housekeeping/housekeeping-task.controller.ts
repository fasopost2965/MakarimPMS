import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { HousekeepingTaskService } from './housekeeping-task.service';
import { CreateHousekeepingTaskDto } from './dto/create-housekeeping-task.dto';
import { AssignHousekeepingTaskDto } from './dto/assign-housekeeping-task.dto';
import { HousekeepingTaskActionDto } from './dto/housekeeping-task-action.dto';
import { HousekeepingTaskQueryDto } from './dto/housekeeping-task-query.dto';
import { AssignableUserResponseDto } from './dto/assignable-user-response.dto';

@ApiTags('housekeeping-tasks')
@ApiBearerAuth()
@Controller('housekeeping/tasks')
export class HousekeepingTaskController {
  constructor(private readonly taskService: HousekeepingTaskService) {}

  @RequirePermission('housekeeping', 'read')
  @ApiOperation({ summary: 'Liste paginée des tâches' })
  @Get()
  async findAll(@Query() query: HousekeepingTaskQueryDto) {
    return this.taskService.findAll(query);
  }

  @RequirePermission('housekeeping', 'write')
  @ApiOperation({
    summary: 'Liste des utilisateurs actifs affectables aux tâches',
  })
  @ApiResponse({ type: [AssignableUserResponseDto] })
  @Get('assignable-users')
  async findAssignableUsers() {
    return this.taskService.findAssignableUsers();
  }

  @RequirePermission('housekeeping', 'read')
  @ApiOperation({ summary: "Détail d'une tâche" })
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.taskService.findOne(id);
  }

  @RequirePermission('housekeeping', 'read')
  @ApiOperation({ summary: "Historique paginé d'une tâche" })
  @Get(':id/history')
  async findHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: HousekeepingTaskQueryDto,
  ) {
    return this.taskService.findHistory(id, query);
  }

  @RequirePermission('housekeeping', 'write')
  @ApiOperation({ summary: "Création manuelle d'une tâche" })
  @Post()
  async create(
    @Body() dto: CreateHousekeepingTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.createManual(dto.roomId, dto.motif, user.sub);
  }

  @RequirePermission('housekeeping', 'write')
  @ApiOperation({ summary: "Affectation ou désaffectation d'une tâche" })
  @Patch(':id/assignment')
  async assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignHousekeepingTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.assign(id, dto.assignedUserId, user.sub, dto.motif);
  }

  @RequirePermission('housekeeping', 'write')
  @ApiOperation({ summary: "Démarrage d'une tâche" })
  @Post(':id/start')
  async start(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.start(id, user.sub);
  }

  @RequirePermission('housekeeping', 'write')
  @ApiOperation({ summary: "Complétion d'une tâche" })
  @Post(':id/complete')
  async complete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.complete(id, user.sub);
  }

  @RequirePermission('housekeeping', 'control')
  @ApiOperation({ summary: "Validation d'une tâche terminée" })
  @Post(':id/validate')
  async validateTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HousekeepingTaskActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.validate(id, user.sub, dto.motif);
  }

  @RequirePermission('housekeeping', 'control')
  @ApiOperation({ summary: "Refus de contrôle d'une tâche terminée" })
  @Post(':id/refuse')
  async refuse(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HousekeepingTaskActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.refuse(id, user.sub, dto.motif);
  }

  @RequirePermission('housekeeping', 'write') // Write or Control according to rules, guarded in service too
  @ApiOperation({ summary: "Annulation d'une tâche" })
  @Post(':id/cancel')
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HousekeepingTaskActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.cancel(id, user.sub, dto.motif);
  }

  @RequirePermission('housekeeping', 'control')
  @ApiOperation({ summary: "Réouverture d'une tâche validée" })
  @Post(':id/reopen')
  async reopen(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HousekeepingTaskActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.reopen(id, user.sub, dto.motif);
  }

  @RequirePermission('housekeeping', 'control')
  @ApiOperation({
    summary: 'Réconciliation des chambres sales sans tâche active',
  })
  @Post('reconcile-dirty-rooms')
  async reconcileDirtyRooms(@CurrentUser() user: AuthenticatedUser) {
    return this.taskService.reconcileDirtyRooms(user.sub);
  }
}
