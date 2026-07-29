import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  exportGrandLivre,
  exportPoliceReport,
  exportPoliceRegister,
  getFinancialSummary,
  getPoliceRegister,
  getTaxesReport,
  getYieldForecast,
} from '../api';
import type {
  FinancialSummary,
  PoliceRegisterEntry,
  RecommandationTarifaire,
  TaxesReport,
  YieldForecast,
} from '../types';

const LIGNE_LABEL: Record<keyof Omit<FinancialSummary, 'periode'>, string> = {
  caNetHtHebergement: 'CA net HT hébergement',
  caNetHtExtras: 'CA net HT extras',
  tvaHebergementCollectee: 'TVA hébergement collectée',
  tvaExtrasCollectee: 'TVA extras collectée',
  taxeSejourCollectee: 'Taxe de séjour collectée',
  soldeBrutEncaisse: 'Solde brut encaissé',
};

const RECOMMANDATION_LABEL: Record<RecommandationTarifaire, string> = {
  HAUSSE: 'Hausse suggérée',
  BAISSE: 'Baisse suggérée',
  MAINTIEN: 'Stable',
};

const RECOMMANDATION_VARIANT: Record<
  RecommandationTarifaire,
  'default' | 'secondary' | 'destructive'
> = {
  HAUSSE: 'default',
  BAISSE: 'destructive',
  MAINTIEN: 'secondary',
};

