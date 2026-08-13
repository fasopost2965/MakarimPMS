import type { Room, RoomType } from '../features/reservations/types';
import type {
  AssignableUser,
  HousekeepingTask,
} from '../features/housekeeping/types';
import type { MaintenanceTicket } from '../features/maintenance/types';

// DESIGN-008 — jeu de données mock pour le prototype Housekeeping desktop
// (audit UX + prototype, aucun appel réseau d'écriture). Champs strictement
// alignés sur les types réels (features/reservations/types.ts,
// features/housekeeping/types.ts, features/maintenance/types.ts) — aucune
// donnée inventée (pas de surface, pas de photo, pas de priorité de tâche
// housekeeping puisque HousekeepingTask n'a pas ce champ côté backend, voir
// rapport §14).

const ROOM_TYPE_STANDARD: RoomType = {
  id: 1,
  nom: 'Standard',
  prixBase: '450.00',
  capacite: 2,
};

const ROOM_TYPE_SUPERIEURE: RoomType = {
  id: 2,
  nom: 'Supérieure',
  prixBase: '650.00',
  capacite: 2,
};

const ROOM_TYPE_SUITE: RoomType = {
  id: 3,
  nom: 'Suite',
  prixBase: '950.00',
  capacite: 3,
};

// 24 chambres réelles de l'hôtel (CLAUDE.md — hôtel 3 étoiles, 24 chambres),
// réparties sur 4 étages.
export const MOCK_ROOMS: Room[] = [
  {
    id: 101,
    numero: '101',
    roomTypeId: 1,
    etage: 1,
    statut: 'A_NETTOYER',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 102,
    numero: '102',
    roomTypeId: 1,
    etage: 1,
    statut: 'A_NETTOYER',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 103,
    numero: '103',
    roomTypeId: 1,
    etage: 1,
    statut: 'EN_NETTOYAGE',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 104,
    numero: '104',
    roomTypeId: 2,
    etage: 1,
    statut: 'A_NETTOYER',
    roomType: ROOM_TYPE_SUPERIEURE,
  },
  {
    id: 105,
    numero: '105',
    roomTypeId: 1,
    etage: 1,
    statut: 'LIBRE_PROPRE',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 106,
    numero: '106',
    roomTypeId: 1,
    etage: 1,
    statut: 'OCCUPEE',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 201,
    numero: '201',
    roomTypeId: 2,
    etage: 2,
    statut: 'EN_MAINTENANCE',
    roomType: ROOM_TYPE_SUPERIEURE,
  },
  {
    id: 202,
    numero: '202',
    roomTypeId: 1,
    etage: 2,
    statut: 'A_NETTOYER',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 203,
    numero: '203',
    roomTypeId: 1,
    etage: 2,
    statut: 'RESERVEE',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 204,
    numero: '204',
    roomTypeId: 2,
    etage: 2,
    statut: 'LIBRE_PROPRE',
    roomType: ROOM_TYPE_SUPERIEURE,
  },
  {
    id: 205,
    numero: '205',
    roomTypeId: 1,
    etage: 2,
    statut: 'DEPART_PREVU',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 206,
    numero: '206',
    roomTypeId: 1,
    etage: 2,
    statut: 'OCCUPEE',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 301,
    numero: '301',
    roomTypeId: 1,
    etage: 3,
    statut: 'A_NETTOYER',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 302,
    numero: '302',
    roomTypeId: 1,
    etage: 3,
    statut: 'LIBRE_PROPRE',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 303,
    numero: '303',
    roomTypeId: 2,
    etage: 3,
    statut: 'EN_NETTOYAGE',
    roomType: ROOM_TYPE_SUPERIEURE,
  },
  {
    id: 304,
    numero: '304',
    roomTypeId: 1,
    etage: 3,
    statut: 'EN_MAINTENANCE',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 305,
    numero: '305',
    roomTypeId: 1,
    etage: 3,
    statut: 'LIBRE_PROPRE',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 306,
    numero: '306',
    roomTypeId: 1,
    etage: 3,
    statut: 'LIBRE_PROPRE',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 401,
    numero: '401',
    roomTypeId: 3,
    etage: 4,
    statut: 'A_NETTOYER',
    roomType: ROOM_TYPE_SUITE,
  },
  {
    id: 402,
    numero: '402',
    roomTypeId: 1,
    etage: 4,
    statut: 'LIBRE_PROPRE',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 403,
    numero: '403',
    roomTypeId: 1,
    etage: 4,
    statut: 'RESERVEE',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 404,
    numero: '404',
    roomTypeId: 2,
    etage: 4,
    statut: 'OCCUPEE',
    roomType: ROOM_TYPE_SUPERIEURE,
  },
  {
    id: 405,
    numero: '405',
    roomTypeId: 1,
    etage: 4,
    statut: 'LIBRE_PROPRE',
    roomType: ROOM_TYPE_STANDARD,
  },
  {
    id: 406,
    numero: '406',
    roomTypeId: 3,
    etage: 4,
    statut: 'DEPART_PREVU',
    roomType: ROOM_TYPE_SUITE,
  },
];

