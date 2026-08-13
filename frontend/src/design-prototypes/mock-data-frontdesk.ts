// DESIGN-009 — Front Desk / Séjours / Check-in Desktop, prototype de
// convergence unique. Mock strictement conforme aux types réels du
// frontend :
// - Reservation/Room/Guest/RoomType (frontend/src/features/reservations/types.ts)
// - Stay/Folio/FolioLine (frontend/src/features/checkin/types.ts)
// - PoliceRecord (frontend/src/features/police/types.ts)
//
// Aucun champ inventé (pas de photo, surface, VIP/fidélité, solde non
// prouvé) — voir le rapport d'audit DESIGN-009 pour la preuve fichier:ligne
// de chaque champ repris ici.
import type {
  Guest,
  Reservation,
  Room,
  RoomType,
} from '../features/reservations/types';
import type { Folio, Stay } from '../features/checkin/types';

const ROOM_TYPE_DOUBLE: RoomType = {
  id: 1,
  nom: 'Double Standard',
  prixBase: '450.00',
  capacite: 2,
};
const ROOM_TYPE_SUITE: RoomType = {
  id: 2,
  nom: 'Suite Junior',
  prixBase: '750.00',
  capacite: 3,
};
const ROOM_TYPE_SIMPLE: RoomType = {
  id: 3,
  nom: 'Simple',
  prixBase: '320.00',
  capacite: 1,
};

export const MOCK_ROOMS: Room[] = [
  {
    id: 101,
    numero: '101',
    roomTypeId: 1,
    etage: 1,
    statut: 'OCCUPEE',
    roomType: ROOM_TYPE_DOUBLE,
  },
  {
    id: 102,
    numero: '102',
    roomTypeId: 3,
    etage: 1,
    statut: 'LIBRE_PROPRE',
    roomType: ROOM_TYPE_SIMPLE,
  },
  {
    id: 103,
    numero: '103',
    roomTypeId: 1,
    etage: 1,
    statut: 'DEPART_PREVU',
    roomType: ROOM_TYPE_DOUBLE,
  },
  {
    id: 104,
    numero: '104',
    roomTypeId: 1,
    etage: 1,
    statut: 'RESERVEE',
    roomType: ROOM_TYPE_DOUBLE,
  },
  {
    id: 201,
    numero: '201',
    roomTypeId: 2,
    etage: 2,
    statut: 'OCCUPEE',
    roomType: ROOM_TYPE_SUITE,
  },
  {
    id: 202,
    numero: '202',
    roomTypeId: 1,
    etage: 2,
    statut: 'LIBRE_PROPRE',
    roomType: ROOM_TYPE_DOUBLE,
  },
  {
    id: 203,
    numero: '203',
    roomTypeId: 3,
    etage: 2,
    statut: 'RESERVEE',
    roomType: ROOM_TYPE_SIMPLE,
  },
  {
    id: 204,
    numero: '204',
    roomTypeId: 1,
    etage: 2,
    statut: 'A_NETTOYER',
    roomType: ROOM_TYPE_DOUBLE,
  },
  {
    id: 301,
    numero: '301',
    roomTypeId: 2,
    etage: 3,
    statut: 'EN_MAINTENANCE',
    roomType: ROOM_TYPE_SUITE,
  },
];

function guest(
  id: number,
  nom: string,
  prenom: string,
  telephone: string | null = null,
  email: string | null = null,
): Guest {
  return { id, nom, prenom, pieceIdentite: null, telephone, email };
}

// ---------------------------------------------------------------------
// Arrivées du jour — Reservation[] CONFIRMEE, dateArrivee = aujourd'hui
// (contrat réel de GET /reservations/arrivees-du-jour, voir
// frontend/src/features/reservations/api.ts:18-20).
// ---------------------------------------------------------------------
const TODAY = new Date().toISOString().slice(0, 10);
const IN_2_DAYS_FOR_ARRIVALS = new Date(Date.now() + 2 * 86_400_000)
  .toISOString()
  .slice(0, 10);

