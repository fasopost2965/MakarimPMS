import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttendanceWidget } from '@/features/hr/components/AttendanceWidget';
import { NAV_CATEGORIES, NAV_ITEMS } from './nav-items';
import { NotificationCenter } from './NotificationCenter';
import { GlobalSearch } from './GlobalSearch';
import type { Tab } from '@/App';

interface Props {
  activeTab: Tab;
  onLogout: () => void;
  // CH-034 — ouvre le tiroir de navigation, visible seulement sous `md`
  // (AppSidebar.tsx ignore cette prop au-delà de ce seuil).
  onOpenMobileNav: () => void;
  onNavigate: (tab: Tab) => void;
  permissions: string[] | null;
}

export function AppTopbar({
  activeTab,
  onLogout,
  onOpenMobileNav,
  onNavigate,
  permissions,
}: Props) {
  const activeItem = NAV_ITEMS.find((item) => item.tab === activeTab);
  const title = activeItem?.label ?? '';
  const categoryLabel = NAV_CATEGORIES.find(
    (category) => category.key === activeItem?.category,
  )?.label;

  return (
    // DESIGN-002 (§1.1bis) — chrome clair unifié avec la sidebar : la
    // topbar reste --surface, seul le contenu passe en --background.
    // Aucune fonctionnalité retirée (recherche globale, notifications,
    // pointage, déconnexion) — seules la hiérarchie et la densité changent.
    <header className="bg-card border-border flex h-14 shrink-0 items-center justify-between gap-3 border-b px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="size-11 shrink-0 md:hidden"
          onClick={onOpenMobileNav}
          aria-label="Ouvrir la navigation"
        >
          <Menu />
        </Button>
        <div className="min-w-0">
          {/* Fil de contexte (catégorie de nav) — masqué sous `sm` où la
              place manque, l'onglet actif restant visible dans le tiroir. */}
          {categoryLabel && (
            <p className="text-muted-foreground hidden truncate text-[11px] leading-3 font-semibold tracking-[0.03em] uppercase sm:block">
              {categoryLabel}
            </p>
          )}
          {/* §1.4 — titre de page 19px/800. */}
          <h1 className="truncate text-[17px] leading-6 font-extrabold tracking-[-0.01em] sm:text-[19px]">
            {title}
          </h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <GlobalSearch permissions={permissions} onNavigate={onNavigate} />
        <NotificationCenter permissions={permissions} onNavigate={onNavigate} />
        <AttendanceWidget />
        <Button
          id="btn-logout"
          variant="ghost"
          size="sm"
          // §8 — 44×44px minimum en mobile, où le libellé est masqué et le
          // bouton se réduit à sa seule icône.
          className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-0"
          onClick={onLogout}
          aria-label="Déconnexion"
        >
          <LogOut />
          <span className="hidden sm:inline">Déconnexion</span>
        </Button>
      </div>
    </header>
  );
}
