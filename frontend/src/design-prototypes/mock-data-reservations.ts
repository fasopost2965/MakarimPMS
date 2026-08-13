// DESIGN-007 — données représentatives pour les prototypes Réservations,
// construites strictement à partir des types réels
// (frontend/src/features/reservations/types.ts) et des valeurs d'enum
// réellement supportées par le backend (schema.prisma / DTO). Aucun champ
// inventé, aucune valeur hors énumération réelle.
import type {
  Reservation,
  Room,
  RoomType,
} from '../features/reservations/types';

const single: RoomType = { id: 1, nom: 'Single', prixBase: '400', capacite: 1 };
const double: RoomType = { id: 2, nom: 'Double', prixBase: '600', capacite: 2 };
const suite: RoomType = { id: 3, nom: 'Suite', prixBase: '1200', capacite: 4 };

export const MOCK_ROOMS: Room[] = [
  {
    id: 1,
    numero: '101',
    roomTypeId: 1,
    etage: 1,
    statut: 'LIBRE_PROPRE',
    roomType: single,
  },
  {
    id: 2,
    numero: '102',
    roomTypeId: 1,
    etage: 1,
    statut: 'RESERVEE',
    roomType: single,
  },
  {
    id: 3,
    numero: '201',
    roomTypeId: 2,
    etage: 2,
    statut: 'OCCUPEE',
    roomType: double,
  },
  {
    id: 4,
    numero: '202',
    roomTypeId: 2,
    etage: 2,
    statut: 'DEPART_PREVU',
    roomType: double,
  },
  {
    id: 5,
    numero: '203',
    roomTypeId: 2,
    etage: 2,
    statut: 'LIBRE_PROPRE',
    roomType: double,
  },
  {
    id: 6,
    numero: '301',
    roomTypeId: 3,
    etage: 3,
    statut: 'A_NETTOYER',
    roomType: suite,
  },
  {
    id: 7,
    numero: '104',
    roomTypeId: 1,
    etage: 1,
    statut: 'EN_MAINTENANCE',
    roomType: single,
  },
  {
    id: 8,
    numero: '204',
    roomTypeId: 2,
    etage: 2,
    statut: 'LIBRE_PROPRE',
    roomType: double,
  },
];

