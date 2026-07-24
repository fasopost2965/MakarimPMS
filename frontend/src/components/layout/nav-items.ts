import {
  BarChart3,
  Bell,
  Building2,
  CalendarRange,
  History,
  LayoutDashboard,
  LogIn,
  Package,
  ScanLine,
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
  // CH-011 — permission "module:action" (format GET /auth/me) requise pour
  // voir cet onglet, toujours la permission :read de la route principale
  // de l'écran correspondant (jamais une action d'écriture — un rôle en
  // lecture seule sur un module doit quand même voir l'onglet). `companies`
  // réutilise guests:read (Company reste une responsabilité du module
  // guests, CLAUDE.md) — pas de clé dédiée.
  permission: string;
}

// Ordre de la navigation principale — un seul point de vérité partagé entre
// la sidebar (icônes + libellés) et tout futur breadcrumb/titre de page.
export const NAV_ITEMS: NavItem[] = [
  {
    tab: 'dashboard',
    label: 'Tableau de bord',
    icon: LayoutDashboard,
    permission: 'dashboard:read',
  },
  {
    tab: 'reservations',
    label: 'Réservations',
    icon: CalendarRange,
    permission: 'reservations:read',
  },
  {
    tab: 'checkin',
    label: 'Check-in',
    icon: LogIn,
    // Route HTTP et clé de permission restées nommées "checkin" malgré le
    // renommage interne du module en "stay" (écart documenté, CLAUDE.md).
    permission: 'checkin:read',
  },
  {
    tab: 'housekeeping',
    label: 'Housekeeping',
    icon: Sparkles,
    permission: 'housekeeping:read',
  },
  {
    tab: 'maintenance',
    label: 'Maintenance',
    icon: Wrench,
    permission: 'maintenance:read',
  },
  { tab: 'guests', label: 'Clients', icon: Users, permission: 'guests:read' },
  {
    tab: 'companies',
    label: 'Entreprises',
    icon: Building2,
    permission: 'guests:read',
  },
  {
    tab: 'document-ocr',
    label: "Scan pièce d'identité",
    icon: ScanLine,
    // CH-022 — exception à la convention ":read" ci-dessus : ce module
    // n'a aucune route de lecture, sa seule route (POST /document-ocr/scan)
    // exige guests:write (préremplissage de fiche client, docs/modules/
    // document-ocr.md §7) — gater sur guests:read masquerait l'onglet à
    // exactement les rôles qui peuvent l'utiliser.
    permission: 'guests:write',
  },
  {
    tab: 'parameters',
    label: 'Paramètres',
    icon: Settings,
    permission: 'parameters:read',
  },
  { tab: 'hr', label: 'RH', icon: UserRound, permission: 'rh:read' },
  { tab: 'stock', label: 'Stock', icon: Package, permission: 'stock:read' },
  {
    tab: 'reporting',
    label: 'Reporting',
    icon: BarChart3,
    permission: 'reporting:read',
  },
  {
    tab: 'notifications',
    label: 'Notifications',
    icon: Bell,
    permission: 'notifications:read',
  },
  {
    tab: 'audit',
    label: 'Audit',
    icon: History,
    permission: 'audit:read',
  },
];
