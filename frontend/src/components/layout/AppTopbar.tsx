import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttendanceWidget } from '@/features/hr/components/AttendanceWidget';
import { NAV_ITEMS } from './nav-items';
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
  const title = NAV_ITEMS.find((item) => item.tab === activeTab)?.label ?? '';

  return (
    <header className="bg-card flex h-14 shrink-0 items-center justify-between gap-3 border-b px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 md:hidden"
          onClick={onOpenMobileNav}
          aria-label="Ouvrir la navigation"
        >
          <Menu />
        </Button>
        <h1 className="truncate text-base font-semibold">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <GlobalSearch permissions={permissions} onNavigate={onNavigate} />
        <NotificationCenter permissions={permissions} onNavigate={onNavigate} />
        <AttendanceWidget />
        <Button id="btn-logout" variant="ghost" size="sm" onClick={onLogout}>
          <LogOut />
          <span className="hidden sm:inline">Déconnexion</span>
        </Button>
      </div>
    </header>
  );
}
