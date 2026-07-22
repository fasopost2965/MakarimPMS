import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { FinancialSummaryQueryDto } from './dto/financial-summary-query.dto';
import { PoliceRegisterQueryDto } from './dto/police-register-query.dto';
import { TaxesReportQueryDto } from './dto/taxes-report-query.dto';
import { FinancialReportingService } from './financial-reporting.service';
import { PoliceReportService } from './police-report.service';
import { ReportingQueue } from './queues/reporting.queue';

@ApiTags('reporting')
@ApiBearerAuth()
@Controller('reporting')
export class ReportingController {
  constructor(
    private readonly financialReportingService: FinancialReportingService,
    private readonly policeReportService: PoliceReportService,
    private readonly reportingQueue: ReportingQueue,
  ) {}

  @RequirePermission('reporting', 'read')
  @ApiOperation({
    summary:
      'Synthèse fiscale (CA, TVA, taxe de séjour) sur une plage de dates',
  })
  @Get('financial-summary')
  financialSummary(@Query() query: FinancialSummaryQueryDto) {
    return this.financialReportingService.getFinancialSummary(
      query.dateDebut,
      query.dateFin,
    );
  }

  @RequirePermission('reporting', 'read')
  @ApiOperation({
    summary:
      'Détail des taxes configurables collectées sur une plage de dates, groupé par taxe (section Trésor isolée pour la déclaration DGI)',
  })
  @Get('taxes')
  taxesReport(@Query() query: TaxesReportQueryDto) {
    return this.financialReportingService.getTaxesReport(
      query.dateDebut,
      query.dateFin,
      query.taxeId,
      query.tresorOnly,
    );
  }

  // BR-REP-001 : format CSV obligatoire pour l'intégration externe
  // (comptable). Point de vigilance SPRINT_13.md §5 : le fichier n'est
  // jamais écrit sur disque, généré en mémoire et streamé directement dans
  // la réponse HTTP.
  @RequirePermission('reporting', 'export')
  @ApiOperation({ summary: 'Exporte le grand livre au format CSV' })
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportGrandLivre(
    @Query() query: FinancialSummaryQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="grand-livre-${query.dateDebut}_${query.dateFin}.csv"`,
    );
    return this.financialReportingService.exportGrandLivre(
      query.dateDebut,
      query.dateFin,
    );
  }

  // Contient des données personnelles sensibles (pièce d'identité) —
  // permission `export` distincte de `read`, réservée Administrateur/
  // Comptable au même titre (RBAC_MATRIX.md n'a pas de ligne dédiée, voir
  // seed.ts pour l'arbitrage).
  @RequirePermission('reporting', 'export')
  @ApiOperation({
    summary: 'Exporte le rapport de police journalier (arrivées) au format CSV',
  })
  @Get('police-report')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async policeReport(
    @Query('date') date: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rapport-police-${date}.csv"`,
    );
    return this.policeReportService.exportDailyReportCsv(date);
  }

  // Registre légal complet (PoliceRecord, obligation DGSN) sur une plage de
  // dates — distinct de /police-report ci-dessus (arrivées d'une seule
  // journée dérivées de Stay/Guest). format=json renvoie les fiches
  // structurées (ex. intégration système tiers) au lieu du CSV par défaut.
  @RequirePermission('reporting', 'export')
  @ApiOperation({
    summary:
      'Exporte le registre légal des personnes hébergées (PoliceRecord) sur une plage de dates, CSV ou JSON',
  })
  @Get('police-register')
  async policeRegister(
    @Query() query: PoliceRegisterQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (query.format === 'json') {
      return this.policeReportService.findRegister(
        query.dateDebut,
        query.dateFin,
      );
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="registre-police-${query.dateDebut}_${query.dateFin}.csv"`,
    );
    return this.policeReportService.exportRegisterCsv(
      query.dateDebut,
      query.dateFin,
    );
  }

  // Capacité additionnelle (file BullMQ/Redis) pour ne pas bloquer le thread
  // principal sur un export volumineux — /reporting/export ci-dessus reste
  // le chemin synchrone existant, inchangé, pour compatibilité descendante.
  @RequirePermission('reporting', 'export')
  @ApiOperation({
    summary:
      'Met en file un export du grand livre en arrière-plan et renvoie un identifiant de job',
  })
  @Get('export/async')
  exportGrandLivreAsync(@Query() query: FinancialSummaryQueryDto) {
    return this.reportingQueue.enqueueExportGrandLivre({
      dateDebut: query.dateDebut,
      dateFin: query.dateFin,
    });
  }

  @RequirePermission('reporting', 'export')
  @ApiOperation({
    summary:
      "Statut d'un job d'export en arrière-plan (et son résultat CSV une fois terminé)",
  })
  @Get('export/async/:jobId')
  async exportJobStatus(@Param('jobId') jobId: string) {
    const status = await this.reportingQueue.getJobStatus(jobId);
    if (!status) {
      throw new NotFoundException(`Job d'export ${jobId} introuvable.`);
    }
    return status;
  }
}