export const MOCK_AGENTS: AssignableUser[] = [
  { id: 11, nom: 'Amina Idrissi', actif: true },
  { id: 12, nom: 'Youssef Benali', actif: true },
  { id: 13, nom: 'Fatima Zahra', actif: true },
  { id: 14, nom: 'Karim Chraibi', actif: false },
];

function room(id: number) {
  const r = MOCK_ROOMS.find((x) => x.id === id)!;
  return {
    id: r.id,
    numero: r.numero,
    etage: r.etage ?? 0,
    statut: r.statut,
    roomTypeId: r.roomTypeId,
  };
}

function agent(id: number): HousekeepingTask['assignedUser'] {
  const a = MOCK_AGENTS.find((x) => x.id === id)!;
  return { id: a.id, nom: a.nom, actif: a.actif };
}

// Tâches actives (activeRoomKey non-null) — une seule par chambre, invariant
// réel (schema.prisma, @@unique activeRoomKey). Couvre les 6 statuts réels
// pour démontrer chaque état machine (B0.4).
export const MOCK_TASKS: HousekeepingTask[] = [
  {
    id: 9001,
    roomId: 301,
    assignedUserId: null,
    statut: 'A_FAIRE',
    origine: 'CHECKOUT',
    sourceEventKey: 'checkout:301:2026-08-13',
    activeRoomKey: '301',
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    validatedAt: null,
    cancelledAt: null,
    createdAt: '2026-08-13T08:05:00Z',
    updatedAt: '2026-08-13T08:05:00Z',
    room: room(301),
    assignedUser: null,
  },
  {
    id: 9002,
    roomId: 102,
    assignedUserId: 11,
    statut: 'AFFECTEE',
    origine: 'CHECKOUT',
    sourceEventKey: 'checkout:102:2026-08-13',
    activeRoomKey: '102',
    assignedAt: '2026-08-13T08:10:00Z',
    startedAt: null,
    completedAt: null,
    validatedAt: null,
    cancelledAt: null,
    createdAt: '2026-08-13T08:00:00Z',
    updatedAt: '2026-08-13T08:10:00Z',
    room: room(102),
    assignedUser: agent(11),
  },
  {
    id: 9003,
    roomId: 103,
    assignedUserId: 12,
    statut: 'EN_COURS',
    origine: 'CHECKOUT',
    sourceEventKey: 'checkout:103:2026-08-13',
    activeRoomKey: '103',
    assignedAt: '2026-08-13T07:50:00Z',
    startedAt: '2026-08-13T08:20:00Z',
    completedAt: null,
    validatedAt: null,
    cancelledAt: null,
    createdAt: '2026-08-13T07:45:00Z',
    updatedAt: '2026-08-13T08:20:00Z',
    room: room(103),
    assignedUser: agent(12),
  },
  {
    id: 9004,
    roomId: 303,
    assignedUserId: 11,
    statut: 'EN_COURS',
    // REPRISE — une chambre déjà validée mais reprise à la main (motif
    // gouvernante), scénario réel de HousekeepingTaskService.reopen().
    origine: 'REPRISE',
    sourceEventKey: null,
    activeRoomKey: '303',
    assignedAt: '2026-08-13T09:00:00Z',
    startedAt: '2026-08-13T09:05:00Z',
    completedAt: null,
    validatedAt: null,
    cancelledAt: null,
    createdAt: '2026-08-13T08:55:00Z',
    updatedAt: '2026-08-13T09:05:00Z',
    room: room(303),
    assignedUser: agent(11),
  },
  {
    id: 9005,
    roomId: 104,
    assignedUserId: 12,
    statut: 'TERMINEE',
    origine: 'CHECKOUT',
    sourceEventKey: 'checkout:104:2026-08-13',
    activeRoomKey: '104',
    assignedAt: '2026-08-13T07:00:00Z',
    startedAt: '2026-08-13T07:10:00Z',
    completedAt: '2026-08-13T08:35:00Z',
    validatedAt: null,
    cancelledAt: null,
    createdAt: '2026-08-13T06:55:00Z',
    updatedAt: '2026-08-13T08:35:00Z',
    room: room(104),
    assignedUser: agent(12),
  },
  {
    id: 9006,
    roomId: 202,
    assignedUserId: 13,
    statut: 'TERMINEE',
    origine: 'MANUELLE',
    sourceEventKey: null,
    activeRoomKey: '202',
    assignedAt: '2026-08-13T06:30:00Z',
    startedAt: '2026-08-13T06:40:00Z',
    completedAt: '2026-08-13T07:55:00Z',
    validatedAt: null,
    cancelledAt: null,
    createdAt: '2026-08-13T06:25:00Z',
    updatedAt: '2026-08-13T07:55:00Z',
    room: room(202),
    assignedUser: agent(13),
  },
  {
    id: 9007,
    roomId: 401,
    assignedUserId: 11,
    statut: 'AFFECTEE',
    origine: 'CHECKOUT',
    sourceEventKey: 'checkout:401:2026-08-13',
    activeRoomKey: '401',
    assignedAt: '2026-08-13T08:40:00Z',
    startedAt: null,
    completedAt: null,
    validatedAt: null,
    cancelledAt: null,
    createdAt: '2026-08-13T08:30:00Z',
    updatedAt: '2026-08-13T08:40:00Z',
    room: room(401),
    assignedUser: agent(11),
  },
];

