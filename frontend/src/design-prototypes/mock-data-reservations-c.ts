// DESIGN-007 / Prototype C — jeu de données dédié à C, séparé de
// mock-data-reservations.ts (partagé par A/B) pour ne rien changer au rendu
// de A/B (mission §18 : « Les prototypes A/B doivent rester intacts »).
// Réutilise MOCK_ROOMS tel quel (aucune différence visuelle) et étend
// MOCK_RESERVATIONS avec un seul scénario supplémentaire — une réservation
// confirmée dont la date d'arrivée est dépassée sans check-in — pour pouvoir
// démontrer l'indicateur « À traiter » et l'emplacement de l'action
// no-show (mission §3/§10), absent du jeu de données A/B (qui n'avait aucun
// cas de ce type). Strictement typé contre les types réels
// (reservations/types.ts), aucun champ inventé.
import type { Reservation } from '../features/reservations/types';
import { MOCK_RESERVATIONS, MOCK_ROOMS } from './mock-data-reservations';

export { MOCK_ROOMS };

function iso(daysFromToday: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

const overdueArrival: Reservation = {
  id: 9,
  canal: 'DIRECT',
  guestId: 9,
  guest: {
    id: 9,
    nom: 'Chraibi',
    prenom: 'Omar',
    pieceIdentite: null,
    telephone: '+212 6 33 22 11 00',
    email: null,
  },
  roomId: 5,
  room: MOCK_ROOMS[4],
  dateArrivee: iso(-1),
  dateDepart: iso(2),
  statut: 'CONFIRMEE',
  sourceBrute: null,
  prixTotalCalcule: '1200.00',
  prixTotalFinal: '1200.00',
  ajustementManuel: false,
  motifAjustement: null,
  nombreOccupants: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_RESERVATIONS_C: Reservation[] = [
  ...MOCK_RESERVATIONS,
  overdueArrival,
];
