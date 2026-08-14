import { FileText, Receipt, Wallet } from 'lucide-react';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/kpi-card';
import { MoneyDisplay } from '@/components/ui/money-display';
import type { BillingKpis } from '../types';

// DESIGN-010 (Billing Center, mission §6) — bande de 4 KPI, formules
// gelées et calculées côté serveur (BillingService.getKpis) — jamais
// recalculées ici à partir de listes déjà paginées, qui ne représentent
// jamais l'ensemble des données (mission §6.D : "réutiliser la logique
// métier existante", jamais une seconde formule côté client).
interface Props {
  kpis: BillingKpis | null;
  loading: boolean;
  onAFacturerClick?: () => void;
}

export function BillingKpiStrip({ kpis, loading, onAFacturerClick }: Props) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiCard
        label="Factures aujourd'hui"
        value={String(kpis.facturesAujourdhui)}
        hint="COUNT(Invoice créée aujourd'hui)"
        icon={FileText}
        tone="primary"
      />
      <KpiCard
        label="CA facturé"
        value={<MoneyDisplay value={kpis.caFacture} />}
        hint="SUM(montantTotal), factures annulées par avoir exclues"
        icon={Receipt}
        tone="success"
      />
      <KpiCard
        label="À facturer"
        value={String(kpis.aFacturer)}
        hint="Séjours CHECKOUT sans facture active"
        icon={Wallet}
        tone={kpis.aFacturer > 0 ? 'warning' : 'neutral'}
        onClick={onAFacturerClick}
      />
      <KpiCard
        label="À encaisser"
        value={<MoneyDisplay value={kpis.aEncaisser} />}
        hint="Folios EN_COURS + CHECKOUT récents (30 j), solde positif"
        icon={Wallet}
        tone={Number(kpis.aEncaisser) > 0 ? 'warning' : 'neutral'}
      />
    </div>
  );
}