export const MOCK_ARRIVALS: Reservation[] = [
  {
    id: 5001,
    canal: 'DIRECT',
    guestId: 9001,
    guest: guest(
      9001,
      'Bennani',
      'Yassine',
      '0661020304',
      'y.bennani@example.com',
    ),
    roomId: 104,
    room: MOCK_ROOMS.find((r) => r.id === 104)!,
    dateArrivee: `${TODAY}T14:00:00.000Z`,
    dateDepart: `${IN_2_DAYS_FOR_ARRIVALS}T00:00:00.000Z`,
    statut: 'CONFIRMEE',
    sourceBrute: null,
    formule: 'BED_AND_BREAKFAST',
    prixTotalCalcule: '1350.00',
    prixTotalFinal: '1350.00',
    ajustementManuel: false,
    motifAjustement: null,
    nombreOccupants: 2,
    createdAt: `${TODAY}T09:00:00.000Z`,
    updatedAt: `${TODAY}T09:00:00.000Z`,
  },
  {
    id: 5002,
    canal: 'BOOKING_COM',
    guestId: 9002,
    guest: guest(
      9002,
      'Martinez',
      'Elena',
      '0662030405',
      'elena.m@example.com',
    ),
    roomId: 203,
    room: MOCK_ROOMS.find((r) => r.id === 203)!,
    dateArrivee: `${TODAY}T15:00:00.000Z`,
    dateDepart: `${IN_2_DAYS_FOR_ARRIVALS}T00:00:00.000Z`,
    statut: 'CONFIRMEE',
    sourceBrute: null,
    formule: 'ROOM_ONLY',
    prixTotalCalcule: '640.00',
    prixTotalFinal: '640.00',
    ajustementManuel: false,
    motifAjustement: null,
    nombreOccupants: null,
    createdAt: `${TODAY}T08:00:00.000Z`,
    updatedAt: `${TODAY}T08:00:00.000Z`,
  },
];

// ---------------------------------------------------------------------
// Séjours en cours — Stay[] EN_COURS (contrat réel de GET
// /stays/en-cours, frontend/src/features/checkin/api.ts:33-35). folios
// avec lignes réelles (type/montant/annulee) pour permettre un calcul de
// solde honnête (même formule que computeSoldeDu, voir
// backend/src/modules/stay/utils/solde.ts) — jamais une valeur inventée.
// ---------------------------------------------------------------------
function folio(id: number, stayId: number, lignes: Folio['lignes']): Folio {
  return {
    id,
    stayId,
    libelle: 'Folio principal',
    lignes,
    createdAt: `${TODAY}T00:00:00.000Z`,
  };
}

const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const IN_3_DAYS = new Date(Date.now() + 3 * 86_400_000)
  .toISOString()
  .slice(0, 10);

