import {
  BarChart3,
  Bell,
  Building2,
  CalendarRange,
  History,
  KeyRound,
  LayoutDashboard,
  Package,
  ScanLine,
  Settings,
  ShoppingCart,
  Sparkles,
  UserRound,
  Users,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Tab } from '@/App';

// Catégorisation de la navigation (inspirée de la structure validée dans
// makarimpms_v2, adaptée aux 14 onglets réels de ce dépôt — `billing` et
// `police` n'ont pas d'onglet dédié ici, restés embarqués dans
// checkin/folio, CLAUDE.md). Répond à la demande explicite du client
// (`/goal` du 2026-07-30) de « réorganiser les menus des modules » et de
// sortir Audit de la fin d'une liste plate — il rejoint désormais
// Administration aux côtés de Paramètres/Notifications, même regroupement
// que dans makarimpms_v2.
export type NavCategoryKey =
  'pilotage' | 'exploitation' | 'relations' | 'ressources' | 'stats' | 'admin';

export interface NavCategory {
  key: NavCategoryKey;
  label: string;
}

export const NAV_CATEGORIES: NavCategory[] = [
  { key: 'pilotage', label: 'Pilotage' },
  { key: 'exploitation', label: 'Exploitation hôtel' },
  { key: 'relations', label: 'Clients & partenaires' },
  { key: 'ressources', label: 'Ressources & stocks' },
  { key: 'stats', label: 'Statistiques & rapports' },
  { key: 'admin', label: 'Administration' },
];

export interface NavItem {
  tab: Tab;
  label: string;
  icon: LucideIcon;
  category: NavCategoryKey;
  // CH-011 — permission "module:action" (format GET /auth/me) requise pour
  // voir cet onglet, toujours la permission :read de la route principale
  // de l'écran correspondant (jamais une action d'écriture — un rôle en
  // lecture seule sur un module doit quand même voir l'onglet). `companies`
  // réutilise guests:read (Company reste une responsabilité du module
  // guests, CLAUDE.md) — pas de clé dédiée.
  permission: string;
}

// Ordre de la navigation principale — un seul point de vérité partagé entre
// la sidebar (icônes + libellés + catégories) et tout futur breadcrumb/titre
// de page.
export const NAV_ITEMS: NavItem[] = [
  {
    tab: 'dashboard',
    label: 'Tableau de bord',
    icon: LayoutDashboard,
    category: 'pilotage',
    permission: 'dashboard:read',
  },
  {
    tab: 'reservations',
    label: 'Réservations',
    icon: CalendarRange,
    category: 'exploitation',
    permission: 'reservations:read',
  },
  {
    tab: 'checkin',
    label: 'Check-in & séjours',
    icon: KeyRound,
    // Route HTTP et clé de permission restées nommées "checkin" malgré le
    // renommage interne du module en "stay" (écart documenté, CLAUDE.md).
    category: 'exploitation',
    permission: 'checkin:read',
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
    category: 'exploitation',
    permission: 'guests:write',
  },
  {
    tab: 'housekeeping',
    label: 'Housekeeping',
    icon: Sparkles,
    category: 'exploitation',
    permission: 'housekeeping:read',
  },
  {
    tab: 'maintenance',
    label: 'Maintenance',
    icon: Wrench,
    category: 'exploitation',
    permission: 'maintenance:read',
  },
  {
    tab: 'restaurant',
    label: 'Restaurant',
    icon: UtensilsCrossed,
    // F11 (docs/modules/restaurant.md, RD-025) — comme document-ocr
    // ci-dessus, ce module n'a qu'une seule permission (restaurant:write,
    // toutes les routes de RestaurantController l'exigent) : pas de
    // restaurant:read distinct à gater dessus.
    category: 'exploitation',
    permission: 'restaurant:write',
  },
  {
    tab: 'guests',
    label: 'Clients',
    icon: Users,
    category: 'relations',
    permission: 'guests:read',
  },
  {
    tab: 'companies',
    label: 'Entreprises',
    icon: Building2,
    category: 'relations',
    permission: 'guests:read',
  },
  {
    tab: 'hr',
    label: 'RH',
    icon: UserRound,
    category: 'ressources',
    permission: 'rh:read',
  },
  {
    tab: 'stock',
    label: 'Stock',
    icon: Package,
    category: 'ressources',
    permission: 'stock:read',
  },
  {
    tab: 'purchase-orders',
    label: 'Bons de commande',
    icon: ShoppingCart,
    category: 'ressources',
    permission: 'purchase-orders:read',
  },
  {
    tab: 'reporting',
    label: 'Reporting',
    icon: BarChart3,
    category: 'stats',
    permission: 'reporting:read',
  },
  {
    tab: 'notifications',
    label: 'Notifications',
    icon: Bell,
    category: 'admin',
    permission: 'notifications:read',
  },
  {
    tab: 'audit',
    label: 'Audit',
    icon: History,
    category: 'admin',
    permission: 'audit:read',
  },
  {
    tab: 'parameters',
    label: 'Paramètres',
    icon: Settings,
    category: 'admin',
    permission: 'parameters:read',
  },
];
