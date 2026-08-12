import { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarRange,
  History,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  UserRound,
  Users,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { Label } from '@/components/ui/label';
import { MoneyDisplay } from '@/components/ui/money-display';
import { SectionHeader } from '@/components/ui/section-header';
import {
  mockAllRooms,
  mockArrivals,
  mockDepartures,
  mockForecast,
  mockResume,
  mockRooms,
  mockTickets,
} from './mock-data';

// DESIGN-005 — PROTOTYPE D : "Makarim Operations" (direction finale
// proposée après arbitrage du propriétaire produit : Login ≈ B allégé,
// structure/KPI/couleurs ≈ C, chambres et alertes ≈ B, + zone Modules
// nouvelle). Ce fichier ne réutilise PAS de code des prototypes A/B/C
// (chacun reste indépendant, voir README.md) — il reconstruit une identité
// propre à partir des mêmes composants système que C (KpiCard,
// SectionHeader, Card…) pour rester au plus près d'un chemin d'intégration
// réel. Aucune donnée réelle chargée, aucun appel réseau — voir README.md
// du dossier. Classification REAL/DERIVED/NEEDS BACKEND/DESIGN ONLY posée
// en commentaire à chaque zone plutôt que dans un document séparé, pour
// qu'elle ne puisse pas diverger du composant qu'elle documente.

// ---------------------------------------------------------------------------
// 1. LOGIN — base Prototype B, glassmorphism réduit, espace réservé à une
// photo officielle (mission §1). 4 espaces demandés explicitement
// (Réception/Restaurant/Administration/Housekeeping) — DESIGN ONLY : ce
// choix de présentation ne modifie ni n'ajoute aucune autorisation, il
// reste un raccourci visuel vers le même formulaire email/mot de passe.
// L'ambiance sombre est cantonnée au Login (mission §8 : "le sombre peut
// être utilisé ponctuellement — Login").
const ESPACES: {
  nom: string;
  label: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    nom: 'Réception',
    label: 'Réception',
    icon: Users,
    description: 'Arrivées, départs, réservations',
  },
  {
    nom: 'RESTAURATEUR',
    label: 'Restaurant',
    icon: UtensilsCrossed,
    description: 'Salle et service',
  },
  {
    nom: 'Administrateur',
    label: 'Administration',
    icon: Building2,
    description: 'Paramètres, RH, finance',
  },
  {
    nom: 'Gouvernante',
    label: 'Housekeeping',
    icon: Sparkles,
    description: 'Ménage et contrôle des chambres',
  },
];

