import {
  BarChart3,
  Building2,
  CalendarRange,
  LayoutDashboard,
  LogIn,
  Package,
  Settings,
  Sparkles,
  UserRound,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Tab } from '@/App';

export interface NavItem {
  tab: Tab;
  label: string;
  icon: LucideIcon;
}

// Ordre de la navigation principale — un seul point de vérité partagé entre
// la sidebar (icônes + libellés) et tout futur breadcrumb/titre de page.
export const NAV_ITEMS: NavItem[] = [
  { tab: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { tab: 'reservations', label: 'Réservations', icon: CalendarRange },
  { tab: 'checkin', label: 'Check-in', icon: LogIn },
  { tab: 'housekeeping', label: 'Housekeeping', icon: Sparkles },
  { tab: 'maintenance', label: 'Maintenance', icon: Wrench },
  { tab: 'guests', label: 'Clients', icon: Users },
  { tab: 'companies', label: 'Entreprises', icon: Building2 },
  { tab: 'parameters', label: 'Paramètres', icon: Settings },
  { tab: 'hr', label: 'RH', icon: UserRound },
  { tab: 'stock', label: 'Stock', icon: Package },
  { tab: 'reporting', label: 'Reporting', icon: BarChart3 },
];
