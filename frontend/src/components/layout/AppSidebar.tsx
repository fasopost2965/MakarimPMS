import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_CATEGORIES, NAV_ITEMS, type NavCategoryKey } from './nav-items';
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

// Navigation principale (sidebar repliable, par catégories) — remplace la
// liste plate à 14 entrées (chantier design 2026-07-30, demande client :
// « réorganiser les menus des modules, ajouter des sous-modules pour aérer
// et rendre la navigation plus fluide », Audit relégué en fin de liste).
// Groupement en 6 catégories (nav-items.ts, NAV_CATEGORIES), chacune
// repliable indépendamment — la catégorie de l'onglet actif reste toujours
// dépliée, même si l'utilisateur l'avait repliée manuellement. Couleurs
// pilotées exclusivement via les tokens --sidebar-* (index.css), donc ce
// composant ne code aucune couleur en dur.
//
// DESIGN-002 (Makarim Design System 2026 §1.1bis) — chrome CLAIR : les
// tokens --sidebar-* pointent désormais sur --chrome-bg (#FFFFFF) et
// l'item actif sur --primary-soft/--primary, au lieu du marine sombre
// historique. Aucune logique de repli, de tiroir mobile ni de filtrage RBAC
// n'est modifiée par ce lot — uniquement la présentation.
//
// CH-011 — gating RBAC minimal (granularité onglet entier, RD-009) : un
// onglet n'est rendu que si `permissions` contient la permission déclarée
// dans NAV_ITEMS. Purement cosmétique/UX — le vrai contrôle d'accès reste
// PermissionsGuard côté serveur (docs/governance/REGISTRE_CHANTIERS.md,
// CH-011 : "Impact sécurité : Faible"). Une catégorie entièrement vidée par
// le filtrage RBAC (aucun item visible) n'est pas rendue du tout.
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

  // Catégories repliées par l'utilisateur (toutes dépliées par défaut —
  // l'hôtel a peu de modules par catégorie, pas besoin de tout masquer au
  // premier rendu).
  const [collapsedCategories, setCollapsedCategories] = useState<
    Set<NavCategoryKey>
  >(new Set());

  const activeCategory = NAV_ITEMS.find(
    (item) => item.tab === activeTab,
  )?.category;

  useEffect(() => {
    if (!mobileOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onMobileClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onMobileClose]);

  function toggleCategory(key: NavCategoryKey) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

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
          'bg-sidebar text-sidebar-foreground border-sidebar-border fixed inset-y-0 left-0 z-50 flex h-full w-[min(84vw,264px)] flex-col border-r shadow-[var(--shadow-elevated)] transition-transform duration-[var(--duration-base)] ease-[var(--ease-out-brand)]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:static md:z-auto md:translate-x-0 md:shadow-[var(--shadow-card)] md:transition-[width] md:duration-[var(--duration-base)]',
          // §1.3 — 192px déplié / 64px replié (icônes seules).
          collapsed
            ? 'md:w-[var(--sidebar-width-collapsed)]'
            : 'md:w-[var(--sidebar-width)]',
        )}
      >
        <div
          className={cn(
            'border-sidebar-border flex h-14 shrink-0 items-center gap-2.5 border-b px-3',
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
            <span className="bg-primary text-primary-ink flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold">
              M
            </span>
          )}
          {showLabels && (
            <span className="min-w-0">
              <span className="text-foreground block truncate text-sm font-bold">
                Makarim
              </span>
              <span className="text-muted-foreground block truncate text-[11px]">
                PMS Hôtel · Tétouan
              </span>
            </span>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
          {NAV_CATEGORIES.map((category) => {
            const categoryItems = visibleItems.filter(
              (item) => item.category === category.key,
            );
            if (categoryItems.length === 0) return null;

            const isCollapsed =
              collapsedCategories.has(category.key) &&
              category.key !== activeCategory;
            const hasActiveItem = categoryItems.some(
              (item) => item.tab === activeTab,
            );

            return (
              <div key={category.key} className="flex flex-col gap-0.5">
                {showLabels ? (
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.key)}
                    aria-expanded={!isCollapsed}
                    className={cn(
                      // §1.4 — micro-label/eyebrow : 11px uppercase reste
                      // autorisé ici (en-tête de groupe très court), jamais
                      // pour un label de formulaire.
                      'text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] font-bold tracking-[0.03em] uppercase transition-colors duration-[var(--duration-fast)] focus-visible:ring-3 focus-visible:outline-none',
                      hasActiveItem && 'text-primary',
                    )}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span>{category.label}</span>
                      <span className="bg-surface-2 text-muted-foreground rounded px-1 font-mono text-[10px] font-normal">
                        {categoryItems.length}
                      </span>
                    </span>
                    {isCollapsed ? (
                      <ChevronRight className="size-3 shrink-0 opacity-70" />
                    ) : (
                      <ChevronDown className="size-3 shrink-0 opacity-70" />
                    )}
                  </button>
                ) : (
                  <div className="border-sidebar-border/50 mx-2 my-1 border-t" />
                )}

                {(!isCollapsed || !showLabels) && (
                  <div className="flex flex-col gap-0.5 pl-0.5">
                    {categoryItems.map(({ tab, label, icon: Icon }) => {
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
                            // §8 — 44px de hauteur tactile sous `md`
                            // (tiroir mobile), densité desktop conservée.
                            'focus-visible:ring-ring/50 flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors duration-[var(--duration-fast)] focus-visible:ring-3 focus-visible:outline-none md:min-h-9',
                            'hover:bg-surface-2 hover:text-foreground',
                            // §1.1bis — item actif : fond --primary-soft +
                            // texte/icône --primary (contraste ~5.1:1).
                            active
                              ? 'bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary font-semibold'
                              : 'text-sidebar-foreground',
                            !showLabels && 'justify-center px-0',
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          {showLabels && (
                            <span className="truncate">{label}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-sidebar-border hidden border-t p-2 md:block">
          <button
            id="nav-toggle-collapse"
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            aria-expanded={!collapsed}
            className={cn(
              'text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors duration-[var(--duration-fast)] focus-visible:ring-3 focus-visible:outline-none',
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
