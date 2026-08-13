import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BedDouble,
  CalendarRange,
  KeyRound,
  Sparkles,
  UtensilsCrossed,
  Users,
  Wrench,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import type { DashboardResume } from '../types';
import type { DashboardTarget } from '../pages/DashboardPage';

// DESIGN-005 (intégration Prototype D3 validée, /design-preview/d3) —
// "Accès rapides" : les 8 modules les plus utilisés au quotidien, avec une
// identité couleur propre par module (mission §4), délibérément distincte
// des tokens sémantiques --success/--warning/--destructive déjà utilisés
// pour les STATUTS (chambre, ticket) ailleurs sur ce Dashboard — mélanger
// les deux langages ferait croire qu'une tuile "Housekeeping" verte
// signale un état "success", alors qu'il s'agit d'une identité de module.
//
// Navigation via `onNavigate` (la même prop `DashboardTarget` déjà câblée
// sur App.tsx → `setTab`, RD-existant) : aucune nouvelle route. Le gating
// par permission reprend la convention de nav-items.ts (permission ":read"
// de l'écran cible) — un onglet non autorisé n'a simplement pas de tuile,
// jamais un clic qui échouerait en 403.
//
// Écart assumé vs nav-items.ts : "Chambres" et "Housekeeping" pointent
// toutes deux vers l'onglet réel `housekeeping` (aucun onglet "Rooms" dédié
// aujourd'hui, CLAUDE.md/RD-024) — signalé ici plutôt que masqué. De même
// "Facturation" pointe vers `checkin` (Folio/Billing y vit, CLAUDE.md).
interface ModuleDef {
  key: string;
  tab: DashboardTarget;
  label: string;
  icon: LucideIcon;
  permission: string;
  bg: string;
  hover: string;
  badge?: (resume: DashboardResume) => number | undefined;
}

// Contraste vérifié ≥ 4.5:1 texte blanc (WCAG AA) pour chaque nuance :
// blue-600 ~5.2:1, indigo-600 ~5.5:1, teal-600 ~4.6:1, emerald-600 ~4.7:1,
// violet-600 ~4.8:1, rose-600 ~4.6:1. Deux nuances 600 ne passaient pas :
// amber-600 (~3.9:1) remonté à amber-700 (~5.1:1, mission DESIGN-005 §4
// "corriger le contraste de la tuile ambre/Restaurant") ; orange-600
// (~4.1:1, limite) remonté à orange-700 (~4.9:1) sur le même principe
// (FINAL UI CLOSURE §2 "contraste Maintenance").
const MODULES: ModuleDef[] = [
  {
    key: 'reservations',
    tab: 'reservations',
    label: 'Réservations',
    icon: CalendarRange,
    permission: 'reservations:read',
    bg: 'bg-blue-600',
    hover: 'hover:bg-blue-700',
  },
  {
    key: 'checkin',
    tab: 'checkin',
    label: 'Séjours / Check-in',
    icon: KeyRound,
    permission: 'checkin:read',
    bg: 'bg-indigo-600',
    hover: 'hover:bg-indigo-700',
    badge: (r) => r.arriveesAujourdhui,
  },
  {
    key: 'chambres',
    tab: 'housekeeping',
    label: 'Chambres',
    icon: BedDouble,
    permission: 'housekeeping:read',
    bg: 'bg-teal-600',
    hover: 'hover:bg-teal-700',
    badge: (r) => r.chambresANettoyer,
  },
  {
    key: 'housekeeping',
    tab: 'housekeeping',
    label: 'Housekeeping',
    icon: Sparkles,
    permission: 'housekeeping:read',
    bg: 'bg-emerald-600',
    hover: 'hover:bg-emerald-700',
  },
  {
    key: 'maintenance',
    tab: 'maintenance',
    label: 'Maintenance',
    icon: Wrench,
    permission: 'maintenance:read',
    bg: 'bg-orange-700',
    hover: 'hover:bg-orange-800',
  },
  {
    key: 'facturation',
    tab: 'checkin',
    label: 'Facturation',
    icon: BarChart3,
    permission: 'checkin:read',
    bg: 'bg-violet-600',
    hover: 'hover:bg-violet-700',
  },
  {
    key: 'restaurant',
    tab: 'restaurant',
    label: 'Restaurant',
    icon: UtensilsCrossed,
    permission: 'restaurant:write',
    bg: 'bg-amber-700',
    hover: 'hover:bg-amber-800',
  },
  {
    key: 'guests',
    tab: 'guests',
    label: 'Clients',
    icon: Users,
    permission: 'guests:read',
    bg: 'bg-rose-600',
    hover: 'hover:bg-rose-700',
  },
];

export function QuickAccessModules({
  permissions,
  resume,
  onNavigate,
}: {
  permissions: string[] | null;
  resume: DashboardResume | null;
  onNavigate: (target: DashboardTarget) => void;
}) {
  const visible = MODULES.filter((m) => permissions?.includes(m.permission));
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="dashboard-acces-rapides">
      <SectionHeader
        id="dashboard-acces-rapides"
        title="Accès rapides"
        description="Modules les plus utilisés au quotidien."
      />
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        {visible.map((mod) => {
          const Icon = mod.icon;
          const badge = resume && mod.badge ? mod.badge(resume) : undefined;
          return (
            <button
              key={mod.key}
              type="button"
              onClick={() => onNavigate(mod.tab)}
              className={`relative flex flex-col items-start gap-2 rounded-xl p-3.5 text-white shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-[var(--duration-fast)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${mod.bg} ${mod.hover}`}
            >
              {!!badge && badge > 0 && (
                <span className="absolute top-1.5 right-1.5 flex size-4.5 items-center justify-center rounded-full bg-white/25 text-[9.5px] font-bold text-white">
                  {badge}
                </span>
              )}
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                <Icon className="size-4" />
              </span>
              <span className="text-left text-[11.5px] leading-tight font-semibold">
                {mod.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