export const MOCK_STAYS_EN_COURS: Stay[] = [
  {
    id: 7001,
    reservationId: null,
    reservation: null,
    roomId: 101,
    room: MOCK_ROOMS.find((r) => r.id === 101)!,
    guestId: 9003,
    guest: guest(9003, 'Idrissi', 'Karim', '0663040506'),
    dateCheckin: `${new Date(Date.now() - 86_400_000).toISOString()}`,
    dateCheckoutPrevue: `${IN_3_DAYS}T00:00:00.000Z`,
    dateCheckoutReelle: null,
    statut: 'EN_COURS',
    formule: 'HALF_BOARD',
    nombreOccupants: 2,
    folios: [
      folio(1, 7001, [
        {
          id: 1,
          folioId: 1,
          type: 'HEBERGEMENT',
          libelle: 'Hébergement',
          montant: '1800.00',
          annulee: false,
          motifAnnulation: null,
          createdAt: `${TODAY}T00:00:00.000Z`,
        },
        {
          id: 2,
          folioId: 1,
          type: 'TAXE_SEJOUR',
          libelle: 'Taxe de séjour',
          montant: '30.00',
          annulee: false,
          motifAnnulation: null,
          createdAt: `${TODAY}T00:00:00.000Z`,
        },
      ]),
    ],
    policeRecord: null,
    createdAt: `${TODAY}T00:00:00.000Z`,
    updatedAt: `${TODAY}T00:00:00.000Z`,
  },
  {
    id: 7002,
    reservationId: 4998,
    reservation: null,
    roomId: 201,
    room: MOCK_ROOMS.find((r) => r.id === 201)!,
    guestId: 9004,
    guest: guest(
      9004,
      'Fassi',
      'Amina',
      '0664050607',
      'amina.fassi@example.com',
    ),
    dateCheckin: `${new Date(Date.now() - 2 * 86_400_000).toISOString()}`,
    dateCheckoutPrevue: `${TOMORROW}T00:00:00.000Z`,
    dateCheckoutReelle: null,
    statut: 'EN_COURS',
    formule: 'FULL_BOARD',
    nombreOccupants: 3,
    folios: [
      folio(2, 7002, [
        {
          id: 3,
          folioId: 2,
          type: 'HEBERGEMENT',
          libelle: 'Hébergement',
          montant: '2250.00',
          annulee: false,
          motifAnnulation: null,
          createdAt: `${TODAY}T00:00:00.000Z`,
        },
        {
          id: 4,
          folioId: 2,
          type: 'TAXE_SEJOUR',
          libelle: 'Taxe de séjour',
          montant: '45.00',
          annulee: false,
          motifAnnulation: null,
          createdAt: `${TODAY}T00:00:00.000Z`,
        },
        {
          id: 5,
          folioId: 2,
          type: 'PAIEMENT',
          libelle: 'Acompte carte',
          montant: '1000.00',
          annulee: false,
          motifAnnulation: null,
          createdAt: `${TODAY}T00:00:00.000Z`,
        },
      ]),
    ],
    policeRecord: {
      id: 1,
      stayId: 7002,
      guestId: 9004,
      numeroPiece: 'AB123456',
      typePiece: 'CIN',
      nationalite: 'Marocaine',
      dateNaissance: '1990-01-01',
      paysProvenance: 'Maroc',
      villeProvenance: 'Casablanca',
      paysDestination: null,
      villeDestination: null,
      dateArrivee: `${TODAY}T00:00:00.000Z`,
      dateDepart: null,
      createdAt: `${TODAY}T00:00:00.000Z`,
      updatedAt: `${TODAY}T00:00:00.000Z`,
    },
    createdAt: `${TODAY}T00:00:00.000Z`,
    updatedAt: `${TODAY}T00:00:00.000Z`,
  },
];

// ---------------------------------------------------------------------
// Départs du jour — Stay[] EN_COURS, dateCheckoutPrevue = aujourd'hui
// (contrat réel de GET /stays/departs-du-jour, checkin/api.ts:37-39).
// ---------------------------------------------------------------------
export const MOCK_DEPARTS: Stay[] = [
  {
    id: 7003,
    reservationId: 4990,
    reservation: null,
    roomId: 103,
    room: MOCK_ROOMS.find((r) => r.id === 103)!,
    guestId: 9005,
    guest: guest(9005, 'Alaoui', 'Sara', '0665060708'),
    dateCheckin: `${new Date(Date.now() - 2 * 86_400_000).toISOString()}`,
    dateCheckoutPrevue: `${TODAY}T00:00:00.000Z`,
    dateCheckoutReelle: null,
    statut: 'EN_COURS',
    formule: 'ROOM_ONLY',
    nombreOccupants: 1,
    folios: [
      folio(3, 7003, [
        {
          id: 6,
          folioId: 3,
          type: 'HEBERGEMENT',
          libelle: 'Hébergement',
          montant: '900.00',
          annulee: false,
          motifAnnulation: null,
          createdAt: `${TODAY}T00:00:00.000Z`,
        },
        {
          id: 7,
          folioId: 3,
          type: 'TAXE_SEJOUR',
          libelle: 'Taxe de séjour',
          montant: '20.00',
          annulee: false,
          motifAnnulation: null,
          createdAt: `${TODAY}T00:00:00.000Z`,
        },
        {
          id: 8,
          folioId: 3,
          type: 'PAIEMENT',
          libelle: 'Paiement espèces',
          montant: '920.00',
          annulee: false,
          motifAnnulation: null,
          createdAt: `${TODAY}T00:00:00.000Z`,
        },
      ]),
    ],
    // Fiche police absente — reproduit le badge d'alerte réel déjà
    // affiché en production (CheckinPage.tsx:531-539).
    policeRecord: null,
    createdAt: `${TODAY}T00:00:00.000Z`,
    updatedAt: `${TODAY}T00:00:00.000Z`,
  },
];