// Tâches clôturées (activeRoomKey redevenu null) — non renvoyées par le
// filtre `active=true` utilisé aujourd'hui en production, mais listables via
// GET /housekeeping/tasks sans ce filtre (HousekeepingTaskQueryDto n'exige
// pas `active`). Utile pour démontrer la vue Historique/Tâches clôturées du
// prototype (mission §7/§11).
export const MOCK_TASKS_CLOSED: HousekeepingTask[] = [
  {
    id: 8990,
    roomId: 306,
    assignedUserId: 12,
    statut: 'VALIDEE',
    origine: 'CHECKOUT',
    sourceEventKey: 'checkout:306:2026-08-12',
    activeRoomKey: null,
    assignedAt: '2026-08-12T09:00:00Z',
    startedAt: '2026-08-12T09:10:00Z',
    completedAt: '2026-08-12T10:00:00Z',
    validatedAt: '2026-08-12T10:20:00Z',
    cancelledAt: null,
    createdAt: '2026-08-12T08:55:00Z',
    updatedAt: '2026-08-12T10:20:00Z',
    room: room(306),
    assignedUser: agent(12),
  },
  {
    id: 8991,
    roomId: 405,
    assignedUserId: null,
    statut: 'ANNULEE',
    origine: 'MANUELLE',
    sourceEventKey: null,
    activeRoomKey: null,
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    validatedAt: null,
    cancelledAt: '2026-08-12T11:00:00Z',
    createdAt: '2026-08-12T10:50:00Z',
    updatedAt: '2026-08-12T11:00:00Z',
    room: room(405),
    assignedUser: null,
  },
];

export const MOCK_ALL_TASKS: HousekeepingTask[] = [
  ...MOCK_TASKS,
  ...MOCK_TASKS_CLOSED,
];

// Tickets de maintenance bloquants liés à des chambres EN_MAINTENANCE —
// alignés sur MaintenanceSummary.tsx (room-context), jamais de champ inventé
// (pas de surface, pas de photo par défaut).
export const MOCK_MAINTENANCE_TICKETS: MaintenanceTicket[] = [
  {
    id: 701,
    roomId: 201,
    room: MOCK_ROOMS.find((r) => r.id === 201)!,
    typePanne: 'Fuite robinetterie salle de bain',
    priorite: 'URGENTE',
    bloqueVente: true,
    assigneA: 'Prestataire plomberie externe',
    photoUrl: null,
    resoluAt: null,
    createdAt: '2026-08-13T06:00:00Z',
  },
  {
    id: 702,
    roomId: 304,
    room: MOCK_ROOMS.find((r) => r.id === 304)!,
    typePanne: 'Climatisation en panne',
    priorite: 'HAUTE',
    bloqueVente: true,
    assigneA: 'Karim Chraibi',
    photoUrl: null,
    resoluAt: null,
    createdAt: '2026-08-12T16:30:00Z',
  },
];
