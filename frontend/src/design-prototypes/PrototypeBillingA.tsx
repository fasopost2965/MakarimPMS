import { useMemo, useState } from 'react';
import {
  Download,
  FileText,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Wallet,
} from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { NAV_ITEMS } from '@/components/layout/nav-items';
import type { Tab } from '@/App';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { MoneyDisplay } from '@/components/ui/money-display';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toastManager } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type {
  Folio,
  FolioLine,
  Invoice,
  Payment,
  Stay,
  StatutFacture,
} from './mock-data-billing';
import {
  MOCK_INVOICE_ROWS,
  MOCK_PAYMENT_ROWS,
  MOCK_STAYS,
} from './mock-data-billing';

// DESIGN-010 — Billing Center, prototype de convergence (Phase 2 après
// audit Phase 1). Le module `/billing` n'existe pas encore en production —
// "Facturation" est aujourd'hui un onglet embarqué dans le détail d'un
// séjour (BillingTabContent.tsx), sans registre global. Ce prototype
// explore ce futur registre transversal (route de production envisagée :
// `/billing`, RBAC cible `billing:read`/`billing:write` — ni l'un ni
// l'autre n'existe côté serveur aujourd'hui, `checkin:read`/`checkin:write`
// restent les permissions réelles de BillingTabContent). Isolation totale
// (même convention que PrototypeFrontDeskA/PrototypeHousekeepingA) :
// aucun import depuis features/billing/** ni features/checkin/**, aucune
// mutation réelle (apiRequest/fetch jamais appelés ici), tous les boutons
// d'action sont visuels/no-op (toastManager de confirmation simulée).
//
// Contrats d'API cibles pour une future Phase 3 backend (documentés en
// détail, avec filtres/réponse paginée exacts, dans mock-data-billing.ts —
// GET /invoices, GET /payments, GET /stays/facturables) : AUCUN de ces
// endpoints n'existe, ce prototype ne les appelle jamais.

// ---------------------------------------------------------------------
// RBAC simulé — deux constantes commentées plutôt qu'un toggle caché :
// visible dans l'UI via un petit contrôle "Simuler RBAC". Le masquage est
// TOTAL (bouton absent), jamais un simple griséage — même convention que
// le reste de l'app (CLAUDE.md, ADR-006).
// ---------------------------------------------------------------------
type RbacProfile = 'read-write' | 'read-only';

// Chassis réel : la sidebar filtre déjà par permission (AppSidebar.tsx) —
// pour montrer « tous les autres modules visibles » sans la modifier, on
// lui donne l'ensemble des permissions déclarées dans NAV_ITEMS (même
// convention que PrototypeFrontDeskA/PrototypeHousekeepingA).
const ALL_NAV_PERMISSIONS = [...new Set(NAV_ITEMS.map((i) => i.permission))];

type TabKey = 'factures' | 'a-facturer' | 'paiements';

const STATUT_FACTURE_LABEL: Record<StatutFacture, string> = {
  EMISE: 'Émise',
  ANNULEE_PAR_AVOIR: 'Annulée par avoir',
};

const STATUT_FACTURE_BADGE: Record<StatutFacture, 'success' | 'destructive'> = {
  EMISE: 'success',
  ANNULEE_PAR_AVOIR: 'destructive',
};

const TYPE_LIGNE_LABEL: Record<FolioLine['type'], string> = {
  HEBERGEMENT: 'Hébergement',
  EXTRA: 'Extra',
  RESTAURANT: 'Restaurant',
  TAXE_SEJOUR: 'Taxe de séjour',
  PAIEMENT: 'Paiement',
  AJUSTEMENT_HAUSSE: 'Ajustement (hausse)',
  AJUSTEMENT_BAISSE: 'Ajustement (baisse)',
};

const MOYEN_LABEL: Record<Payment['moyen'], string> = {
  ESPECES: 'Espèces',
  CARTE: 'Carte',
  VIREMENT: 'Virement',
  ACOMPTE: 'Acompte',
};

const ALL = 'ALL';

