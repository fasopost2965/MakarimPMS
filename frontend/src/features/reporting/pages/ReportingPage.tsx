import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  exportGrandLivre,
  exportPoliceReport,
  getFinancialSummary,
} from '../api';
import type { FinancialSummary } from '../types';

const LIGNE_LABEL: Record<keyof Omit<FinancialSummary, 'periode'>, string> = {
  caNetHtHebergement: 'CA net HT hébergement',
  caNetHtExtras: 'CA net HT extras',
  tvaHebergementCollectee: 'TVA hébergement collectée',
  tvaExtrasCollectee: 'TVA extras collectée',
  taxeSejourCollectee: 'Taxe de séjour collectée',
  soldeBrutEncaisse: 'Solde brut encaissé',
};

// Module reporting (docs/modules/reporting.md, strictement lecture seule
// côté backend, INV-REP-001) : synthèse fiscale sur une plage de dates,
// export CSV du grand livre pour l'intégration comptable (BR-REP-001), et
// rapport de police journalier des arrivées (permission `reporting:export`,
// distincte de `read` — données d'identité sensibles).
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
    </div>
  );
}
