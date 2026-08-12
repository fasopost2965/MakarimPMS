import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BedDouble,
  Building2,
  CalendarRange,
  ChevronRight,
  History,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyDisplay } from '@/components/ui/money-display';
import {
  mockAllRooms,
  mockArrivals,
  mockDepartures,
  mockForecast,
  mockResume,
  mockRooms,
  mockTickets,
} from './mock-data';

// DESIGN-005 — PROTOTYPE D3 : traduction fidèle de la direction visuelle
// VALIDÉE par le propriétaire produit (mission D3, préambule : "ce n'est
// plus une exploration libre"). D2 reste intact à /design-preview/d2 — ce
// fichier n'en réutilise pas le code, il retranscrit sa direction avec la
// composition demandée : header compact une ligne, Accès rapides = élément
// majeur juste en dessous, bande KPI compacte avec micro-tendance quand
// elle est dérivable honnêtement, puis une grille 3 colonnes (Chambres
// dominant / À traiter / Aujourd'hui), et une prévision 7 jours en ligne
// compacte. Toujours aucune donnée réelle chargée, aucun appel réseau —
// voir README.md du dossier. Classification REAL/DERIVED/NEEDS BACKEND/
// DESIGN ONLY posée en commentaire à chaque zone.
//
// Écart signalé par rapport à D2 (§8 de la mission) : la mission demande
// explicitement une sidebar "sombre" pour D3, alors que D2 utilisait le
// chrome clair du design system (--sidebar = --chrome-bg, blanc). Ce n'est
// pas un oubli : c'est appliqué tel quel ci-dessous (palette sombre propre
// à ce prototype, cohérente avec le Login), et documenté dans le rapport
// de livraison plutôt que corrigé silencieusement vers le comportement de
// D2.

// ---------------------------------------------------------------------------
// LOGIN — repris à l'identique de D2 (non demandé dans le périmètre D3,
// la mission porte sur le Dashboard). Conservé pour que /design-preview/d3
// soit consultable de bout en bout comme les prototypes précédents.
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

