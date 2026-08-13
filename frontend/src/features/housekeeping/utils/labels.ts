import type { StatutChambre } from '../../reservations/types';
import type { HousekeepingTask, StatutTacheHousekeeping } from '../types';

// Mêmes libellés/mappings couleur que l'ancien HousekeepingPage.tsx /
// HousekeepingTaskRow.tsx — DESIGN-008 (reconstruction desktop) factorise
// ici ce qui était dupliqué à l'identique dans plusieurs fichiers, sans
// changer une seule valeur (aucune couleur/label inventé·e).
export const ROOM_STATUT_LABEL: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'Libre & propre',
  RESERVEE: 'Réservée',
  OCCUPEE: 'Occupée',
  DEPART_PREVU: 'Départ prévu',
  A_NETTOYER: 'À nettoyer',
  EN_NETTOYAGE: 'En nettoyage',
  EN_MAINTENANCE: 'En maintenance',
};

export const ROOM_STATUT_BADGE_VARIANT: Record<
  StatutChambre,
  'success' | 'info' | 'destructive' | 'warning' | 'violet'
> = {
  LIBRE_PROPRE: 'success',
  RESERVEE: 'info',
  OCCUPEE: 'destructive',
  DEPART_PREVU: 'info',
  A_NETTOYER: 'warning',
  EN_NETTOYAGE: 'violet',
  EN_MAINTENANCE: 'destructive',
};

export const TASK_STATUT_LABEL: Record<StatutTacheHousekeeping, string> = {
  A_FAIRE: 'À faire',
  AFFECTEE: 'Affectée',
  EN_COURS: 'En cours',
  TERMINEE: 'À contrôler',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
};

export const TASK_STATUT_BADGE_VARIANT: Record<
  StatutTacheHousekeeping,
  'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'violet'
> = {
  A_FAIRE: 'warning',
  AFFECTEE: 'secondary',
  EN_COURS: 'violet',
  TERMINEE: 'default',
  VALIDEE: 'success',
  ANNULEE: 'destructive',
};

export const ORIGINE_LABEL: Record<HousekeepingTask['origine'], string> = {
  CHECKOUT: 'Check-out',
  MANUELLE: 'Manuelle',
  REPRISE: 'Reprise',
};

export function formatTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function floorLabel(etage: number | null | undefined) {
  return etage === null || etage === undefined
    ? 'Sans étage renseigné'
    : `Étage ${etage}`;
}