function iso(daysFromToday: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

// Réservation la plus riche possible avec les champs RÉELLEMENT présents
// sur `Reservation` (types.ts) — sourceBrute, ajustementManuel etc. inclus
// pour rester fidèle au contrat, même si les prototypes ne les affichent
// pas tous.
function reservation(
  overrides: Partial<Reservation> & { id: number },
): Reservation {
  return {
    canal: 'DIRECT',
    guestId: overrides.id,
    guest: {
      id: overrides.id,
      nom: 'Amrani',
      prenom: 'Karim',
      pieceIdentite: null,
      telephone: '+212 6 00 00 00 00',
      email: 'client@example.test',
    },
    roomId: 1,
    room: MOCK_ROOMS[0],
    dateArrivee: iso(0),
    dateDepart: iso(1),
    statut: 'CONFIRMEE',
    sourceBrute: null,
    formule: 'BED_AND_BREAKFAST',
    prixTotalCalcule: '400.00',
    prixTotalFinal: '400.00',
    ajustementManuel: false,
    motifAjustement: null,
    nombreOccupants: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export const MOCK_RESERVATIONS: Reservation[] = [
  reservation({
    id: 1,
    guest: {
      id: 1,
      nom: 'Amrani',
      prenom: 'Karim',
      pieceIdentite: null,
      telephone: '+212 6 61 22 33 44',
      email: 'karim.amrani@example.test',
    },
    roomId: 2,
    room: MOCK_ROOMS[1],
    dateArrivee: iso(0),
    dateDepart: iso(3),
    canal: 'DIRECT',
    statut: 'CONFIRMEE',
    prixTotalCalcule: '1200.00',
    prixTotalFinal: '1200.00',
    nombreOccupants: 1,
  }),
  reservation({
    id: 2,
    guest: {
      id: 2,
      nom: 'Benjelloun',
      prenom: 'Salma',
      pieceIdentite: null,
      telephone: '+212 6 12 34 56 78',
      email: null,
    },
    roomId: 4,
    room: MOCK_ROOMS[3],
    dateArrivee: iso(0),
    dateDepart: iso(2),
    canal: 'BOOKING_COM',
    statut: 'CONFIRMEE',
    prixTotalCalcule: '1200.00',
    prixTotalFinal: '1100.00',
    ajustementManuel: true,
    motifAjustement: 'Geste commercial — retard de vol validé par la direction',
    nombreOccupants: 2,
  }),
  reservation({
    id: 3,
    guest: {
      id: 3,
      nom: 'Martin',
      prenom: 'Julien',
      pieceIdentite: null,
      telephone: '+33 6 11 22 33 44',
      email: 'julien.martin@example.test',
    },
    roomId: 6,
    room: MOCK_ROOMS[5],
    dateArrivee: iso(1),
    dateDepart: iso(4),
    canal: 'AIRBNB',
    statut: 'CONFIRMEE',
    prixTotalCalcule: '3600.00',
    prixTotalFinal: '3600.00',
    nombreOccupants: 3,
  }),
  reservation({
    id: 4,
    guest: {
      id: 4,
      nom: 'El Fassi',
      prenom: 'Nadia',
      pieceIdentite: null,
      telephone: '+212 6 55 66 77 88',
      email: null,
    },
    roomId: 5,
    room: MOCK_ROOMS[4],
    dateArrivee: iso(2),
    dateDepart: iso(5),
    canal: 'WALK_IN',
    statut: 'CONFIRMEE',
    prixTotalCalcule: '1800.00',
    prixTotalFinal: '1800.00',
    nombreOccupants: null,
  }),
  reservation({
    id: 5,
    guest: {
      id: 5,
      nom: 'Dupont',
      prenom: 'Claire',
      pieceIdentite: null,
      telephone: '+33 6 99 88 77 66',
      email: 'claire.dupont@example.test',
    },
    roomId: 8,
    room: MOCK_ROOMS[7],
    dateArrivee: iso(-1),
    dateDepart: iso(0),
    canal: 'EXPEDIA',
    statut: 'NO_SHOW',
    prixTotalCalcule: '600.00',
    prixTotalFinal: '600.00',
    nombreOccupants: 2,
  }),
  reservation({
    id: 6,
    guest: {
      id: 6,
      nom: 'Idrissi',
      prenom: 'Youssef',
      pieceIdentite: null,
      telephone: '+212 6 22 33 44 55',
      email: null,
    },
    roomId: 3,
    room: MOCK_ROOMS[2],
    dateArrivee: iso(-2),
    dateDepart: iso(3),
    canal: 'DIRECT',
    statut: 'TRANSFORMEE_EN_SEJOUR',
    prixTotalCalcule: '3000.00',
    prixTotalFinal: '3000.00',
    nombreOccupants: 2,
  }),
  reservation({
    id: 7,
    guest: {
      id: 7,
      nom: 'Zahra',
      prenom: 'Fatima',
      pieceIdentite: null,
      telephone: '+212 6 44 55 66 77',
      email: 'fatima.zahra@example.test',
    },
    roomId: 1,
    room: MOCK_ROOMS[0],
    dateArrivee: iso(-3),
    dateDepart: iso(-1),
    canal: 'DIRECT',
    statut: 'ANNULEE',
    prixTotalCalcule: '800.00',
    prixTotalFinal: '800.00',
    nombreOccupants: 1,
  }),
  reservation({
    id: 8,
    guest: {
      id: 8,
      nom: 'Ouazzani',
      prenom: 'Hind',
      pieceIdentite: null,
      telephone: '+212 6 77 88 99 00',
      email: null,
    },
    roomId: 2,
    room: MOCK_ROOMS[1],
    dateArrivee: iso(4),
    dateDepart: iso(6),
    canal: 'BOOKING_COM',
    statut: 'CONFIRMEE',
    prixTotalCalcule: '800.00',
    prixTotalFinal: '800.00',
    nombreOccupants: 1,
  }),
];