// Réplique exacte de calculateInvoiceTotal (backend/src/modules/billing/
// utils/invoice-calc.ts) : HEBERGEMENT/EXTRA/RESTAURANT/TAXE_SEJOUR/
// AJUSTEMENT_HAUSSE additifs, PAIEMENT toujours exclu, AJUSTEMENT_BAISSE
// soustractif (crédit sur la charge, pas un règlement) — jamais une
// seconde formule inventée pour ce prototype.
function calculateInvoiceTotal(lignes: FolioLine[]): number {
  let total = 0;
  for (const l of lignes) {
    if (l.annulee || l.type === 'PAIEMENT') continue;
    total +=
      l.type === 'AJUSTEMENT_BAISSE' ? -Number(l.montant) : Number(l.montant);
  }
  return total;
}

// Réplique exacte de computeSoldeDu (backend/src/modules/stay/utils/
// solde.ts) appliquée aux lignes de folio mock — jamais une seconde
// formule ni une valeur dérivée de la table Payment directement (CLAUDE.md :
// « computeSoldeDu est la seule fonction qui calcule un solde de folio »).
function computeSoldeDu(folio: Folio): number {
  let total = 0;
  for (const l of folio.lignes) {
    if (l.annulee) continue;
    const negatif = l.type === 'PAIEMENT' || l.type === 'AJUSTEMENT_BAISSE';
    total += negatif ? -Number(l.montant) : Number(l.montant);
  }
  return total;
}

// Une facture EMISE active sur un folio (statut EMISE, jamais annulée par
// avoir) est la seule condition qui exclut un séjour CHECKOUT de « À
// facturer » (GET /stays/facturables, décision produit gelée) — vérifiée
// via `effectiveStatut` dans le composant (tient compte de la simulation
// locale d'avoir), jamais une seconde fonction figée sur `invoice.statut`.

function matchesSearch(
  query: string,
  fields: {
    numero?: string;
    guest: { nom: string; prenom: string };
    stayId: number;
    roomNumero: string;
  },
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (fields.numero?.toLowerCase().includes(q) ?? false) ||
    fields.guest.nom.toLowerCase().includes(q) ||
    fields.guest.prenom.toLowerCase().includes(q) ||
    `séjour #${fields.stayId}`.includes(q) ||
    String(fields.stayId).includes(q) ||
    fields.roomNumero.toLowerCase().includes(q)
  );
}

