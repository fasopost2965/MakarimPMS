import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';
import type { Tab } from '@/App';

interface Props {
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  // CH-011 — permissions effectives de l'utilisateur courant (format
  // "module:action", voir GET /auth/me) ; `null` tant qu'elles n'ont pas
  // encore été chargées (aucun onglet affiché plutôt qu'un flash de tous
  // les onglets suivi d'un filtrage tardif).
  permissions: string[] | null;
}

// Navigation principale (sidebar repliable) — remplace l'ancienne rangée de
// boutons horizontale, devenue trop étroite à 11 modules. Palette "Ardoise &
// Laiton" pilotée exclusivement via les tokens --sidebar-* (index.css), donc
// ce composant ne code aucune couleur en dur.
//
// CH-011 — gating RBAC minimal (granularité onglet entier, RD-009) : un
// onglet n'est rendu que si `permissions` contient la permission déclarée
// dans NAV_ITEMS. Purement cosmétique/UX — le vrai contrôle d'accès reste
// PermissionsGuard côté serveur (docs/governance/REGISTRE_CHANTIERS.md,
// CH-011 : "Impact sécurité : Faible").
export function AppSidebar({
  activeTab,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  permissions,
}: Props) {
  const visibleItems =
    permissions === null
      ? []
      : NAV_ITEMS.filter((item) => permissions.includes(item.permission));
  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground flex h-full flex-col border-r border-sidebar-border transition-[width] duration-150',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold">
          M
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              Makarim
            </span>
            <span className="text-sidebar-foreground/60 block truncate text-[10px] tracking-wide">
              PMS Hôtel · Tétouan
            </span>
          </span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {visibleItems.map(({ tab, label, icon: Icon }) => {
          const active = tab === activeTab;
          return (
            <button
              key={tab}
              id={`nav-${tab}`}
              type="button"
              title={collapsed ? label : undefined}
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(tab)}
              className={cn(
                'flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--sidebar-primary)]'
                  : 'text-sidebar-foreground/85',
                collapsed && 'justify-center px-0',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <button
          id="nav-toggle-collapse"
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          className={cn(
            'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-4 shrink-0" />
          ) : (
            <>
              <ChevronsLeft className="size-4 shrink-0" />
              <span>Replier</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
