import { useEffect } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';
import type { Tab } from '@/App';

interface Props {
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  // CH-034 — panneau superposé sous le seuil `md` (docs/audits/
  // PHASE_11_FRONTEND_QUALITE.md §4.7) : `mobileOpen` ne pilote la
  // visibilité qu'en dessous de ce seuil, ignoré au-delà (le sélecteur
  // `md:` reprend toujours la main). `collapsed` reste un concept
  // strictement desktop — le tiroir mobile affiche toujours les libellés
  // complets, jamais le mode icônes seules.
  mobileOpen: boolean;
  onMobileClose: () => void;
  // CH-011 — permissions effectives de l'utilisateur courant (format
  // "module:action", voir GET /auth/me) ; `null` tant qu'elles n'ont pas
  // encore été chargées (aucun onglet affiché plutôt qu'un flash de tous
  // les onglets suivi d'un filtrage tardif).
  permissions: string[] | null;
  // Design Marine & Or — logo configurable (GET /parameters/branding,
  // Paramètres). `null` tant que non chargé ou non configuré : fallback
  // sur le badge "M" texte, jamais de plantage sur un logo absent.
  logoUrl?: string | null;
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
  mobileOpen,
  onMobileClose,
  permissions,
  logoUrl,
}: Props) {
  const visibleItems =
    permissions === null
      ? []
      : NAV_ITEMS.filter((item) => permissions.includes(item.permission));

  // Le tiroir mobile ignore volontairement `collapsed` (concept desktop
  // uniquement) — voir commentaire sur la prop `mobileOpen` ci-dessus.
  const showLabels = !collapsed || mobileOpen;

  useEffect(() => {
    if (!mobileOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onMobileClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onMobileClose]);

  function handleNavigate(tab: Tab) {
    onNavigate(tab);
    onMobileClose();
  }

  return (
    <>
      {mobileOpen && (
        <div
          data-slot="sidebar-backdrop"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-50 flex h-full w-60 flex-col border-r border-sidebar-border transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:static md:z-auto md:translate-x-0 md:transition-[width] md:duration-150',
          collapsed ? 'md:w-16' : 'md:w-60',
        )}
      >
        <div
          className={cn(
            'flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4',
            !showLabels && 'justify-center px-0',
          )}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="size-7 shrink-0 rounded-md object-contain"
            />
          ) : (
            <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold">
              M
            </span>
          )}
          {showLabels && (
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
                title={showLabels ? undefined : label}
                aria-current={active ? 'page' : undefined}
                onClick={() => handleNavigate(tab)}
                className={cn(
                  'flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--sidebar-primary)]'
                    : 'text-sidebar-foreground/85',
                  !showLabels && 'justify-center px-0',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {showLabels && <span className="truncate">{label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="hidden border-t border-sidebar-border p-2 md:block">
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
    </>
  );
}