// Module reporting (docs/modules/reporting.md, strictement lecture seule
// côté backend, INV-REP-001) : synthèse fiscale, export du grand livre
// (BR-REP-001), rapport de police journalier — et depuis CH-054, 3 écrans
// pour des endpoints déjà réels côté backend mais jamais consommés côté
// frontend jusqu'ici (détail des taxes/déclaration DGI, registre légal
// police sur une plage de dates, prévision de revenu F3/Yield Management).
export function ReportingPage() {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [policeDate, setPoliceDate] = useState('');
  const [exportingPolice, setExportingPolice] = useState(false);
  const [policeError, setPoliceError] = useState<string | null>(null);

  const canQuery = dateDebut && dateFin;

  async function handleSummary() {
    if (!canQuery) return;
    setLoading(true);
    setError(null);
    try {
      setSummary(await getFinancialSummary(dateDebut, dateFin));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!canQuery) return;
    setExporting(true);
    setError(null);
    try {
      await exportGrandLivre(dateDebut, dateFin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setExporting(false);
    }
  }

  async function handlePoliceExport() {
    if (!policeDate) return;
    setExportingPolice(true);
    setPoliceError(null);
    try {
      await exportPoliceReport(policeDate);
    } catch (err) {
      setPoliceError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setExportingPolice(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex max-w-lg flex-col gap-3 rounded-md border p-4">
        <p className="text-sm font-medium">Synthèse fiscale</p>
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="dateDebut">Début</Label>
            <Input
              id="dateDebut"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="dateFin">Fin</Label>
            <Input
              id="dateFin"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!canQuery || loading}
            onClick={handleSummary}
          >
            {loading ? 'Calcul…' : 'Calculer'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canQuery || exporting}
            onClick={handleExport}
          >
            {exporting ? 'Export…' : 'Exporter le grand livre (CSV)'}
          </Button>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {summary && (
          <div className="mt-2 flex flex-col gap-1 rounded bg-gray-50 p-2 text-sm">
            {(Object.keys(LIGNE_LABEL) as (keyof typeof LIGNE_LABEL)[]).map(
              (key) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {LIGNE_LABEL[key]}
                  </span>
                  <span className="font-mono">{summary[key]} MAD</span>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <TaxesReportCard />

      <div className="flex max-w-lg flex-col gap-3 rounded-md border p-4">
        <p className="text-sm font-medium">
          Rapport de police (arrivées du jour)
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="policeDate">Date</Label>
          <Input
            id="policeDate"
            type="date"
            value={policeDate}
            onChange={(e) => setPoliceDate(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="w-fit"
          disabled={!policeDate || exportingPolice}
          onClick={handlePoliceExport}
        >
          {exportingPolice ? 'Export…' : 'Exporter (CSV)'}
        </Button>
        {policeError && (
          <p className="text-destructive text-sm">{policeError}</p>
        )}
      </div>

      <PoliceRegisterCard />

      <YieldForecastCard />
    </div>
  );
}

// CH-054 — GET /reporting/taxes : détail par taxe collectée sur une plage
// de dates, section Trésor isolée pour la déclaration DGI (sous-ensemble
// collectePourTresor=true de `detail`, jamais une source distincte).
function TaxesReportCard() {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [report, setReport] = useState<TaxesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleQuery() {
    if (!dateDebut || !dateFin) return;
    setLoading(true);
    setError(null);
    try {
      setReport(await getTaxesReport(dateDebut, dateFin));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3 rounded-md border p-4">
      <p className="text-sm font-medium">
        Détail des taxes collectées (déclaration DGI)
      </p>
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="taxesDebut">Début</Label>
          <Input
            id="taxesDebut"
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="taxesFin">Fin</Label>
          <Input
            id="taxesFin"
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
          />
        </div>
      </div>
      <Button
        size="sm"
        className="w-fit"
        disabled={!dateDebut || !dateFin || loading}
        onClick={handleQuery}
      >
        {loading ? 'Calcul…' : 'Calculer'}
      </Button>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {report && (
        <div className="flex flex-col gap-3">
          {report.detail.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucune taxe collectée sur cette période.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Taxe</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Trésor</TableHead>
                  <TableHead className="text-right">Lignes</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.detail.map((t) => (
                  <TableRow key={t.taxeId}>
                    <TableCell>{t.type}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.mode}
                    </TableCell>
                    <TableCell>
                      {t.collectePourTresor && (
                        <Badge variant="secondary">Trésor</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{t.nbLignes}</TableCell>
                    <TableCell className="text-right font-mono">
                      {t.montantCollecte} MAD
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-muted-foreground text-xs">
            Section Trésor (déclaration DGI) : {report.tresor.length} taxe(s)
            sur {report.detail.length} — total{' '}
            {report.tresor
              .reduce((sum, t) => sum + Number(t.montantCollecte), 0)
              .toFixed(2)}{' '}
            MAD.
          </p>
        </div>
      )}
    </div>
  );
}

// CH-054 — GET /reporting/police-register : registre légal complet
// (PoliceRecord) sur une plage de dates, distinct du "rapport de police"
// ci-dessus qui ne couvre que les arrivées d'une seule journée.
function PoliceRegisterCard() {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [entries, setEntries] = useState<PoliceRegisterEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canQuery = Boolean(dateDebut && dateFin);

  async function handleQuery() {
    if (!canQuery) return;
    setLoading(true);
    setError(null);
    try {
      setEntries(await getPoliceRegister(dateDebut, dateFin));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!canQuery) return;
    setExporting(true);
    setError(null);
    try {
      await exportPoliceRegister(dateDebut, dateFin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-3 rounded-md border p-4">
      <p className="text-sm font-medium">
        Registre légal des personnes hébergées (obligation DGSN)
      </p>
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="registreDebut">Début</Label>
          <Input
            id="registreDebut"
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="registreFin">Fin</Label>
          <Input
            id="registreFin"
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={!canQuery || loading} onClick={handleQuery}>
          {loading ? 'Chargement…' : 'Consulter'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!canQuery || exporting}
          onClick={handleExport}
        >
          {exporting ? 'Export…' : 'Exporter (CSV)'}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {entries &&
        (entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune fiche de police sur cette période.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Chambre</TableHead>
                <TableHead>Pièce</TableHead>
                <TableHead>Nationalité</TableHead>
                <TableHead>Arrivée</TableHead>
                <TableHead>Départ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    {e.guest.prenom} {e.guest.nom}
                  </TableCell>
                  <TableCell>{e.stay.room.numero}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.typePiece} — {e.numeroPiece}
                  </TableCell>
                  <TableCell>{e.nationalite}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {e.dateArrivee.slice(0, 10)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {e.dateDepart ? e.dateDepart.slice(0, 10) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}
    </div>
  );
}

// CH-054 (F3) — GET /reporting/yield-forecast : prévision d'occupation par
// type de chambre et par jour, avec recommandation tarifaire indicative.
// Purement consultatif (INV-REP-001) — n'écrit jamais sur SeasonRate,
// aucune action de mise à jour tarifaire depuis cet écran.
function YieldForecastCard() {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [forecast, setForecast] = useState<YieldForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleQuery() {
    if (!dateDebut || !dateFin) return;
    setLoading(true);
    setError(null);
    try {
      setForecast(await getYieldForecast(dateDebut, dateFin));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-3 rounded-md border p-4">
      <div>
        <p className="text-sm font-medium">
          Prévision de revenu (Yield Management)
        </p>
        <p className="text-muted-foreground text-xs">
          Consultatif uniquement — la mise à jour effective de la grille
          tarifaire reste une action manuelle dans Paramètres.
        </p>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="yieldDebut">Début</Label>
          <Input
            id="yieldDebut"
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="yieldFin">Fin</Label>
          <Input
            id="yieldFin"
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
          />
        </div>
      </div>
      <Button
        size="sm"
        className="w-fit"
        disabled={!dateDebut || !dateFin || loading}
        onClick={handleQuery}
      >
        {loading ? 'Calcul…' : 'Calculer'}
      </Button>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {forecast && (
        <div className="flex flex-col gap-4">
          {forecast.typesChambre.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucun type de chambre trouvé.
            </p>
          ) : (
            forecast.typesChambre.map((tc) => (
              <div key={tc.roomTypeId} className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">
                  {tc.nom}{' '}
                  <span className="text-muted-foreground font-normal">
                    ({tc.totalChambres} chambre(s) — occupation moyenne{' '}
                    {tc.tauxOccupationMoyen}%)
                  </span>
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Occupation</TableHead>
                      <TableHead className="text-right">Prix actuel</TableHead>
                      <TableHead>Recommandation</TableHead>
                      <TableHead className="text-right">Prix suggéré</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tc.previsions.map((p) => (
                      <TableRow key={p.date}>
                        <TableCell className="whitespace-nowrap">
                          {p.date}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.chambresOccupees}/{p.totalChambres} (
                          {p.tauxOccupation}%)
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {p.prixActuel} MAD
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={RECOMMANDATION_VARIANT[p.recommandation]}
                          >
                            {RECOMMANDATION_LABEL[p.recommandation]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {p.prixSuggere} MAD
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