function PrototypeD3Login({ onEnter }: { onEnter: () => void }) {
  const [selected, setSelected] = useState<(typeof ESPACES)[number] | null>(
    null,
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0b1220]">
      <div className="hidden w-[340px] shrink-0 flex-col justify-center gap-8 border-r border-white/10 bg-[#0f1a2e] px-9 sm:flex">
        <div className="flex items-center gap-2.5 text-white">
          <span className="border-primary-soft/30 bg-primary flex size-9 items-center justify-center rounded-full border text-sm font-bold">
            M
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-[0.03em]">
              Hôtel Makarim
            </span>
            <span className="block text-[11px] text-white/45">
              PMS · Tétouan
            </span>
          </span>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">
            Choisissez votre espace
          </h1>
          <p className="mt-1 text-[12px] leading-relaxed text-white/45">
            L'accès réel reste déterminé par votre compte, quel que soit
            l'espace sélectionné.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          {ESPACES.map((espace) => {
            const Icon = espace.icon;
            const active = selected?.nom === espace.nom;
            return (
              <button
                key={espace.nom}
                type="button"
                onClick={() => setSelected(espace)}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-[var(--duration-fast)] ${
                  active
                    ? 'border-primary bg-primary/15'
                    : 'border-white/10 hover:border-white/25 hover:bg-white/[0.04]'
                }`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white/10 text-white/70'
                  }`}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-white">
                    {espace.label}
                  </span>
                  <span className="block truncate text-[10.5px] leading-tight text-white/45">
                    {espace.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden p-8"
        style={{
          background:
            'radial-gradient(120% 100% at 70% 20%, #16233c 0%, #0b1220 65%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 72px)',
          }}
        />
        <div className="relative flex w-full max-w-[420px] flex-col items-center gap-6 sm:hidden">
          <p className="text-sm text-white/70">Choisissez votre espace</p>
          <div className="grid w-full grid-cols-2 gap-2">
            {ESPACES.map((espace) => {
              const Icon = espace.icon;
              const active = selected?.nom === espace.nom;
              return (
                <button
                  key={espace.nom}
                  type="button"
                  onClick={() => setSelected(espace)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center ${active ? 'border-primary bg-primary/15' : 'border-white/10'}`}
                >
                  <Icon className="size-4 text-white/80" />
                  <span className="text-[11px] font-semibold text-white">
                    {espace.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative flex min-h-[300px] w-full max-w-[380px] flex-col justify-center rounded-2xl border border-white/10 bg-[#0f1a2e] p-7 shadow-2xl">
          {selected ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onEnter();
              }}
              className="flex flex-col gap-3.5"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="bg-primary/20 text-primary flex size-7 items-center justify-center rounded-lg">
                  <selected.icon className="size-3.5" />
                </span>
                <p className="text-sm font-semibold text-white">
                  {selected.label}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d3-email" className="text-[12px] text-white/70">
                  Email
                </Label>
                <Input
                  id="d3-email"
                  type="email"
                  required
                  className="h-10 border-white/15 bg-white/[0.05] text-white placeholder:text-white/30"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d3-pass" className="text-[12px] text-white/70">
                  Mot de passe
                </Label>
                <Input
                  id="d3-pass"
                  type="password"
                  required
                  className="h-10 border-white/15 bg-white/[0.05] text-white placeholder:text-white/30"
                />
              </div>
              <Button type="submit" className="mt-1 h-11">
                Se connecter
              </Button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="mt-1 text-center text-[11px] text-white/40 hover:text-white/70 sm:hidden"
              >
                ← Changer d'espace
              </button>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="bg-white/5 text-white/30 flex size-11 items-center justify-center rounded-full">
                <LogIn className="size-5" />
              </span>
              <p className="text-sm font-medium text-white/60">
                Sélectionnez un espace
              </p>
              <p className="text-[11.5px] text-white/35">
                Le formulaire de connexion apparaît ici.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SIDEBAR — sombre (mission §8, écart assumé vs D2, voir en-tête de fichier),
// sticky, compacte, contenu identique (copie fidèle de nav-items.ts, REAL).
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

function PrototypeD3Sidebar({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (key: string) => void;
}) {
  const categories = useSidebarCategories();
  return (
    <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col self-start border-r border-white/10 bg-[#0f1a2e] lg:flex">
      <div className="flex h-13 shrink-0 items-center gap-2.5 border-b border-white/10 px-3.5">
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-bold">
          M
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-white">
            Makarim
          </span>
          <span className="block truncate text-[10.5px] text-white/40">
            PMS Hôtel · Tétouan
          </span>
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-2">
        {categories.map((cat) => (
          <div key={cat.key} className="flex flex-col gap-0.5">
            <p className="px-2.5 py-1 text-[10px] font-bold tracking-[0.05em] text-white/35 uppercase">
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
                  className={`flex min-h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-[var(--duration-fast)] ${
                    isActive
                      ? 'bg-primary/20 text-primary-soft font-semibold'
                      : 'text-white/65 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {item.label}
                  </span>
                  {!!item.badge && item.badge > 0 && (
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums ${
                        isActive
                          ? 'bg-primary/25 text-primary-soft'
                          : 'bg-white/10 text-white/60'
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
// HEADER COMPACT — une seule ligne visuelle (mission §1). L'heure est
// l'horloge locale du navigateur (DESIGN ONLY — ne provient d'aucune API,
// c'est un affichage client pur comme un reveil, pas une donnée métier).
// Notifications : icône affordance seule, aucun badge inventé — aucun
// compteur de notifications non lues n'est exposé par le Dashboard
// aujourd'hui (NEEDS BACKEND si l'on veut un vrai badge un jour).
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function CompactHeader({ urgentCount }: { urgentCount: number }) {
  const now = useClock();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b pb-3">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="relative flex size-1.5 shrink-0">
          <span className="bg-success absolute inline-flex size-full animate-ping rounded-full opacity-60" />
          <span className="bg-success relative inline-flex size-1.5 rounded-full" />
        </span>
        <span className="text-muted-foreground text-[10.5px] font-bold tracking-[0.04em] uppercase">
          Vue opérationnelle
        </span>
        <h1 className="text-[17px] font-extrabold tracking-[-0.01em]">
          Makarim Operations
        </h1>
        <span className="text-muted-foreground text-xs">
          · mercredi 12 août 2026
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {now.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <span className="text-muted-foreground hidden text-xs sm:inline">
          Hôtel Makarim
        </span>
        <button
          type="button"
          aria-label="Notifications"
          className="text-muted-foreground hover:bg-surface-2 hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors duration-[var(--duration-fast)]"
        >
          <Bell className="size-4" />
        </button>
        {urgentCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="size-3" />
            {urgentCount} urgent{urgentCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ACCÈS RAPIDES — élément majeur (mission §2), directement sous le header.
// Palette module distincte des tokens sémantiques de statut (même principe
// que D2, voir son commentaire). Ajout d'une flèche d'action et d'un hover
// plus marqué (translate + anneau clair) pour renforcer l'affordance
// "cliquable" demandée.
const PRIMARY_MODULES: {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  bg: string;
  hover: string;
}[] = [
  {
    key: 'reservations',
    label: 'Réservations',
    icon: CalendarRange,
    bg: 'bg-blue-600',
    hover: 'hover:bg-blue-700',
  },
  {
    key: 'checkin',
    label: 'Séjours',
    icon: KeyRound,
    badge: mockResume.arriveesAujourdhui,
    bg: 'bg-indigo-600',
    hover: 'hover:bg-indigo-700',
  },
  // "Chambres" et "Housekeeping" partagent le même écran réel aujourd'hui
  // (pas d'onglet "Rooms" dédié dans nav-items.ts, CLAUDE.md/RD-024) —
  // signalé, pas masqué.
  {
    key: 'housekeeping',
    label: 'Chambres',
    icon: BedDouble,
    badge: mockResume.chambresANettoyer,
    bg: 'bg-teal-600',
    hover: 'hover:bg-teal-700',
  },
  {
    key: 'housekeeping',
    label: 'Housekeeping',
    icon: Sparkles,
    bg: 'bg-emerald-600',
    hover: 'hover:bg-emerald-700',
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    icon: Wrench,
    badge: mockTickets.filter((t) => t.priorite === 'URGENTE').length,
    bg: 'bg-orange-600',
    hover: 'hover:bg-orange-700',
  },
  // "Facturation" : pas d'onglet dédié (Folio vit dans Check-in & séjours).
  {
    key: 'checkin',
    label: 'Facturation',
    icon: BarChart3,
    bg: 'bg-violet-600',
    hover: 'hover:bg-violet-700',
  },
  {
    key: 'restaurant',
    label: 'Restaurant',
    icon: UtensilsCrossed,
    bg: 'bg-amber-600',
    hover: 'hover:bg-amber-700',
  },
  {
    key: 'guests',
    label: 'Clients',
    icon: Users,
    bg: 'bg-rose-600',
    hover: 'hover:bg-rose-700',
  },
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
    <section aria-labelledby="d3-modules">
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        {PRIMARY_MODULES.map((mod, i) => {
          const Icon = mod.icon;
          return (
            <button
              key={`${mod.key}-${i}`}
              type="button"
              onClick={() => onNavigate(mod.key)}
              className={`group relative flex flex-col items-start gap-2 rounded-xl p-3.5 text-white shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-[var(--duration-fast)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${mod.bg} ${mod.hover}`}
            >
              {!!mod.badge && mod.badge > 0 && (
                <span className="absolute top-1.5 right-1.5 flex size-4.5 items-center justify-center rounded-full bg-white/25 text-[9.5px] font-bold text-white">
                  {mod.badge}
                </span>
              )}
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                <Icon className="size-4" />
              </span>
              <span className="flex w-full items-center justify-between gap-1">
                <span className="text-left text-[11.5px] leading-tight font-semibold">
                  {mod.label}
                </span>
                <ChevronRight className="size-3.5 shrink-0 opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-70" />
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
// KPI — bande compacte (mission §3), micro-tendance UNIQUEMENT sur
// l'occupation : c'est la seule carte où une série de plusieurs jours
// existe réellement en mock (mockForecast, dérivé de GET /reporting/
// yield-forecast) — jamais de tendance inventée pour les autres KPI, qui
// n'ont qu'une valeur ponctuelle "aujourd'hui" côté API.
function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const w = 64;
  const h = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      width={w}
      height={h}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const KPI_TONE: Record<string, string> = {
  primary: 'text-primary bg-primary-soft',
  success: 'text-success bg-success-soft',
  warning: 'text-warning bg-warning-soft',
  danger: 'text-destructive bg-destructive-soft',
  neutral: 'text-muted-foreground bg-surface-2',
};

function CompactStat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone: keyof typeof KPI_TONE;
}) {
  return (
    <div className="bg-card border-border flex items-center gap-2.5 rounded-lg border p-3">
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-md ${KPI_TONE[tone]}`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10.5px] font-semibold tracking-[0.02em] uppercase opacity-70">
          {label}
        </p>
        <p className="text-[17px] leading-5 font-extrabold tabular-nums">
          {value}
        </p>
        {hint && (
          <p className="text-muted-foreground truncate text-[10px]">{hint}</p>
        )}
      </div>
    </div>
  );
}

function KpiStrip() {
  const urgentTickets = mockTickets.filter((t) => t.priorite === 'URGENTE');
  const roomsPropresLibres = mockAllRooms.filter(
    (r) => r.statut === 'LIBRE_PROPRE',
  ).length;
  const forecastValues = mockForecast.map((j) => j.tauxOccupation);
  const trendUp =
    forecastValues[forecastValues.length - 1] >= forecastValues[0];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
      <div className="bg-card border-border col-span-2 flex items-center gap-3 rounded-lg border p-3 lg:col-span-1">
        <span className="bg-primary-soft text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
          <LayoutDashboard className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold tracking-[0.02em] uppercase opacity-70">
            Occupation
          </p>
          <div className="flex items-center gap-2">
            <p className="text-[17px] leading-5 font-extrabold tabular-nums">
              {mockResume.tauxOccupation}%
            </p>
            <Sparkline
              values={forecastValues}
              className={trendUp ? 'text-success' : 'text-warning'}
            />
            {trendUp ? (
              <TrendingUp className="text-success size-3.5 shrink-0" />
            ) : (
              <TrendingDown className="text-warning size-3.5 shrink-0" />
            )}
          </div>
        </div>
      </div>
      <CompactStat
        label="Propres libres"
        value={String(Math.max(0, roomsPropresLibres))}
        hint="Prêtes à vendre"
        icon={Sparkles}
        tone="success"
      />
      <CompactStat
        label="À nettoyer"
        value={String(mockResume.chambresANettoyer)}
        icon={Sparkles}
        tone={mockResume.chambresANettoyer > 0 ? 'warning' : 'neutral'}
      />
      <CompactStat
        label="Arrivées"
        value={String(mockResume.arriveesAujourdhui)}
        icon={LogIn}
        tone="success"
      />
      <CompactStat
        label="Départs"
        value={String(mockResume.departsAujourdhui)}
        icon={LogOut}
        tone="warning"
      />
      <CompactStat
        label="Encaissé"
        value={
          <MoneyDisplay
            value={mockResume.encaisseAujourdhui}
            className="text-[15px] whitespace-nowrap"
          />
        }
        icon={BarChart3}
        tone="neutral"
      />
      <CompactStat
        label="Maintenance"
        value={String(
          mockAllRooms.filter((r) => r.statut === 'EN_MAINTENANCE').length,
        )}
        hint={`${urgentTickets.length} urgente(s)`}
        icon={Wrench}
        tone={urgentTickets.length > 0 ? 'danger' : 'neutral'}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ZONE OPÉRATIONNELLE — grille 3 colonnes desktop (mission §4/§5/§6) :
// Chambres (dominant) | À traiter | Aujourd'hui. REAL pour les chambres/
// tickets, DERIVED pour les regroupements et badges d'urgence.
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
    <div className="bg-card border-border flex h-full flex-col rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">État des chambres</h2>
        <span className="text-muted-foreground text-[11px]">
          {mockResume.totalChambres} chambres
        </span>
      </div>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
        {mockAllRooms.map((room) => {
          const { statut, numero, etage } = room;
          return (
            <div
              key={room.id}
              title={`Ch. ${numero} (étage ${etage ?? '—'}) — ${ROOM_LABEL[statut]}`}
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
    </div>
  );
}

// Badges Urgent/Important/Bloquant/Normal (mission §5). "Bloquant" est
// DERIVED du vrai statut Room.EN_MAINTENANCE (le signal réellement bloquant
// pour la vente, cf. CLAUDE.md — MaintenanceTicket.bloqueVente n'est pas
// mocké ici, la chambre EN_MAINTENANCE en est le proxy honnête déjà utilisé
// ailleurs dans ce dossier) — jamais déduit de la seule priorité du ticket.
const PRIORITE_BADGE: Record<
  string,
  { label: string; variant: 'destructive' | 'warning' | 'outline' }
> = {
  URGENTE: { label: 'Urgent', variant: 'destructive' },
  HAUTE: { label: 'Important', variant: 'warning' },
  MOYENNE: { label: 'Normal', variant: 'outline' },
  BASSE: { label: 'Normal', variant: 'outline' },
};

function ATraiterColumn() {
  const roomsToClean = mockRooms.filter(
    (r) => r.statut === 'A_NETTOYER' || r.statut === 'EN_NETTOYAGE',
  );
  const roomsBlocked = mockRooms.filter((r) => r.statut === 'EN_MAINTENANCE');
  const orderedTickets = [
    ...mockTickets.filter((t) => t.priorite === 'URGENTE'),
    ...mockTickets.filter((t) => t.priorite !== 'URGENTE'),
  ];

  return (
    <div className="bg-card border-border flex h-full flex-col gap-4 rounded-lg border p-4">
      <h2 className="text-sm font-bold">À traiter</h2>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
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
        {/* Contrôles en attente (validation Gouvernante d'une tâche
            TERMINEE, cf. docs/modules/housekeeping.md) : NEEDS BACKEND —
            HousekeepingTask n'est pas mocké dans ce dossier isolé, aucun
            chiffre inventé. */}
        <p className="text-muted-foreground mt-2 text-[10.5px] italic">
          Contrôles en attente — nécessite HousekeepingTask (non disponible dans
          ce prototype, NEEDS BACKEND).
        </p>
      </div>

      <div className="border-t pt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Wrench className="size-3.5" /> Maintenance
          </p>
          {roomsBlocked.length > 0 && (
            <Badge variant="destructive">
              Bloquant · {roomsBlocked.length}
            </Badge>
          )}
        </div>
        {roomsBlocked.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {roomsBlocked.map((r) => (
              <Badge key={r.id} variant="destructive">
                Ch. {r.numero}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {orderedTickets.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 text-[11.5px]"
            >
              <span className="truncate">
                Ch. {t.roomNumero} — {t.typePanne}
              </span>
              <Badge variant={PRIORITE_BADGE[t.priorite].variant}>
                {PRIORITE_BADGE[t.priorite].label}
              </Badge>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-[10.5px] italic">
          Interventions planifiées — statut de planification non exposé par GET
          /maintenance-tickets (NEEDS BACKEND).
        </p>
      </div>
    </div>
  );
}

function AujourdhuiColumn() {
  return (
    <div className="bg-card border-border flex h-full flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Aujourd'hui</h2>
        <Badge variant="outline" className="text-[10px]">
          aperçu
        </Badge>
      </div>

      {/* "Séjours en cours" — DERIVED : réutilise chambresOccupees (REAL,
          GET /dashboard/resume) comme proxy des séjours actifs. Une
          chambre occupée correspond en pratique à un Stay EN_COURS, mais
          ce n'est pas littéralement le même champ — approximation
          assumée, pas une nouvelle donnée inventée. */}
      <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
        <span className="text-xs font-medium">Séjours en cours</span>
        <span className="font-mono text-sm font-bold tabular-nums">
          {mockResume.chambresOccupees}
        </span>
      </div>

      <div>
        <p className="text-success mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
          <LogIn className="size-3.5" /> Arrivées ({mockArrivals.length})
        </p>
        <div className="flex flex-col gap-1">
          {mockArrivals.map((a) => (
            <div
              key={a.nom}
              className="flex items-center justify-between text-[11.5px]"
            >
              <span className="truncate">{a.nom}</span>
              <span className="text-muted-foreground shrink-0">
                {a.chambre} · {a.heure}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-warning mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
          <LogOut className="size-3.5" /> Départs ({mockDepartures.length})
        </p>
        <div className="flex flex-col gap-1">
          {mockDepartures.map((d) => (
            <div
              key={d.nom}
              className="flex items-center justify-between text-[11.5px]"
            >
              <span className="truncate">{d.nom}</span>
              <span className="text-muted-foreground shrink-0">
                {d.chambre} · {d.heure}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PRÉVISION — ligne horizontale compacte (mission §7). Jours ≥ 90% mis en
// évidence ("forte" demande), tendance globale DERIVED (comparaison du
// premier et dernier jour de la série REAL).
function ForecastRow() {
  const values = mockForecast.map((j) => j.tauxOccupation);
  const first = values[0];
  const last = values[values.length - 1];
  const trendUp = last >= first;
  const delta = last - first;

  return (
    <div className="bg-card border-border rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Occupation — 7 prochains jours</h2>
          <p className="text-muted-foreground text-[11px]">
            Taux net, hors chambres en maintenance
          </p>
        </div>
        <span
          className={`flex items-center gap-1 text-xs font-semibold ${trendUp ? 'text-success' : 'text-warning'}`}
        >
          {trendUp ? (
            <TrendingUp className="size-3.5" />
          ) : (
            <TrendingDown className="size-3.5" />
          )}
          {trendUp ? '+' : ''}
          {delta} pt sur la période
        </span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {mockForecast.map((jour) => {
          const forte = jour.tauxOccupation >= 90;
          return (
            <div
              key={jour.date}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 ${
                forte
                  ? 'border-warning/30 bg-warning-soft'
                  : 'border-border bg-surface-2'
              }`}
            >
              <span className="text-muted-foreground text-[10px] font-semibold uppercase">
                {jour.label}
              </span>
              <span
                className={`text-base font-extrabold tabular-nums ${forte ? 'text-warning' : ''}`}
              >
                {jour.tauxOccupation}%
              </span>
              <div className="bg-border h-[3px] w-full overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${forte ? 'bg-warning' : 'bg-primary'}`}
                  style={{ width: `${jour.tauxOccupation}%` }}
                />
              </div>
              {forte && (
                <span className="text-warning text-[9px] font-bold uppercase">
                  Forte
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DASHBOARD — assemble les zones. Densité forte (mission §9) : espaces
// verticaux réduits au minimum utile, tout tient visiblement plus haut
// qu'en D2 à résolution égale.
function PrototypeD3Dashboard({
  onNavigate,
}: {
  onNavigate: (key: string) => void;
}) {
  const urgentTickets = mockTickets.filter((t) => t.priorite === 'URGENTE');

  return (
    <div className="flex flex-col gap-4 p-5 lg:p-6">
      <CompactHeader urgentCount={urgentTickets.length} />
      <ModulesQuickAccess onNavigate={onNavigate} />
      <KpiStrip />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr_1fr]">
        <RoomsStateGrid />
        <ATraiterColumn />
        <AujourdhuiColumn />
      </div>

      <ForecastRow />
    </div>
  );
}

export function PrototypeD3() {
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  const [activeModule, setActiveModule] = useState('dashboard');

  return (
    <>
      {view === 'login' ? (
        <PrototypeD3Login onEnter={() => setView('dashboard')} />
      ) : (
        <div className="flex items-start">
          <PrototypeD3Sidebar
            active={activeModule}
            onSelect={setActiveModule}
          />
          <div className="min-w-0 flex-1">
            <PrototypeD3Dashboard onNavigate={setActiveModule} />
          </div>
        </div>
      )}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-black/80 p-1 text-white shadow-lg backdrop-blur">
        <span className="mr-1 text-[11px] opacity-70">Prototype D3 — démo</span>
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
