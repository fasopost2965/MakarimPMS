import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ParametersService } from '../parameters/parameters.service';
import { calculerVentilationFiscale } from './utils/ventilation-fiscale.util';
import { toCsv } from './utils/csv.util';

// Module strictement read-only (docs/modules/reporting.md INV-REP-001) :
// uniquement des `findMany` Prisma, jamais d'écriture. BR-COM-002.
@Injectable()
export class FinancialReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametersService: ParametersService,
  ) {}

  private plageDates(dateDebut: string, dateFin: string) {
    const debut = new Date(dateDebut);
    // Borne exclusive du lendemain de dateFin pour inclure toute la journée
    // de fin (mêmes horaires-limites que housekeeping/common/date-range.ts).
    const finExclusive = new Date(
      new Date(dateFin).getTime() + 24 * 60 * 60 * 1000,
    );
    if (debut >= finExclusive) {
      throw new BadRequestException(
        'dateDebut doit être strictement antérieure à dateFin.',
      );
    }
    return { debut, finExclusive };
  }

  async getFinancialSummary(dateDebut: string, dateFin: string) {
    const { debut, finExclusive } = this.plageDates(dateDebut, dateFin);

    const lignes = await this.prisma.folioLine.findMany({
      where: { createdAt: { gte: debut, lt: finExclusive } },
    });
    const taxRates = await this.parametersService.getTaxRateMap();

    const ventilation = calculerVentilationFiscale(lignes, taxRates);
    return {
      periode: { dateDebut, dateFin },
      ...ventilation,
    };
  }

  async exportGrandLivre(dateDebut: string, dateFin: string): Promise<string> {
    const { debut, finExclusive } = this.plageDates(dateDebut, dateFin);

    const lignes = await this.prisma.folioLine.findMany({
      where: { createdAt: { gte: debut, lt: finExclusive } },
      include: { folio: true },
      orderBy: { createdAt: 'asc' },
    });

    return toCsv(
      [
        'date',
        'folioId',
        'sejourId',
        'type',
        'libelle',
        'montantHT',
        'annulee',
      ],
      lignes.map((l) => [
        l.createdAt.toISOString(),
        l.folioId,
        l.folio.stayId,
        l.type,
        l.libelle,
        l.montant.toString(),
        l.annulee,
      ]),
    );
  }
}