export default function PrototypeBillingA() {
  const [rbac, setRbac] = useState<RbacProfile>('read-write');
  const canWrite = rbac === 'read-write';
  const mockPermissions = useMemo(
    () => [
      ...ALL_NAV_PERMISSIONS,
      'billing:read',
      ...(canWrite ? ['billing:write'] : []),
    ],
    [canWrite],
  );

  const [tab, setTab] = useState<TabKey>('factures');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statutFilter, setStatutFilter] = useState<StatutFacture | typeof ALL>(
    ALL,
  );
  const [moyenFilter, setMoyenFilter] = useState<Payment['moyen'] | typeof ALL>(
    ALL,
  );

  const [viewedInvoiceId, setViewedInvoiceId] = useState<number | null>(null);

  // Simulation locale d'un avoir (« Créer un avoir ») : jamais une vraie
  // mutation, seulement une réécriture d'état React côté prototype pour
  // démontrer la règle « facture figée » de façon interactive — aucun
  // avoir partiel, le montant reste toujours celui de la facture
  // d'origine (décisions produit gelées §6).
  const [avoiredInvoiceIds, setAvoiredInvoiceIds] = useState<Set<number>>(
    new Set(),
  );
  // Simulation locale de « Générer facture » — retire simplement la ligne
  // de l'onglet « À facturer » (aucune facture réellement créée, aucun
  // numéro inventé) : le flux réel resterait un POST /billing/invoices non
  // implémenté ici.
  const [generatedStayIds, setGeneratedStayIds] = useState<Set<number>>(
    new Set(),
  );

  function effectiveStatut(invoice: Invoice): StatutFacture {
    return avoiredInvoiceIds.has(invoice.id)
      ? 'ANNULEE_PAR_AVOIR'
      : invoice.statut;
  }

  // ---------------------------------------------------------------------
  // KPI — formules documentées explicitement (mission).
  // ---------------------------------------------------------------------
  const kpis = useMemo(() => {
    const todayISO = new Date().toDateString();
    // Factures aujourd'hui = COUNT(mockInvoices WHERE DATE(createdAt) === aujourd'hui)
    const facturesAujourdhui = MOCK_INVOICE_ROWS.filter(
      (r) => new Date(r.invoice.createdAt).toDateString() === todayISO,
    ).length;
    // CA facturé = SUM(mockInvoices[].montantTotal) — choix explicite :
    // EXCLUT les factures ANNULEE_PAR_AVOIR (état effectif, avoir compris)
    // du CA net, ce n'est pas figé par le propriétaire produit (mission).
    const caFacture = MOCK_INVOICE_ROWS.filter(
      (r) => effectiveStatut(r.invoice) === 'EMISE',
    ).reduce((acc, r) => acc + Number(r.invoice.montantTotal), 0);
    // À facturer = COUNT(mockStays WHERE statut === 'CHECKOUT' AND aucune
    // Invoice EMISE active sur son folio), jamais les séjours déjà générés
    // dans cette session (simulation locale).
    const aFacturer = MOCK_STAYS.filter(
      (s) =>
        s.statut === 'CHECKOUT' &&
        !generatedStayIds.has(s.id) &&
        s.folios.every(
          (f) => !f.invoices.some((i) => effectiveStatut(i) === 'EMISE'),
        ),
    ).length;
    // À encaisser = SUM(solde dû par folio, sur les folios à solde
    // positif) — réplique de computeSoldeDu, jamais une seconde formule.
    const aEncaisser = MOCK_STAYS.flatMap((s) => s.folios)
      .map((f) => computeSoldeDu(f))
      .filter((solde) => solde > 0)
      .reduce((acc, solde) => acc + solde, 0);
    return { facturesAujourdhui, caFacture, aFacturer, aEncaisser };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avoiredInvoiceIds, generatedStayIds]);

  // ---------------------------------------------------------------------
  // Onglet Factures
  // ---------------------------------------------------------------------
  const filteredInvoiceRows = useMemo(() => {
    return MOCK_INVOICE_ROWS.filter((r) => {
      const statut = effectiveStatut(r.invoice);
      if (statutFilter !== ALL && statut !== statutFilter) return false;
      if (dateFrom && r.invoice.createdAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && r.invoice.createdAt.slice(0, 10) > dateTo) return false;
      return matchesSearch(search, {
        numero: r.invoice.numero,
        guest: r.stay.guest,
        stayId: r.stay.id,
        roomNumero: r.stay.room.numero,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, dateFrom, dateTo, statutFilter, avoiredInvoiceIds]);

  // ---------------------------------------------------------------------
  // Onglet À facturer — jamais de séjour EN_COURS, uniquement CHECKOUT
  // sans Invoice EMISE active (décision produit explicite, mission).
  // ---------------------------------------------------------------------
  const facturableRows = useMemo(() => {
    return MOCK_STAYS.filter(
      (s) =>
        s.statut === 'CHECKOUT' &&
        !generatedStayIds.has(s.id) &&
        s.folios.every(
          (f) => !f.invoices.some((i) => effectiveStatut(i) === 'EMISE'),
        ),
    ).filter((s) =>
      matchesSearch(search, {
        guest: s.guest,
        stayId: s.id,
        roomNumero: s.room.numero,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, generatedStayIds, avoiredInvoiceIds]);

  // ---------------------------------------------------------------------
  // Onglet Paiements — jamais "encaissé par" (Payment n'a pas de userId
  // fiable dans le modèle réel, mission).
  // ---------------------------------------------------------------------
  const filteredPaymentRows = useMemo(() => {
    return MOCK_PAYMENT_ROWS.filter((r) => {
      if (moyenFilter !== ALL && r.payment.moyen !== moyenFilter) return false;
      if (dateFrom && r.payment.createdAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && r.payment.createdAt.slice(0, 10) > dateTo) return false;
      return matchesSearch(search, {
        numero: r.invoiceNumero ?? undefined,
        guest: r.stay.guest,
        stayId: r.stay.id,
        roomNumero: r.stay.room.numero,
      });
    });
  }, [search, dateFrom, dateTo, moyenFilter]);

  const viewedRow = MOCK_INVOICE_ROWS.find(
    (r) => r.invoice.id === viewedInvoiceId,
  );

  function handleNoOp(message: string) {
    toastManager.add({ title: message });
  }

  function handleGenerateInvoice(stay: Stay) {
    setGeneratedStayIds((prev) => new Set(prev).add(stay.id));
    toastManager.add({
      title: 'Facture générée (simulation)',
      description: `Séjour #${stay.id} — ${stay.guest.nom} ${stay.guest.prenom}. Aucune écriture réelle, POST /billing/invoices non implémenté (Phase 3).`,
    });
  }

  function handleCreateCreditNote(invoice: Invoice) {
    setAvoiredInvoiceIds((prev) => new Set(prev).add(invoice.id));
    toastManager.add({
      title: 'Avoir créé (simulation)',
      description: `Facture ${invoice.numero} annulée par avoir (montant total, jamais partiel). Aucune écriture réelle.`,
    });
  }

  return (
    <div className="bg-background flex h-screen">
      <AppSidebar
        // Aucun onglet "billing" n'existe encore dans Tab (App.tsx) — ce
        // module n'est pas encore branché en production. "checkin" reste
        // l'onglet actif le plus proche pour l'aperçu de la sidebar
        // (même convention que PrototypeFrontDeskA).
        activeTab={'checkin' as Tab}
        onNavigate={() => {}}
        collapsed={false}
        onToggleCollapsed={() => {}}
        mobileOpen={false}
        onMobileClose={() => {}}
        permissions={mockPermissions}
        logoUrl={null}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-4 p-4 sm:p-6">
          {/* HEADER COMPACT */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <p className="text-muted-foreground text-[11px] font-bold tracking-[0.03em] uppercase">
                Exploitation hôtel
              </p>
              <h1 className="truncate text-xl font-extrabold tracking-[-0.01em]">
                Facturation
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {/* RBAC simulé — visible et togglable, jamais un simple
                  commentaire caché dans le code (mission §6). */}
              <Select
                value={rbac}
                onValueChange={(v) => v && setRbac(v as RbacProfile)}
                items={[
                  {
                    value: 'read-write',
                    label: 'billing:read + billing:write',
                  },
                  { value: 'read-only', label: 'billing:read seul' },
                ]}
              >
                <SelectTrigger className="w-[240px]">
                  <span className="text-muted-foreground mr-1 text-xs">
                    Simuler RBAC :
                  </span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read-write">
                    billing:read + billing:write
                  </SelectItem>
                  <SelectItem value="read-only">billing:read seul</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2">
                <RefreshCw className="size-4" />
                Actualiser
              </Button>
            </div>
          </div>

          {/* BANDE KPI */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              label="Factures aujourd'hui"
              value={String(kpis.facturesAujourdhui)}
              hint="COUNT(mockInvoices WHERE DATE(createdAt) = aujourd'hui)"
              icon={FileText}
              tone="primary"
            />
            <KpiCard
              label="CA facturé"
              value={<MoneyDisplay value={kpis.caFacture.toFixed(2)} />}
              hint="SUM(montantTotal), factures ANNULEE_PAR_AVOIR exclues"
              icon={Receipt}
              tone="success"
            />
            <KpiCard
              label="À facturer"
              value={String(kpis.aFacturer)}
              hint="Séjours CHECKOUT sans facture EMISE active"
              icon={Wallet}
              tone={kpis.aFacturer > 0 ? 'warning' : 'neutral'}
            />
            <KpiCard
              label="À encaisser"
              value={<MoneyDisplay value={kpis.aEncaisser.toFixed(2)} />}
              hint="Réplique de computeSoldeDu, folios à solde positif"
              icon={Wallet}
              tone={kpis.aEncaisser > 0 ? 'warning' : 'neutral'}
            />
          </div>

          {/* NAVIGATION + BARRE OUTILS */}
          <Card>
            <CardContent className="flex flex-col gap-3 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div
                  role="tablist"
                  aria-label="Vue"
                  className="bg-surface-2 flex shrink-0 gap-1 rounded-md p-1"
                >
                  {(
                    [
                      { key: 'factures', label: 'Factures' },
                      { key: 'a-facturer', label: 'À facturer' },
                      { key: 'paiements', label: 'Paiements' },
                    ] as { key: TabKey; label: string }[]
                  ).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.key}
                      onClick={() => setTab(t.key)}
                      className={cn(
                        'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                        tab === t.key
                          ? 'bg-card shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-0 flex-1">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher : n° facture, client, séjour, chambre…"
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Filtres contextuels selon l'onglet actif */}
              <div className="flex flex-wrap items-center gap-2">
                {(tab === 'factures' || tab === 'paiements') && (
                  <>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-[150px]"
                      aria-label="Du"
                    />
                    <span className="text-muted-foreground text-xs">au</span>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-[150px]"
                      aria-label="Au"
                    />
                  </>
                )}
                {tab === 'factures' && (
                  <Select
                    value={statutFilter}
                    onValueChange={(v) =>
                      v && setStatutFilter(v as StatutFacture | typeof ALL)
                    }
                    items={[
                      { value: ALL, label: 'Tous statuts' },
                      { value: 'EMISE', label: 'Émise' },
                      {
                        value: 'ANNULEE_PAR_AVOIR',
                        label: 'Annulée par avoir',
                      },
                    ]}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tous statuts</SelectItem>
                      <SelectItem value="EMISE">Émise</SelectItem>
                      <SelectItem value="ANNULEE_PAR_AVOIR">
                        Annulée par avoir
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {tab === 'paiements' && (
                  <Select
                    value={moyenFilter}
                    onValueChange={(v) =>
                      v && setMoyenFilter(v as Payment['moyen'] | typeof ALL)
                    }
                    items={[
                      { value: ALL, label: 'Tous moyens' },
                      { value: 'ESPECES', label: 'Espèces' },
                      { value: 'CARTE', label: 'Carte' },
                      { value: 'VIREMENT', label: 'Virement' },
                      { value: 'ACOMPTE', label: 'Acompte' },
                    ]}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tous moyens</SelectItem>
                      <SelectItem value="ESPECES">Espèces</SelectItem>
                      <SelectItem value="CARTE">Carte</SelectItem>
                      <SelectItem value="VIREMENT">Virement</SelectItem>
                      <SelectItem value="ACOMPTE">Acompte</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ZONE PRINCIPALE — registre dense */}
          {tab === 'factures' && (
            <div className="bg-card overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs font-semibold uppercase">
                    <th className="px-3 py-2">N° facture</th>
                    <th className="px-3 py-2">Date émission</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Séjour</th>
                    <th className="px-3 py-2">Chambre</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoiceRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Aucune facture ne correspond aux filtres.
                      </td>
                    </tr>
                  )}
                  {filteredInvoiceRows.map(({ invoice, stay }) => {
                    const statut = effectiveStatut(invoice);
                    return (
                      <tr key={invoice.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono font-semibold">
                          {invoice.numero}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {new Date(invoice.createdAt).toLocaleDateString(
                            'fr-FR',
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {stay.guest.nom} {stay.guest.prenom}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          Séjour #{stay.id}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">
                            Ch. {stay.room.numero}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <MoneyDisplay value={invoice.montantTotal} />
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={STATUT_FACTURE_BADGE[statut]}>
                            {STATUT_FACTURE_LABEL[statut]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewedInvoiceId(invoice.id)}
                            >
                              Voir
                            </Button>
                            {/* Télécharger PDF = vrai PDF généré serveur
                                (GET /billing/invoices/:id/pdf, réel en
                                production) — distinct d'Imprimer ci-dessous. */}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Télécharger PDF"
                              onClick={() =>
                                handleNoOp(
                                  `PDF de ${invoice.numero} (simulation)`,
                                )
                              }
                            >
                              <Download className="size-4" />
                            </Button>
                            {/* Imprimer = impression navigateur via
                                InvoicePrintModal (rendu HTML + window.print()),
                                mécanisme différent du PDF serveur ci-dessus. */}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Imprimer"
                              onClick={() =>
                                handleNoOp(
                                  `Aperçu d'impression de ${invoice.numero} (simulation)`,
                                )
                              }
                            >
                              <Printer className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Envoyer"
                              onClick={() =>
                                handleNoOp(
                                  `Envoi de ${invoice.numero} demandé (simulation)`,
                                )
                              }
                            >
                              <Send className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'a-facturer' && (
            <div className="bg-card overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs font-semibold uppercase">
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Séjour</th>
                    <th className="px-3 py-2">Chambre</th>
                    <th className="px-3 py-2">Arrivée</th>
                    <th className="px-3 py-2">Départ</th>
                    <th className="px-3 py-2">Folio</th>
                    <th className="px-3 py-2 text-right">Total facturable</th>
                    <th className="px-3 py-2">Statut</th>
                    {canWrite && (
                      <th className="px-3 py-2 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {facturableRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={canWrite ? 9 : 8}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Aucun séjour à facturer ne correspond aux filtres.
                      </td>
                    </tr>
                  )}
                  {facturableRows.map((stay) => {
                    const folio = stay.folios[0];
                    const total = calculateInvoiceTotal(folio.lignes);
                    return (
                      <tr key={stay.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          {stay.guest.nom} {stay.guest.prenom}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          Séjour #{stay.id}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">
                            Ch. {stay.room.numero}
                          </Badge>
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {new Date(stay.dateCheckin).toLocaleDateString(
                            'fr-FR',
                          )}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {new Date(
                            stay.dateCheckoutReelle ?? stay.dateCheckoutPrevue,
                          ).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {folio.lignes.length} ligne
                          {folio.lignes.length > 1 ? 's' : ''}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <MoneyDisplay value={total.toFixed(2)} />
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="warning">Non facturé</Badge>
                        </td>
                        {canWrite && (
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              onClick={() => handleGenerateInvoice(stay)}
                            >
                              Générer facture
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'paiements' && (
            <div className="bg-card overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs font-semibold uppercase">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Séjour</th>
                    <th className="px-3 py-2">Chambre</th>
                    <th className="px-3 py-2">Moyen</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                    <th className="px-3 py-2">Facture liée</th>
                    <th className="px-3 py-2">Référence</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPaymentRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Aucun paiement ne correspond aux filtres.
                      </td>
                    </tr>
                  )}
                  {filteredPaymentRows.map(
                    ({ payment, stay, invoiceNumero }) => (
                      <tr key={payment.id} className="border-b last:border-0">
                        <td className="text-muted-foreground px-3 py-2">
                          {new Date(payment.createdAt).toLocaleDateString(
                            'fr-FR',
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {stay.guest.nom} {stay.guest.prenom}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          Séjour #{stay.id}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">
                            Ch. {stay.room.numero}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {MOYEN_LABEL[payment.moyen]}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <MoneyDisplay value={payment.montant} />
                        </td>
                        <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                          {invoiceNumero ?? '—'}
                        </td>
                        <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                          PAY-{String(payment.id).padStart(6, '0')}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* PANNEAU FACTURE */}
      <Dialog
        open={viewedInvoiceId !== null}
        onOpenChange={(next) => !next && setViewedInvoiceId(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {viewedRow && (
            <InvoiceDetailPanel
              invoice={viewedRow.invoice}
              stay={viewedRow.stay}
              folio={viewedRow.folio}
              statut={effectiveStatut(viewedRow.invoice)}
              canWrite={canWrite}
              onCreateCreditNote={() =>
                handleCreateCreditNote(viewedRow.invoice)
              }
              onNoOp={handleNoOp}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------
// Panneau détail facture. Historique n'affiche QUE ce qui existe
// réellement (createdAt de la facture, date de l'avoir le cas échéant) —
// jamais un historique d'impression/téléchargement/envoi inventé
// (AuditLog ne couvre pas ces actions aujourd'hui, audit Phase 1).
// ---------------------------------------------------------------------
function InvoiceDetailPanel({
  invoice,
  stay,
  folio,
  statut,
  canWrite,
  onCreateCreditNote,
  onNoOp,
}: {
  invoice: Invoice;
  stay: Stay;
  folio: Folio;
  statut: StatutFacture;
  canWrite: boolean;
  onCreateCreditNote: () => void;
  onNoOp: (message: string) => void;
}) {
  const lignesFacturees = folio.lignes.filter(
    (l) => l.type !== 'PAIEMENT' && !l.annulee,
  );
  const paiementsLies = folio.lignes.filter(
    (l) => l.type === 'PAIEMENT' && !l.annulee,
  );
  const totalRegle = paiementsLies.reduce((a, l) => a + Number(l.montant), 0);
  const totalTTC = Number(invoice.montantTotal);
  // "Reste éventuel" — uniquement affiché quand réellement dérivable
  // proprement : une facture ANNULEE_PAR_AVOIR n'a plus de "reste à payer"
  // significatif (elle est soldée par l'avoir), jamais un chiffre inventé
  // pour ce cas (mission).
  const resteAPayer =
    statut === 'EMISE' ? Math.max(0, totalTTC - totalRegle) : null;
  const avoir = invoice.creditNotes[0];

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <DialogTitle>Facture {invoice.numero}</DialogTitle>
          <Badge variant={statut === 'EMISE' ? 'success' : 'destructive'}>
            {STATUT_FACTURE_LABEL[statut]}
          </Badge>
        </div>
      </DialogHeader>

      {/* Règle facture figée — encadré explicite (composant Alert
          existant), jamais un simple avertissement discret (mission,
          décision produit gelée #3). */}
      {statut === 'EMISE' && (
        <Alert
          tone="warning"
          title="Cette facture est figée."
          description="Toute correction nécessite un avoir, puis une nouvelle facture. Aucune modification directe de cette facture n'est possible."
        />
      )}

      <div className="bg-muted/30 grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs font-semibold uppercase">
            Client
          </p>
          <p>
            {stay.guest.nom} {stay.guest.prenom}
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs font-semibold uppercase">
            Séjour
          </p>
          <p>
            Séjour #{stay.id} — Chambre {stay.room.numero} (
            {stay.room.roomType.nom})
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-semibold uppercase">
            Période
          </p>
          <p>
            {new Date(stay.dateCheckin).toLocaleDateString('fr-FR')} —{' '}
            {new Date(
              stay.dateCheckoutReelle ?? stay.dateCheckoutPrevue,
            ).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs font-semibold uppercase">
            Date d'émission
          </p>
          <p>{new Date(invoice.createdAt).toLocaleDateString('fr-FR')}</p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 font-semibold">Ligne</th>
            <th className="py-2 text-right font-semibold">Montant (MAD)</th>
          </tr>
        </thead>
        <tbody>
          {lignesFacturees.map((ligne) => {
            // Signe explicite "-" pour toute ligne AJUSTEMENT_BAISSE,
            // jamais affichée comme une charge positive — même règle que
            // le PDF réel (invoice.pdf.ts, DESIGN-009B.1).
            const signe = ligne.type === 'AJUSTEMENT_BAISSE' ? '-' : '';
            return (
              <tr key={ligne.id} className="border-b">
                <td className="py-2">
                  {ligne.libelle}
                  <span className="text-muted-foreground ml-2 text-xs">
                    ({TYPE_LIGNE_LABEL[ligne.type]})
                  </span>
                </td>
                <td className="py-2 text-right font-mono">
                  {signe}
                  {Number(ligne.montant).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="flex w-64 flex-col gap-1 text-sm">
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Total TTC</span>
            <MoneyDisplay value={invoice.montantTotal} />
          </div>
          {paiementsLies.length > 0 && (
            <div className="text-muted-foreground flex justify-between">
              <span>Paiements liés</span>
              <MoneyDisplay value={totalRegle.toFixed(2)} />
            </div>
          )}
          {resteAPayer !== null && (
            <div
              className={cn(
                'flex justify-between font-semibold',
                resteAPayer > 0 ? 'text-destructive' : 'text-success',
              )}
            >
              <span>Reste à payer</span>
              <MoneyDisplay value={resteAPayer.toFixed(2)} />
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Historique</p>
        <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
          <li>
            Facture créée le{' '}
            {new Date(invoice.createdAt).toLocaleDateString('fr-FR')}
          </li>
          {statut === 'ANNULEE_PAR_AVOIR' && avoir && (
            <li>
              Avoir émis le{' '}
              {new Date(avoir.createdAt).toLocaleDateString('fr-FR')}
              {' — '}
              {avoir.motif}
            </li>
          )}
        </ul>
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap">
        {/* Télécharger PDF (PDF serveur réel) et Imprimer (impression
            navigateur InvoicePrintModal, réel) — deux mécanismes distincts,
            jamais fusionnés. Toujours visibles (RBAC billing:read suffit). */}
        <Button
          variant="outline"
          onClick={() => onNoOp(`PDF de ${invoice.numero} (simulation)`)}
        >
          <Download className="size-4" />
          Télécharger PDF
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            onNoOp(`Aperçu d'impression de ${invoice.numero} (simulation)`)
          }
        >
          <Printer className="size-4" />
          Imprimer
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            onNoOp(`Envoi de ${invoice.numero} demandé (simulation)`)
          }
        >
          <Send className="size-4" />
          Envoyer
        </Button>
        {/* Créer un avoir — visible UNIQUEMENT si billing:write ET
            statut EMISE (jamais sur une facture déjà annulée par avoir) :
            action absente, pas désactivée (RBAC masquage complet). */}
        {canWrite && statut === 'EMISE' && (
          <Button variant="destructive" onClick={onCreateCreditNote}>
            Créer un avoir
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
