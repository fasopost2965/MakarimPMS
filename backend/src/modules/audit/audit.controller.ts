import { Controller, Get, Query } from '@nestjs/common';
import { AuditAction, AuditEntity } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuditService } from './audit.service';

// Lecture seule (INV-AUD-001) — aucune route d'écriture n'est exposée ici,
// AuditService.writeLog() n'est appelé que depuis les services métier qui
// auditent leurs propres opérations sensibles, jamais depuis l'extérieur.
@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @RequirePermission('audit', 'read')
  @ApiOperation({ summary: "Recherche dans le registre d'audit append-only" })
  @Get()
  findAll(
    @Query('entite') entite?: AuditEntity,
    @Query('userId') userId?: string,
    @Query('action') action?: AuditAction,
    @Query('du') du?: string,
    @Query('au') au?: string,
  ) {
    return this.auditService.findMany({
      entite,
      userId: userId ? Number(userId) : undefined,
      action,
      du,
      au,
    });
  }
}
