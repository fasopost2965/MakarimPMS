import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  HAUSSE: 'Hausse',
  BAISSE: 'Baisse',
  MAINTIEN: 'Maintien',
};

const RECOMMANDATION_VARIANT: Record<
  RecommandationTarifaire,
  'success' | 'destructive' | 'outline'
> = {
  HAUSSE: 'success',
  BAISSE: 'destructive',
  MAINTIEN: 'outline',
};

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Module reporting (docs/modules/reporting.md, strictement lecture seule
// côté backend, INV-REP-001 ; refonte visuelle batch 3 design handoff,
// Reporting.dc.html) : synthèse fiscale, export du grand livre (BR-REP-001),
// détail des taxes/déclaration DGI, registre légal police, prévision de
// revenu (F3/Yield Management) — désormais une plage de dates unique
// partagée par les 4 sections (« Actualiser les rapports »), au lieu de 4
// formulaires indépendants à dates propres. Le rapport de police « arrivées
// du jour » (un seul jour, distinct du registre sur plage de dates) est
// conservé en action secondaire compacte — le mockup ne le montre pas
// explicitement mais rien ne justifie de retirer une capacité déjà réelle.
export function ReportingPage() {
  const [dateDebut, setDateDebut] = useState(firstOfMonth());
  const [dateFin, setDateFin] = useState(today());
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [taxes, setTaxes] = useState<TaxesReport | null>(null);
  const [police, setPolice] = useState<PoliceRegisterEntry[] | null>(null);
  const [yieldForecast, setYieldForecast] = useState<YieldForecast | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exportingGrandLivre, setExportingGrandLivre] = useState(false);
  const [exportingPoliceRegistre, setExportingPoliceRegistre] = useState(false);
  const [policeDateJour, setPoliceDateJour] = useState('');
  const [exportingPoliceJour, setExportingPoliceJour] = useState(false);
  const [policeJourError, setPoliceJourError] = useState<string | null>(null);
  const [roomTypeFilter, setRoomTypeFilter] = useState('ALL');

  const canQuery = Boolean(dateDebut && dateFin);

  async function handleRefresh() {
    if (!canQuery) return;
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      getFinancialSummary(dateDebut, dateFin),
      getTaxesReport(dateDebut, dateFin),
      getPoliceRegister(dateDebut, dateFin),
      getYieldForecast(dateDebut, dateFin),
    ]);
    const [summaryRes, taxesRes, policeRes, yieldRes] = results;
    if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
    if (taxesRes.status === 'fulfilled') setTaxes(taxesRes.value);
    if (policeRes.status === 'fulfilled') setPolice(policeRes.value);
    if (yieldRes.status === 'fulfilled') setYieldForecast(yieldRes.value);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      setError(
        `${failed.length} rapport(s) n'ont pas pu être chargés — réessayez.`,
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void handleRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExportGrandLivre() {
    if (!canQuery) return;
    setExportingGrandLivre(true);
    try {
      await exportGrandLivre(dateDebut, dateFin);
    } finally {
      setExportingGrandLivre(false);
    }
  }

  async function handleExportPoliceRegistre() {
    if (!canQuery) return;
    setExportingPoliceRegistre(true);
    try {
      await exportPoliceRegister(dateDebut, dateFin);
    } finally {
      setExportingPoliceRegistre(false);
    }
  }

  async function handleExportPoliceJour() {
    if (!policeDateJour) return;
    setExportingPoliceJour(true);
    setPoliceJourError(null);
    try {
      await exportPoliceReport(policeDateJour);
    } catch (err) {
      setPoliceJourError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setExportingPoliceJour(false);
    }
  }

  const roomTypeOptions = useMemo(
    () => yieldForecast?.typesChambre.map((tc) => tc.nom) ?? [],
    [yieldForecast],
  );
  const filteredTypesChambre = useMemo(
    () =>
      (yieldForecast?.typesChambre ?? []).filter(
        (tc) => roomTypeFilter === 'ALL' || tc.nom === roomTypeFilter,
      ),
    [yieldForecast, roomTypeFilter],
  );

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="dateDebut" className="text-xs font-normal">
            Du
          </Label>
          <Input
            id="dateDebut"
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="dateFin" className="text-xs font-normal">
            Au
          </Label>
          <Input
            id="dateFin"
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={!canQuery || loading}
          onClick={() => void handleRefresh()}
        >
          {loading ? 'Actualisation…' : 'Actualiser les rapports'}
        </Button>
        <span className="text-muted-foreground ml-auto text-xs">
          Module strictement en lecture — aucune donnée d'exploitation n'est
          modifiée depuis cet écran.
        </span>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
            Résumé financier — {dateDebut} au {dateFin}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={!canQuery || exportingGrandLivre}
            onClick={() => void handleExportGrandLivre()}
          >
            {exportingGrandLivre ? 'Export…' : 'Exporter le grand livre (CSV)'}
          </Button>
        </div>
        {summary && (
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(LIGNE_LABEL) as (keyof typeof LIGNE_LABEL)[]).map(
              (key) => (
                <div
                  key={key}
                  className={`flex flex-col gap-2 rounded-lg border p-4 ${
                    key === 'soldeBrutEncaisse'
                      ? 'border-primary/30 bg-primary/5'
                      : ''
                  }`}
                >
                  <span
                    className={`text-[10.5px] font-bold tracking-wide uppercase ${
                      key === 'soldeBrutEncaisse'
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {LIGNE_LABEL[key]}
                  </span>
                  <span
                    className={`text-xl font-bold tracking-tight ${
                      key === 'soldeBrutEncaisse' ? 'text-primary' : ''
                    }`}
                  >
                    {summary[key]} MAD
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
          Taxes collectées
        </span>
        <div className="grid grid-cols-2 items-start gap-4">
          <div className="bg-card overflow-hidden rounded-lg border">
            <div className="border-b px-4.5 py-3 text-sm font-semibold">
              Part reversée au Trésor
            </div>
            <div className="overflow-x-auto">
              <div className="bg-muted/60 text-muted-foreground grid min-w-[280px] grid-cols-[1fr_90px_60px] gap-2 px-4.5 py-2 text-[11px] font-bold">
                <span>Type</span>
                <span>Montant</span>
                <span>Lignes</span>
              </div>
              {!taxes || taxes.tresor.length === 0 ? (
                <p className="text-muted-foreground px-4.5 py-3 text-sm">
                  Aucune taxe reversée au Trésor sur cette période.
                </p>
              ) : (
                taxes.tresor.map((t) => (
                  <div
                    key={t.taxeId}
                    className="grid min-w-[280px] grid-cols-[1fr_90px_60px] items-center gap-2 border-t px-4.5 py-2 text-sm"
                  >
                    <span>{t.type}</span>
                    <span>{t.montantCollecte} MAD</span>
                    <span>{t.nbLignes}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-card overflow-hidden rounded-lg border">
            <div className="border-b px-4.5 py-3 text-sm font-semibold">
              Détail complet
            </div>
            <div className="overflow-x-auto">
              <div className="bg-muted/60 text-muted-foreground grid min-w-[340px] grid-cols-[1fr_60px_90px_60px] gap-2 px-4.5 py-2 text-[11px] font-bold">
                <span>Type</span>
                <span>Trésor</span>
                <span>Montant</span>
                <span>Lignes</span>
              </div>
              {!taxes || taxes.detail.length === 0 ? (
                <p className="text-muted-foreground px-4.5 py-3 text-sm">
                  Aucune taxe collectée sur cette période.
                </p>
              ) : (
                taxes.detail.map((t) => (
                  <div
                    key={t.taxeId}
                    className="grid min-w-[340px] grid-cols-[1fr_60px_90px_60px] items-center gap-2 border-t px-4.5 py-2 text-sm"
                  >
                    <span>{t.type}</span>
                    <span>{t.collectePourTresor ? 'Oui' : 'Non'}</span>
                    <span>{t.montantCollecte} MAD</span>
                    <span>{t.nbLignes}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
            Prévision d'occupation &amp; recommandation tarifaire (Yield)
          </span>
          {roomTypeOptions.length > 0 && (
            <Select
              value={roomTypeFilter}
              onValueChange={(v) => v && setRoomTypeFilter(v)}
              items={[
                { value: 'ALL', label: 'Tous les types de chambre' },
                ...roomTypeOptions.map((nom) => ({ value: nom, label: nom })),
              ]}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les types de chambre</SelectItem>
                {roomTypeOptions.map((nom) => (
                  <SelectItem key={nom} value={nom}>
                    {nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="bg-card overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <div className="bg-muted/60 text-muted-foreground grid min-w-[760px] grid-cols-[110px_1fr_110px_100px_110px_100px_110px] gap-2 px-4.5 py-2 text-[11px] font-bold">
              <span>Date</span>
              <span>Type de chambre</span>
              <span>Occupation</span>
              <span>Prix actuel</span>
              <span>Recommandation</span>
              <span>Ajustement</span>
              <span>Prix suggéré</span>
            </div>
            {filteredTypesChambre.length === 0 ? (
              <p className="text-muted-foreground px-4.5 py-3 text-sm">
                Aucune prévision disponible.
              </p>
            ) : (
              filteredTypesChambre.flatMap((tc) =>
                tc.previsions.map((p) => (
                  <div
                    key={`${tc.roomTypeId}-${p.date}`}
                    className="grid min-w-[760px] grid-cols-[110px_1fr_110px_100px_110px_100px_110px] items-center gap-2 border-t px-4.5 py-2 text-sm"
                  >
                    <span className="whitespace-nowrap">{p.date}</span>
                    <span>{tc.nom}</span>
                    <span>{p.tauxOccupation}%</span>
                    <span>{p.prixActuel} MAD</span>
                    <Badge
                      variant={RECOMMANDATION_VARIANT[p.recommandation]}
                      className="w-fit"
                    >
                      {RECOMMANDATION_LABEL[p.recommandation]}
                    </Badge>
                    <span>
                      {p.recommandation === 'MAINTIEN'
                        ? '—'
                        : `${p.ajustementSuggerePct > 0 ? '+' : ''}${p.ajustementSuggerePct}%`}
                    </span>
                    <span>{p.prixSuggere} MAD</span>
                  </div>
                )),
              )
            )}
          </div>
        </div>
        <p className="text-muted-foreground text-[11px]">
          Recommandation purement indicative (seuils fixes : ≥80% hausse,
          &lt;40% baisse) — aucune écriture automatique sur la grille tarifaire
          ; toute application reste un acte humain dans Paramètres.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
            Registre de police — déclarations nuitées
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={policeDateJour}
              onChange={(e) => setPoliceDateJour(e.target.value)}
              className="h-8 w-36"
              title="Export des arrivées d'un seul jour"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!policeDateJour || exportingPoliceJour}
              onClick={() => void handleExportPoliceJour()}
            >
              {exportingPoliceJour ? 'Export…' : 'Arrivées du jour (CSV)'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canQuery || exportingPoliceRegistre}
              onClick={() => void handleExportPoliceRegistre()}
            >
              {exportingPoliceRegistre
                ? 'Export…'
                : 'Exporter le registre (CSV)'}
            </Button>
          </div>
        </div>
        {policeJourError && (
          <p className="text-destructive text-sm">{policeJourError}</p>
        )}
        <div className="bg-card overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <div className="bg-muted/60 text-muted-foreground grid min-w-[750px] grid-cols-[150px_90px_80px_110px_100px_100px_110px] gap-2 px-4.5 py-2 text-[11px] font-bold">
              <span>Client</span>
              <span>Chambre</span>
              <span>Pièce</span>
              <span>Nationalité</span>
              <span>Arrivée</span>
              <span>Départ</span>
              <span>Provenance</span>
            </div>
            {!police || police.length === 0 ? (
              <p className="text-muted-foreground px-4.5 py-3 text-sm">
                Aucune fiche de police sur cette période.
              </p>
            ) : (
              police.map((e) => (
                <div
                  key={e.id}
                  className="grid min-w-[750px] grid-cols-[150px_90px_80px_110px_100px_100px_110px] items-center gap-2 border-t px-4.5 py-2 text-sm"
                >
                  <span className="truncate">
                    {e.guest.prenom} {e.guest.nom}
                  </span>
                  <span>{e.stay.room.numero}</span>
                  <span className="text-muted-foreground text-xs">
                    {e.typePiece}
                  </span>
                  <span>{e.nationalite}</span>
                  <span className="whitespace-nowrap">
                    {e.dateArrivee.slice(0, 10)}
                  </span>
                  <span className="whitespace-nowrap">
                    {e.dateDepart ? e.dateDepart.slice(0, 10) : '—'}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {e.villeProvenance ?? e.paysProvenance ?? '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <p className="text-muted-foreground text-[11px]">
          Données personnelles sensibles — export réservé aux besoins
          réglementaires (Sûreté nationale, ministère du Tourisme), consultation
          soumise au même RBAC que l'écran.
        </p>
      </div>
    </div>
  );
}