function PrototypeDLogin({ onEnter }: { onEnter: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      style={{
        background:
          'radial-gradient(130% 90% at 50% -10%, #1c2c4a 0%, #0b1220 62%)',
      }}
    >
      {/* Emplacement réservé à une photographie officielle de l'hôtel
          (mission §1 : "préparer un emplacement réel pour une future
          photo"). DESIGN ONLY — fond neutre discret en attendant l'asset ;
          remplacer ce style par `backgroundImage` sans toucher au reste de
          la structure. */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 72px)',
        }}
      />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center text-white">
          <span className="border-primary-soft/30 bg-primary flex size-10 items-center justify-center rounded-full border text-sm font-bold">
            M
          </span>
          <p className="mt-3 text-sm font-semibold tracking-[0.06em] uppercase">
            Hôtel Makarim
          </p>
          <p className="text-[11px] text-white/50">PMS · Tétouan</p>
        </div>

        {/* Panneau solide plutôt que glassmorphism appuyé (mission §1 :
            "réduire tout effet glassmorphism excessif") — un fond quasi
            opaque + une seule bordure fine, la lisibilité prime. */}
        <div className="rounded-2xl border border-white/10 bg-[#0f1a2e] p-7 shadow-2xl">
          <h1 className="text-lg font-semibold text-white">
            Choisissez votre espace
          </h1>
          <p className="mt-1 text-[12.5px] text-white/50">
            L'accès réel reste déterminé par votre compte, quel que soit
            l'espace sélectionné ici.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {ESPACES.map((espace) => {
              const Icon = espace.icon;
              const active = selected === espace.nom;
              return (
                <button
                  key={espace.nom}
                  type="button"
                  onClick={() => setSelected(espace.nom)}
                  className={`flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-colors duration-[var(--duration-fast)] ${
                    active
                      ? 'border-primary bg-primary/15'
                      : 'border-white/10 hover:border-white/25 hover:bg-white/[0.04]'
                  }`}
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-lg ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white/10 text-white/70'
                    }`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold text-white">
                      {espace.label}
                    </span>
                    <span className="block text-[10.5px] leading-tight text-white/45">
                      {espace.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className={`grid transition-[grid-template-rows] duration-[var(--duration-base)] ease-[var(--ease-out-brand)] ${
              selected ? 'mt-5 grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="overflow-hidden">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onEnter();
                }}
                className="flex flex-col gap-3.5 border-t border-white/10 pt-5"
              >
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="d-email"
                    className="text-[12px] text-white/70"
                  >
                    Email
                  </Label>
                  <Input
                    id="d-email"
                    type="email"
                    required
                    className="h-10 border-white/15 bg-white/[0.05] text-white placeholder:text-white/30"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="d-pass" className="text-[12px] text-white/70">
                    Mot de passe
                  </Label>
                  <Input
                    id="d-pass"
                    type="password"
                    required
                    className="h-10 border-white/15 bg-white/[0.05] text-white placeholder:text-white/30"
                  />
                </div>
                <Button type="submit" className="mt-1 h-11">
                  Se connecter
                </Button>
              </form>
            </div>
          </div>

          {!selected && (
            <p className="mt-5 text-center text-[11px] text-white/35">
              Sélectionnez un espace pour afficher le formulaire.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. SIDEBAR — reproduit fidèlement les 6 catégories et 16 entrées réelles
// de `components/layout/nav-items.ts` (REAL — copie de la structure de
// navigation actuellement en production, pas une invention), pour que la
// démonstration de densité/lisibilité soit honnête. Purement visuel dans ce
// prototype : `activeTab`/`onNavigate` ne sont pas branchés (mission §7 :
// "ne change pas la logique activeTab existante", hors périmètre d'un
// prototype isolé) — un clic ne fait ici que mettre à jour un état local
// de démonstration.
interface SidebarItem {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}
interface SidebarCategory {
  key: string;
  label: string;
  items: SidebarItem[];
}

function useSidebarCategories(): SidebarCategory[] {
  return [
    {
      key: 'pilotage',
      label: 'Pilotage',
      items: [
        { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
      ],
    },
    {
      key: 'exploitation',
      label: 'Exploitation hôtel',
      items: [
        { key: 'reservations', label: 'Réservations', icon: CalendarRange },
        {
          key: 'checkin',
          label: 'Check-in & séjours',
          icon: KeyRound,
          badge: mockResume.arriveesAujourdhui,
        },
        {
          key: 'housekeeping',
          label: 'Housekeeping',
          icon: Sparkles,
          badge: mockResume.chambresANettoyer,
        },
        {
          key: 'maintenance',
          label: 'Maintenance',
          icon: Wrench,
          badge: mockTickets.length,
        },
        { key: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
      ],
    },
    {
      key: 'relations',
      label: 'Clients & partenaires',
      items: [
        { key: 'guests', label: 'Clients', icon: Users },
        { key: 'companies', label: 'Entreprises', icon: Building2 },
      ],
    },
    {
      key: 'ressources',
      label: 'Ressources & stocks',
      items: [
        { key: 'hr', label: 'RH', icon: UserRound },
        { key: 'stock', label: 'Stock', icon: Package },
        {
          key: 'purchase-orders',
          label: 'Bons de commande',
          icon: ShoppingCart,
        },
      ],
    },
    {
      key: 'stats',
      label: 'Statistiques & rapports',
      items: [{ key: 'reporting', label: 'Reporting', icon: BarChart3 }],
    },
    {
      key: 'admin',
      label: 'Administration',
      items: [
        { key: 'notifications', label: 'Notifications', icon: Bell },
        { key: 'audit', label: 'Audit', icon: History },
        { key: 'parameters', label: 'Paramètres', icon: Settings },
      ],
    },
  ];
}

function PrototypeDSidebar({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (key: string) => void;
}) {
  const categories = useSidebarCategories();
  return (
    <aside className="border-border bg-sidebar hidden h-screen w-[228px] shrink-0 flex-col border-r lg:flex">
      <div className="border-border flex h-14 shrink-0 items-center gap-2.5 border-b px-3.5">
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-bold">
          M
        </span>
        <span className="min-w-0">
          <span className="text-foreground block truncate text-sm font-bold">
            Makarim
          </span>
          <span className="text-muted-foreground block truncate text-[11px]">
            PMS Hôtel · Tétouan
          </span>
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto p-2.5">
        {categories.map((cat) => (
          <div key={cat.key} className="flex flex-col gap-0.5">
            <p className="text-muted-foreground px-2.5 py-1 text-[10.5px] font-bold tracking-[0.05em] uppercase">
              {cat.label}
            </p>
            {cat.items.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelect(item.key)}
                  className={`flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors duration-[var(--duration-fast)] ${
                    isActive
                      ? 'bg-primary-soft text-primary font-semibold'
                      : 'hover:bg-surface-2 text-sidebar-foreground'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {item.label}
                  </span>
                  {!!item.badge && item.badge > 0 && (
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                        isActive
                          ? 'bg-primary/15 text-primary'
                          : 'bg-surface-2 text-muted-foreground'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// 3. MODULES — "Accès rapides" (mission §6, point manquant majeur). Réutilise
// exclusivement des entrées de la navigation réelle (nav-items.ts) : aucune
// nouvelle route, aucun nouveau permission-check. Le badge numérique par
// module est DERIVED des mêmes mocks que le reste du dashboard (jamais une
// nouvelle donnée). Deux rangs : principaux (usage quotidien, cf. mission)
// en tuiles, secondaires en liste compacte — pour éviter le "mur de 15
// cartes" explicitement écarté par la mission.
const PRIMARY_MODULES: {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}[] = [
  { key: 'reservations', label: 'Réservations', icon: CalendarRange },
  {
    key: 'checkin',
    label: 'Séjours / Check-in',
    icon: KeyRound,
    badge: mockResume.arriveesAujourdhui,
  },
  // "Chambres" n'a pas d'onglet dédié dans nav-items.ts aujourd'hui (RD-024
  // ajoute des routes RoomsController, pas encore d'onglet sidebar propre,
  // voir CLAUDE.md) — pointe vers Housekeeping en attendant, seul écran
  // réel qui montre l'état des chambres. Signalé tel quel, pas maquillé.
  {
    key: 'housekeeping',
    label: 'Chambres',
    icon: Sparkles,
    badge: mockResume.chambresANettoyer,
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    icon: Wrench,
    badge: mockTickets.filter((t) => t.priorite === 'URGENTE').length,
  },
  // Idem "Facturation / Encaissements" : pas d'onglet dédié (Folio/Billing
  // vit dans l'écran Check-in & séjours, CLAUDE.md — "un module ne doit
  // jamais lire directement..."). Pointe donc vers 'checkin'.
  { key: 'checkin-billing', label: 'Facturation', icon: BarChart3 },
  { key: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  { key: 'guests', label: 'Clients', icon: Users },
];

const SECONDARY_MODULES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'stock', label: 'Stock', icon: Package },
  { key: 'reporting', label: 'Reporting', icon: BarChart3 },
  { key: 'companies', label: 'Sociétés', icon: Building2 },
  { key: 'hr', label: 'RH', icon: UserRound },
  { key: 'purchase-orders', label: 'Achats', icon: ShoppingCart },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'audit', label: 'Audit', icon: History },
  { key: 'parameters', label: 'Paramètres', icon: Settings },
];

function ModulesQuickAccess({
  onNavigate,
}: {
  onNavigate: (key: string) => void;
}) {
  return (
    <section aria-labelledby="d-modules">
      <SectionHeader
        id="d-modules"
        title="Accès rapides"
        description="Modules les plus utilisés au quotidien — la navigation complète reste dans le menu latéral."
      />
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {PRIMARY_MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.key}
              type="button"
              onClick={() => onNavigate(mod.key)}
              className="border-border bg-card hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] relative flex flex-col items-center gap-2 rounded-lg border p-3.5 transition-[box-shadow,border-color,transform] duration-[var(--duration-fast)] hover:-translate-y-px"
            >
              {!!mod.badge && mod.badge > 0 && (
                <span className="bg-warning text-warning-foreground absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full text-[9px] font-bold">
                  {mod.badge}
                </span>
              )}
              <span className="bg-primary-soft text-primary flex size-9 items-center justify-center rounded-lg">
                <Icon className="size-4.5" />
              </span>
              <span className="text-center text-[11.5px] leading-tight font-semibold">
                {mod.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {SECONDARY_MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.key}
              type="button"
              onClick={() => onNavigate(mod.key)}
              className="border-border bg-card hover:bg-surface-2 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)]"
            >
              <Icon className="size-3.5" />
              {mod.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. ÉTAT DES CHAMBRES — densité/lisibilité de B, palette sémantique de C
// (vert=prêt, bleu=opération, ambre=attention, rouge=blocage, gris=
// secondaire — mission §4/§8). REAL : forme calquée sur GET /rooms.
const ROOM_DOT: Record<string, string> = {
  LIBRE_PROPRE: 'bg-success',
  OCCUPEE: 'bg-primary',
  A_NETTOYER: 'bg-warning',
  EN_NETTOYAGE: 'bg-violet',
  EN_MAINTENANCE: 'bg-destructive',
};
const ROOM_LABEL: Record<string, string> = {
  LIBRE_PROPRE: 'Libre / propre',
  OCCUPEE: 'Occupée',
  A_NETTOYER: 'À nettoyer',
  EN_NETTOYAGE: 'En nettoyage',
  EN_MAINTENANCE: 'Maintenance',
};

function RoomsStateGrid() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>État des chambres</CardTitle>
        <span className="text-muted-foreground text-[11px]">
          {mockResume.totalChambres} chambres
        </span>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12">
          {mockAllRooms.map((room) => {
            const { statut, numero } = room;
            return (
              <div
                key={room.id}
                title={`Ch. ${numero} — ${ROOM_LABEL[statut]}`}
                className="bg-surface-2 hover:ring-ring/40 group flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md transition-[box-shadow] hover:ring-2"
              >
                <span className={`size-2 rounded-full ${ROOM_DOT[statut]}`} />
                <span className="text-muted-foreground group-hover:text-foreground text-[9px] tabular-nums">
                  {numero}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-3 text-[11px]">
          {Object.entries(ROOM_LABEL).map(([statut, label]) => (
            <span
              key={statut}
              className="text-muted-foreground flex items-center gap-1.5"
            >
              <span className={`size-2 rounded-full ${ROOM_DOT[statut]}`} />{' '}
              {label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 5. À TRAITER — regroupement par urgence réelle (ménage + maintenance),
// bandeau d'alerte fort si un incident URGENTE existe (esprit B), structure
// de zone reprise de C. DERIVED : combine deux listes REAL, tri côté
// client, aucune règle métier nouvelle (mission §5 : "ne pas inventer de
// nouvelles règles métier").
function ATraiterSection() {
  const urgentTickets = mockTickets.filter((t) => t.priorite === 'URGENTE');
  const otherTickets = mockTickets.filter((t) => t.priorite !== 'URGENTE');
  const roomsToClean = mockRooms.filter(
    (r) => r.statut === 'A_NETTOYER' || r.statut === 'EN_NETTOYAGE',
  );
  const roomsBlocked = mockRooms.filter((r) => r.statut === 'EN_MAINTENANCE');

  return (
    <section aria-labelledby="d-attention">
      <SectionHeader
        id="d-attention"
        title="À traiter"
        description="Ménage, maintenance et départs nécessitant une action, triés par urgence."
      />
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="text-warning size-3.5" /> Ménage
            </p>
            <Badge variant={roomsToClean.length > 0 ? 'warning' : 'outline'}>
              {roomsToClean.length}
            </Badge>
          </div>
          {roomsToClean.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Toutes les chambres sont traitées.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {roomsToClean.map((r) => (
                <Badge key={r.id} variant="warning">
                  {r.numero}
                </Badge>
              ))}
            </div>
          )}
          {roomsBlocked.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold">
                Bloquées (maintenance)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {roomsBlocked.map((r) => (
                  <Badge key={r.id} variant="destructive">
                    {r.numero}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Wrench className="size-3.5" /> Interventions ouvertes
            </p>
            <Badge
              variant={urgentTickets.length > 0 ? 'destructive' : 'outline'}
            >
              {mockTickets.length}
            </Badge>
          </div>
          <div className="flex flex-col gap-1.5">
            {[...urgentTickets, ...otherTickets].map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate">
                  Ch. {t.roomNumero} — {t.typePanne}
                </span>
                <Badge
                  variant={
                    t.priorite === 'URGENTE'
                      ? 'destructive'
                      : t.priorite === 'HAUTE'
                        ? 'warning'
                        : 'outline'
                  }
                >
                  {t.priorite}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 6. DASHBOARD — assemble les zones ci-dessus. "Vie" limitée à des
// micro-interactions utiles (mission §9) : pastille live discrète,
// compteur qui s'anime une fois au montage, hover chambres/modules déjà
// posés plus haut. Pas d'animation permanente.
function useCountUp(target: number, durationMs = 600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}

function LiveDot() {
  return (
    <span className="relative flex size-1.5">
      <span className="bg-success absolute inline-flex size-full animate-ping rounded-full opacity-60" />
      <span className="bg-success relative inline-flex size-1.5 rounded-full" />
    </span>
  );
}

function PrototypeDDashboard({
  onNavigate,
}: {
  onNavigate: (key: string) => void;
}) {
  const occupation = useCountUp(Math.round(mockResume.tauxOccupation));
  const urgentTickets = mockTickets.filter((t) => t.priorite === 'URGENTE');
  // DERIVED de la même liste que la grille "État des chambres" juste plus
  // bas (mockAllRooms) — jamais un second calcul indépendant qui pourrait
  // afficher un chiffre différent pour la même réalité.
  const roomsPropresLibres = mockAllRooms.filter(
    (r) => r.statut === 'LIBRE_PROPRE',
  ).length;

  return (
    <div className="flex min-h-screen flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-bold tracking-[0.03em] uppercase">
            <LiveDot /> Vue opérationnelle
          </p>
          <h1 className="text-xl font-extrabold tracking-[-0.01em]">
            Makarim Operations
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            mercredi 12 août 2026
          </p>
        </div>
        {urgentTickets.length > 0 && (
          <div className="border-destructive/30 bg-destructive-soft animate-in fade-in slide-in-from-top-1 flex items-center gap-2 rounded-lg border px-3.5 py-2 duration-300">
            <AlertTriangle className="text-destructive size-4 shrink-0" />
            <p className="text-destructive text-xs font-semibold">
              {urgentTickets.length} incident urgent nécessite votre attention
            </p>
          </div>
        )}
      </div>

      {/* MAINTENANT — hiérarchie forte : occupation en carte "hero", le
          reste en grille secondaire (mission §3 : "pas une grille monotone
          de cartes identiques"). REAL, GET /dashboard/resume. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_2fr]">
        <Card className="from-primary/8 to-primary/0 flex flex-col justify-between gap-3 bg-gradient-to-br p-5">
          <div className="flex items-center justify-between">
            <p className="text-primary text-xs font-bold tracking-[0.03em] uppercase">
              Taux d'occupation
            </p>
            <span className="bg-primary-soft text-primary flex size-8 items-center justify-center rounded-full">
              <LayoutDashboard className="size-4" />
            </span>
          </div>
          <p className="font-mono text-[40px] leading-none font-extrabold tabular-nums">
            {occupation}%
          </p>
          <div className="bg-surface-2 h-[6px] overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-500"
              style={{ width: `${mockResume.tauxOccupation}%` }}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {mockResume.chambresOccupees} sur {mockResume.totalChambres}{' '}
            chambres occupées
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Chambres propres libres"
            value={String(Math.max(0, roomsPropresLibres))}
            hint="Prêtes à vendre"
            icon={Sparkles}
            tone="success"
          />
          <KpiCard
            label="Chambres à nettoyer"
            value={String(mockResume.chambresANettoyer)}
            hint="En attente"
            icon={Sparkles}
            tone={mockResume.chambresANettoyer > 0 ? 'warning' : 'neutral'}
          />
          <KpiCard
            label="Arrivées"
            value={String(mockResume.arriveesAujourdhui)}
            hint="Check-in prévus"
            icon={LogIn}
            tone="success"
          />
          <KpiCard
            label="Départs"
            value={String(mockResume.departsAujourdhui)}
            hint="Check-out prévus"
            icon={LogOut}
            tone="warning"
          />
          <KpiCard
            label="Encaissé aujourd'hui"
            value={
              <MoneyDisplay
                value={mockResume.encaisseAujourdhui}
                className="text-[18px] whitespace-nowrap"
              />
            }
            hint="Paiements du jour"
            icon={BarChart3}
          />
          <KpiCard
            label="Maintenance bloquante"
            value={String(
              mockAllRooms.filter((r) => r.statut === 'EN_MAINTENANCE').length,
            )}
            hint={`dont ${urgentTickets.length} urgente(s)`}
            icon={Wrench}
            tone={urgentTickets.length > 0 ? 'danger' : 'neutral'}
          />
        </div>
      </div>

      {/* MODULES — nouvelle zone (mission §6). */}
      <ModulesQuickAccess onNavigate={onNavigate} />

      {/* CHAMBRES — densité/palette B+C (mission §4). */}
      <RoomsStateGrid />

      {/* À TRAITER — esprit B (mission §5). */}
      <ATraiterSection />

      {/* AUJOURD'HUI — arrivées/départs nommés, marqués "aperçu" : l'API
          existe ailleurs (reservations/arrivals-today) mais n'est pas
          branchée sur le Dashboard aujourd'hui — NEEDS BACKEND
          (branchement), pas une nouvelle API. */}
      <section aria-labelledby="d-jour">
        <SectionHeader
          id="d-jour"
          title="Aujourd'hui"
          description="Arrivées et départs attendus."
          action={
            <Badge variant="outline" className="text-[10px]">
              aperçu — non branché
            </Badge>
          }
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-success flex items-center gap-1.5">
                <LogIn className="size-3.5" /> Arrivées
              </CardTitle>
            </CardHeader>
            <CardContent className="gap-1.5 pt-2">
              {mockArrivals.map((a) => (
                <div
                  key={a.nom}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="truncate">{a.nom}</span>
                  <span className="text-muted-foreground shrink-0">
                    Ch. {a.chambre} · {a.heure}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-warning flex items-center gap-1.5">
                <LogOut className="size-3.5" /> Départs
              </CardTitle>
            </CardHeader>
            <CardContent className="gap-1.5 pt-2">
              {mockDepartures.map((d) => (
                <div
                  key={d.nom}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="truncate">{d.nom}</span>
                  <span className="text-muted-foreground shrink-0">
                    Ch. {d.chambre} · {d.heure}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* PRÉVISION — REAL, GET /reporting/yield-forecast. */}
      <section aria-labelledby="d-forecast">
        <SectionHeader
          id="d-forecast"
          title="Occupation — 7 prochains jours"
          description="Taux net, hors chambres en maintenance."
        />
        <Card className="mt-3">
          <CardContent className="pt-4">
            <div className="h-[150px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={mockForecast}
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fillD" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tauxOccupation"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#fillD)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export function PrototypeD() {
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  const [activeModule, setActiveModule] = useState('dashboard');

  return (
    <>
      {view === 'login' ? (
        <PrototypeDLogin onEnter={() => setView('dashboard')} />
      ) : (
        <div className="flex">
          <PrototypeDSidebar active={activeModule} onSelect={setActiveModule} />
          <div className="min-w-0 flex-1">
            <PrototypeDDashboard onNavigate={setActiveModule} />
          </div>
        </div>
      )}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-black/80 p-1 text-white shadow-lg backdrop-blur">
        <span className="mr-1 text-[11px] opacity-70">Prototype D — démo</span>
        <button
          type="button"
          onClick={() => setView('login')}
          className={`rounded-full px-3 py-1 text-xs ${view === 'login' ? 'bg-white text-black' : 'opacity-70'}`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setView('dashboard')}
          className={`rounded-full px-3 py-1 text-xs ${view === 'dashboard' ? 'bg-white text-black' : 'opacity-70'}`}
        >
          Dashboard
        </button>
      </div>
    </>
  );
}
