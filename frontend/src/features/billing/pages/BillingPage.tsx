import { useCallback, useEffect, useState } from 'react';
import { getBillingKpis } from '../api';
import type { BillingKpis } from '../types';
import { BillingKpiStrip } from '../components/BillingKpiStrip';
import { BillingToolbar } from '../components/BillingToolbar';
import { InvoicesView } from '../components/InvoicesView';
import { BillableStaysView } from '../components/BillableStaysView';
import { PaymentsView } from '../components/PaymentsView';
import { InvoiceContextPanel } from '../components/InvoiceContextPanel';

export type BillingView = 'factures' | 'a-facturer' | 'paiements';

interface Props {
  permissions: string[] | null;
}

// DESIGN-010 (Billing Center) — module de production `/billing` (mission
// intégrale : registre global des factures, dossiers à facturer, paiements,
// KPI, panneau facture, PDF/impression/envoi/avoir). Aucune donnée mockée —
// tous les écrans consomment les vraies APIs (GET /invoices, GET /payments,
// GET /stays/facturables, GET /billing/kpis, POST /invoices/generer, POST
// /invoices/:id/credit-notes), inspiré de PrototypeBillingA
// (design/design-005-desktop-prototypes) sans jamais l'importer.
export function BillingPage({ permissions }: Props) {
  const canWrite = permissions?.includes('billing:write') ?? false;
  // DESIGN-010 (correction RBAC finale suite) — billing:send est une
  // permission dédiée, indépendante de billing:write (voir seed.ts,
  // POST /invoices/:id/envoyer) : la Réception peut envoyer une facture
  // déjà émise sans pouvoir en générer ou créer un avoir.
  const canSend = permissions?.includes('billing:send') ?? false;

  const [view, setView] = useState<BillingView>('factures');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState<BillingKpis | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(
    null,
  );

  const loadKpis = useCallback(() => {
    setKpisLoading(true);
    getBillingKpis(from || undefined, to || undefined)
      .then(setKpis)
      .catch(() => setKpis(null))
      .finally(() => setKpisLoading(false));
  }, [from, to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadKpis();
  }, [loadKpis, refreshKey]);

  function handleRefresh() {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    // La bascule visuelle du bouton "Actualiser" n'a pas besoin d'attendre
    // les requêtes réelles (chaque vue enfant gère son propre `loading`) —
    // un court délai suffit à donner un retour visuel immédiat sans faire
    // dépendre BillingPage du cycle de vie réseau de ses enfants.
    setTimeout(() => setRefreshing(false), 400);
  }

  // Après génération de facture (onglet À facturer) : KPI + onglet Factures
  // doivent refléter le changement immédiatement (mission §12).
  function handleGenerated() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <p className="text-muted-foreground text-[11px] font-bold tracking-[0.03em] uppercase">
          Exploitation hôtel
        </p>
        <h1 className="truncate text-xl font-extrabold tracking-[-0.01em]">
          Facturation
        </h1>
      </div>

      <BillingKpiStrip
        kpis={kpis}
        loading={kpisLoading}
        onAFacturerClick={() => setView('a-facturer')}
      />

      <BillingToolbar
        view={view}
        onViewChange={setView}
        search={search}
        onSearchChange={setSearch}
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {view === 'factures' && (
        <InvoicesView
          from={from}
          to={to}
          search={search}
          refreshKey={refreshKey}
          onSelectInvoice={setSelectedInvoiceId}
          canSend={canSend}
        />
      )}
      {view === 'a-facturer' && (
        <BillableStaysView
          from={from}
          to={to}
          search={search}
          refreshKey={refreshKey}
          canWrite={canWrite}
          onGenerated={handleGenerated}
        />
      )}
      {view === 'paiements' && (
        <PaymentsView
          from={from}
          to={to}
          search={search}
          refreshKey={refreshKey}
        />
      )}

      <InvoiceContextPanel
        invoiceId={selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
        canWrite={canWrite}
        canSend={canSend}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
