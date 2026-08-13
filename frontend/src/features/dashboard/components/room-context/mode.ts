import type { StatutChambre } from '../../../reservations/types';

// DESIGN-006 — dérive le panneau contextuel à afficher à partir du seul
// statut réel de la chambre (fonction pure, aucun état, aucun effet de
// bord). RESERVEE/DEPART_PREVU/OCCUPEE partagent une source de vérité
// unique par groupe (voir chaque panneau), jamais recalculée ici.
export type RoomContextMode =
  'LIBRE_PROPRE' | 'RESERVEE' | 'SEJOUR' | 'HOUSEKEEPING' | 'MAINTENANCE';

export function deriveRoomContextMode(statut: StatutChambre): RoomContextMode {
  switch (statut) {
    case 'LIBRE_PROPRE':
      return 'LIBRE_PROPRE';
    case 'RESERVEE':
      return 'RESERVEE';
    case 'OCCUPEE':
    case 'DEPART_PREVU':
      return 'SEJOUR';
    case 'A_NETTOYER':
    case 'EN_NETTOYAGE':
      return 'HOUSEKEEPING';
    case 'EN_MAINTENANCE':
      return 'MAINTENANCE';
  }
}

export const STATUT_CHAMBRE_LABEL: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'Libre / propre',
  RESERVEE: 'Réservée',
  OCCUPEE: 'Occupée',
  DEPART_PREVU: 'Départ prévu',
  A_NETTOYER: 'À nettoyer',
  EN_NETTOYAGE: 'En nettoyage',
  EN_MAINTENANCE: 'En maintenance',
};
