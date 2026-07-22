import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttendanceWidget } from '@/features/hr/components/AttendanceWidget';
import { NAV_ITEMS } from './nav-items';
import type { Tab } from '@/App';

interface Props {
  activeTab: Tab;
  onLogout: () => void;
}

export function AppTopbar({ activeTab, onLogout }: Props) {
  const title = NAV_ITEMS.find((item) => item.tab === activeTab)?.label ?? '';

  return (
    <header className="bg-card flex h-14 shrink-0 items-center justify-between border-b px-5">
      <h1 className="text-base font-semibold">{title}</h1>
      <div className="flex items-center gap-3">
        <AttendanceWidget />
        <Button id="btn-logout" variant="ghost" size="sm" onClick={onLogout}>
          <LogOut />
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
