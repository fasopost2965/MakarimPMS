import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TypeLigneFolio } from '@prisma/client';
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

  // Détail des taxes configurables collectées sur une plage de dates,
  // groupé par taxe (taxRateConfigId) — distinct de getFinancialSummary
  // ci-dessus, qui n'expose que des totaux agrégés (TVA hébergement/extras,
  // taxe de séjour) sans le détail par taxe individuelle. Agrège
  // exclusivement depuis FolioLine (jamais Invoice, qui ne stocke que le
  // TTC global) — cohérent avec exportGrandLivre. `taxRateConfigId` n'est
  // renseigné que sur les lignes générées par
  // BillingService.generateInvoice (voir schema.prisma, commentaire
  // FolioLine.taxRateConfigId) ; la TVA n'y figure jamais (appliquée en
  // marge, jamais matérialisée en ligne propre).
  async getTaxesReport(
    dateDebut: string,
    dateFin: string,
    taxeId?: number,
    tresorOnly?: boolean,
  ) {
    const { debut, finExclusive } = this.plageDates(dateDebut, dateFin);

    const [lignes, taxes] = await Promise.all([
      this.prisma.folioLine.findMany({
        where: {
          createdAt: { gte: debut, lt: finExclusive },
          type: TypeLigneFolio.TAXE_SEJOUR,
          taxRateConfigId: taxeId ?? { not: null },
          annulee: false,
        },
      }),
      // Façade parameters — jamais de lecture Prisma directe de
      // TaxRateConfig hors du module parameters.
      this.parametersService.findTaxRates(),
    ]);

    const taxesById = new Map(taxes.map((t) => [t.id, t]));

    const parTaxe = new Map<
      number,
      {
        taxeId: number;
        type: string;
        mode: string;
        collectePourTresor: boolean;
        montantCollecte: Prisma.Decimal;
        nbLignes: number;
      }
    >();

    for (const ligne of lignes) {
      if (!ligne.taxRateConfigId) continue;
      const config = taxesById.get(ligne.taxRateConfigId);
      if (!config) continue;
      if (tresorOnly && !config.collectePourTresor) continue;

      const entry = parTaxe.get(config.id) ?? {
        taxeId: config.id,
        type: config.type,
        mode: config.mode,
        collectePourTresor: config.collectePourTresor,
        montantCollecte: new Prisma.Decimal(0),
        nbLignes: 0,
      };
      entry.montantCollecte = entry.montantCollecte.add(ligne.montant);
      entry.nbLignes += 1;
      parTaxe.set(config.id, entry);
    }

    const detail = Array.from(parTaxe.values()).map((e) => ({
      ...e,
      montantCollecte: e.montantCollecte.toFixed(2),
    }));

    return {
      periode: { dateDebut, dateFin },
      // Section Trésor : sous-ensemble des taxes reversées à l'État
      // (collectePourTresor = true), isolée pour la déclaration DGI —
      // toujours un sous-ensemble de `detail`, jamais une source distincte.
      tresor: detail.filter((d) => d.collectePourTresor),
      detail,
    };
  }
}
