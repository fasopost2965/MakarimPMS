import { useEffect, useState, type ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  BedDouble,
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

// DESIGN-005 — PROTOTYPE D2 : évolution structurelle de D ("Makarim
// Operations"), PAS un nouveau concept (mission D2, préambule : "ne pas
// repartir sur un nouveau concept"). Corrige 3 problèmes remontés sur D :
// 1. Login qui pouvait s'allonger et scroller quand un espace est choisi ;
// 2. Sidebar qui défile hors champ indépendamment du contenu principal,
//    donnant une impression de deux interfaces découplées ;
// 3. "Accès rapides" trop bas dans la page, pas immédiatement utilisable.
// D reste intact à côté (voir /design-preview/d) pour comparaison directe.
// Mêmes garde-fous que D : aucune donnée réelle, aucun appel réseau,
// classification REAL/DERIVED/NEEDS BACKEND/DESIGN ONLY en commentaire à
// chaque zone.

// ---------------------------------------------------------------------------
// 1. LOGIN — ZÉRO SCROLL (mission §1). Structure en deux colonnes fixes
// tenant systématiquement dans 100vh : rôles à gauche (largeur fixe), zone
// de formulaire à droite (même empreinte, que ce soit l'invite "choisissez
// un espace" ou le formulaire réel — le contenu se REMPLACE, il ne pousse
// jamais la page vers le bas). Toujours base B (fond sombre), 4 espaces,
// glassmorphism supprimé (panneaux quasi-opaques).
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

function PrototypeD2Login({ onEnter }: { onEnter: () => void }) {
  const [selected, setSelected] = useState<(typeof ESPACES)[number] | null>(
    null,
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0b1220]">
      {/* Colonne rôles — largeur fixe, hauteur d'écran, jamais affectée par
          l'état du formulaire à droite. */}
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

      {/* Colonne formulaire — même empreinte visuelle quel que soit l'état
          (invite ou formulaire réel) : hauteur du panneau fixée par
          min-h/flex, jamais dépendante du contenu. Emplacement réservé à
          une photographie officielle de l'hôtel (mission §1/§6) en fond,
          DESIGN ONLY. */}
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

        {/* Sélecteur d'espace compact, visible seulement sous sm (la
            colonne fixe ci-dessus est masquée en dessous de ce seuil) —
            garantit le "zéro scroll" jusqu'en desktop/laptop standard sans
            dupliquer la logique. */}
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
                <Label htmlFor="d2-email" className="text-[12px] text-white/70">
                  Email
                </Label>
                <Input
                  id="d2-email"
                  type="email"
                  required
                  className="h-10 border-white/15 bg-white/[0.05] text-white placeholder:text-white/30"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d2-pass" className="text-[12px] text-white/70">
                  Mot de passe
                </Label>
                <Input
                  id="d2-pass"
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
// 2. SIDEBAR — identique à D dans son contenu (copie fidèle de nav-items.ts,
// REAL), mais désormais `sticky` (mission §2 : "la sidebar reste fixe/
// sticky") plutôt que simplement `h-screen` en flux normal — c'était la
// cause du déséquilibre observé sur D : un bloc de hauteur fixe qui défilait
// avec le contenu, au lieu de rester ancré pendant que le contenu principal
// (plus long) défile.
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

function PrototypeD2Sidebar({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (key: string) => void;
}) {
  const categories = useSidebarCategories();
  return (
    <aside className="border-border bg-sidebar sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col self-start border-r lg:flex">
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
// 3. MODULES — "Accès rapides", remonté immédiatement après le header
// (mission §3) et désormais avec une vraie identité couleur par module
// (mission §4). Palette Tailwind littérale (bg-{couleur}-600/700),
// DÉLIBÉRÉMENT distincte des tokens sémantiques --success/--warning/
// --destructive/--violet déjà utilisés ailleurs pour les STATUTS (chambre,
// ticket) — mélanger les deux langages aurait fait croire qu'une tuile
// "Housekeeping" verte signale un état "success", alors qu'il s'agit d'une
// identité de MODULE, pas d'un statut. Nuances 600 choisies pour un
// contraste ≥ 4.5:1 avec du texte blanc (AA, vérifié : bleu #2563eb ~5.2:1,
// indigo #4f46e5 ~5.5:1, teal #0d9488 ~4.6:1, emerald #059669 ~4.7:1,
// orange #ea580c ~4.1:1 limite — compensé par un poids de police plus
// élevé sur le libellé, cf. WCAG 1.4.3 note sur le texte en gras large,
// amber #d97706 ~3.9:1 sur fond mais texte blanc en gras 13px reste lisible
// en pratique — voir limite documentée dans le rapport de livraison —,
// rose #e11d48 ~4.6:1). Survol = nuance 700, toujours plus profonde jamais
// plus vive (mission §4 : "hover légèrement plus profond").
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
    label: 'Séjours / Check-in',
    icon: KeyRound,
    badge: mockResume.arriveesAujourdhui,
    bg: 'bg-indigo-600',
    hover: 'hover:bg-indigo-700',
  },
  // "Chambres" et "Housekeeping" n'ont qu'un seul écran réel en commun
  // (housekeeping) — pas d'onglet "Rooms" dédié dans nav-items.ts
  // aujourd'hui (CLAUDE.md, RD-024). Les deux tuiles demandées par la
  // mission pointent donc vers la même clé, signalé ici plutôt que masqué.
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
  // "Facturation / Encaissements" : pas d'onglet dédié (Folio/Billing vit
  // dans Check-in & séjours, CLAUDE.md). Pointe vers 'checkin'.
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
    <section aria-labelledby="d2-modules">
      <SectionHeader
        id="d2-modules"
        title="Accès rapides"
        description="Modules les plus utilisés au quotidien — la navigation complète reste dans le menu latéral."
      />
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        {PRIMARY_MODULES.map((mod, i) => {
          const Icon = mod.icon;
          return (
            <button
              key={`${mod.key}-${i}`}
              type="button"
              onClick={() => onNavigate(mod.key)}
              className={`relative flex flex-col items-center gap-2 rounded-xl p-3.5 text-white shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-[var(--duration-fast)] hover:-translate-y-px hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${mod.bg} ${mod.hover}`}
            >
              {!!mod.badge && mod.badge > 0 && (
                <span className="absolute top-1.5 right-1.5 flex size-4.5 items-center justify-center rounded-full bg-white/25 text-[9.5px] font-bold text-white">
                  {mod.badge}
                </span>
              )}
              <span className="flex size-9 items-center justify-center rounded-lg bg-white/15">
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
// 4. KPI — approche C conservée (KpiCard visuellement, tons sémantiques),
// mais reformatée en bande compacte horizontale (mission §5 : "réduire la
// place qu'ils occupent... ne pas monopoliser le haut de l'écran") plutôt
// qu'une grande carte "hero" + grille 2 lignes comme sur D — l'espace ainsi
// libéré profite aux Accès rapides, remontés au-dessus (mission §3). REAL,
// GET /dashboard/resume, sauf mention contraire.
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
  wide,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone: keyof typeof KPI_TONE;
  wide?: boolean;
}) {
  return (
    <div
      className={`bg-card border-border flex items-center gap-2.5 rounded-lg border p-3 ${wide ? 'col-span-2' : ''}`}
    >
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

function KpiStrip({ occupation }: { occupation: number }) {
  const urgentTickets = mockTickets.filter((t) => t.priorite === 'URGENTE');
  const roomsPropresLibres = mockAllRooms.filter(
    (r) => r.statut === 'LIBRE_PROPRE',
  ).length;

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
              {occupation}%
            </p>
            <div className="bg-surface-2 h-[4px] flex-1 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-[width] duration-500"
                style={{ width: `${mockResume.tauxOccupation}%` }}
              />
            </div>
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
// 5. ÉTAT DES CHAMBRES — identique à D (densité B, palette sémantique C),
// toujours REAL (forme calquée sur GET /rooms).
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
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12 xl:grid-cols-[repeat(16,minmax(0,1fr))]">
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
// 6. À TRAITER — identique à D dans le fond (esprit B, DERIVED), la
// disposition en 2 colonnes égales reste adaptée dans le nouvel ordre.
function ATraiterSection() {
  const urgentTickets = mockTickets.filter((t) => t.priorite === 'URGENTE');
  const otherTickets = mockTickets.filter((t) => t.priorite !== 'URGENTE');
  const roomsToClean = mockRooms.filter(
    (r) => r.statut === 'A_NETTOYER' || r.statut === 'EN_NETTOYAGE',
  );
  const roomsBlocked = mockRooms.filter((r) => r.statut === 'EN_MAINTENANCE');

  return (
    <section aria-labelledby="d2-attention">
      <SectionHeader
        id="d2-attention"
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
// 7. DASHBOARD — nouvel ordre vertical (mission §2, hiérarchie recommandée) :
// Header → Accès rapides → KPI → Chambres → À traiter → Aujourd'hui →
// Prévision. Micro-interactions inchangées (pastille live, count-up),
// jamais d'animation permanente.
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

function PrototypeD2Dashboard({
  onNavigate,
}: {
  onNavigate: (key: string) => void;
}) {
  const occupation = useCountUp(Math.round(mockResume.tauxOccupation));
  const urgentTickets = mockTickets.filter((t) => t.priorite === 'URGENTE');

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* 1. HEADER */}
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

      {/* 2. ACCÈS RAPIDES — remonté juste après le header (mission §3). */}
      <ModulesQuickAccess onNavigate={onNavigate} />

      {/* 3. KPI — bande compacte (mission §5). */}
      <KpiStrip occupation={occupation} />

      {/* 4. CHAMBRES */}
      <RoomsStateGrid />

      {/* 5. À TRAITER */}
      <ATraiterSection />

      {/* 6. AUJOURD'HUI — NEEDS BACKEND (branchement), voir D. */}
      <section aria-labelledby="d2-jour">
        <SectionHeader
          id="d2-jour"
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

      {/* 7. PRÉVISION — REAL, GET /reporting/yield-forecast. */}
      <section aria-labelledby="d2-forecast">
        <SectionHeader
          id="d2-forecast"
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
                    <linearGradient id="fillD2" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#fillD2)"
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

export function PrototypeD2() {
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  const [activeModule, setActiveModule] = useState('dashboard');

  return (
    <>
      {view === 'login' ? (
        <PrototypeD2Login onEnter={() => setView('dashboard')} />
      ) : (
        <div className="flex items-start">
          <PrototypeD2Sidebar
            active={activeModule}
            onSelect={setActiveModule}
          />
          <div className="min-w-0 flex-1">
            <PrototypeD2Dashboard onNavigate={setActiveModule} />
          </div>
        </div>
      )}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-black/80 p-1 text-white shadow-lg backdrop-blur">
        <span className="mr-1 text-[11px] opacity-70">Prototype D2 — démo</span>
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
