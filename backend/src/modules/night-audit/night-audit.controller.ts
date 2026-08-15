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
import { NightAuditService } from './night-audit.service';
import { AcknowledgeWarningDto } from './dto/acknowledge-warning.dto';
import { CloseNightAuditDto } from './dto/close-night-audit.dto';

@ApiTags('night-audit')
@ApiBearerAuth()
@Controller('night-audit')
export class NightAuditController {
  constructor(private readonly nightAuditService: NightAuditService) {}

  @RequirePermission('night-audit', 'read')
  @ApiOperation({
    summary: 'Business Date courante + run Night Audit actif (le cas échéant)',
  })
  @Get('current')
  getCurrent() {
    return this.nightAuditService.getCurrent();
  }

  @RequirePermission('night-audit', 'read')
  @ApiOperation({ summary: 'Historique des BusinessDay clôturées' })
  @Get('history')
  getHistory() {
    return this.nightAuditService.getHistory();
  }

  @RequirePermission('night-audit', 'read')
  @ApiOperation({
    summary: 'Rapport de réconciliation figé (snapshot) d’un run',
  })
  @Get(':runId/report')
  getReport(@Param('runId', ParseIntPipe) runId: number) {
    return this.nightAuditService.getReport(runId);
  }

  // night-audit:run (Administrateur uniquement en v1, cf seed.ts) — démarre
  // un run pour la BusinessDay OPEN courante. Idempotent (voir
  // NightAuditService.start).
  @RequirePermission('night-audit', 'run')
  @ApiOperation({
    summary: 'Démarre le Night Audit pour la Business Date courante',
  })
  @Post('start')
  start(@CurrentUser() user: AuthenticatedUser) {
    return this.nightAuditService.start(user.sub);
  }

  @RequirePermission('night-audit', 'run')
  @ApiOperation({
    summary:
      'Réexécute les contrôles PRECHECK (après correction dans un module canonique)',
  })
  @Post(':runId/revalidate')
  revalidate(@Param('runId', ParseIntPipe) runId: number) {
    return this.nightAuditService.revalidate(runId);
  }

  @RequirePermission('night-audit', 'run')
  @ApiOperation({
    summary:
      'Acquitte une exception WARNING (motif obligatoire) — jamais un BLOCKER',
  })
  @Post(':runId/exceptions/:exceptionId/acknowledge')
  acknowledge(
    @Param('runId', ParseIntPipe) runId: number,
    @Param('exceptionId', ParseIntPipe) exceptionId: number,
    @Body() dto: AcknowledgeWarningDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nightAuditService.acknowledgeWarning(
      runId,
      exceptionId,
      dto,
      user.sub,
    );
  }

  @RequirePermission('night-audit', 'run')
  @ApiOperation({
    summary:
      'Posting foundation — vérifie l’absence de blocker (ARCH-011A : aucune nuitée repostée)',
  })
  @Post(':runId/posting')
  posting(
    @Param('runId', ParseIntPipe) runId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nightAuditService.posting(runId, user.sub);
  }

  @RequirePermission('night-audit', 'run')
  @ApiOperation({ summary: 'Calcule et fige le snapshot de réconciliation' })
  @Post(':runId/reconcile')
  reconcile(
    @Param('runId', ParseIntPipe) runId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nightAuditService.reconcile(runId, user.sub);
  }

  @RequirePermission('night-audit', 'run')
  @ApiOperation({
    summary:
      'Prépare la clôture (vérifie les conditions, passe le run en phase CLOSING)',
  })
  @Post(':runId/prepare-closing')
  prepareClosing(@Param('runId', ParseIntPipe) runId: number) {
    return this.nightAuditService.prepareClosing(runId);
  }

  // night-audit:close — action la plus sensible (transition irréversible
  // BusinessDay J CLOSED -> J+1 OPEN), permission distincte de :run.
  @RequirePermission('night-audit', 'close')
  @ApiOperation({
    summary:
      'Clôture la Business Date (motif obligatoire, transaction atomique J->J+1)',
  })
  @Post(':runId/close')
  close(
    @Param('runId', ParseIntPipe) runId: number,
    @Body() dto: CloseNightAuditDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.nightAuditService.close(runId, user.sub, dto);
  }
}
