import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { FinancialSummaryQueryDto } from './dto/financial-summary-query.dto';
import { FinancialReportingService } from './financial-reporting.service';
import { PoliceReportService } from './police-report.service';

@Controller('reporting')
export class ReportingController {
  constructor(
    private readonly financialReportingService: FinancialReportingService,
    private readonly policeReportService: PoliceReportService,
  ) {}

  @RequirePermission('reporting', 'read')
  @Get('financial-summary')
  financialSummary(@Query() query: FinancialSummaryQueryDto) {
    return this.financialReportingService.getFinancialSummary(
      query.dateDebut,
      query.dateFin,
    );
  }

  // BR-REP-001 : format CSV obligatoire pour l'intégration externe
  // (comptable). Point de vigilance SPRINT_13.md §5 : le fichier n'est
  // jamais écrit sur disque, généré en mémoire et streamé directement dans
  // la réponse HTTP.
  @RequirePermission('reporting', 'export')
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
}
