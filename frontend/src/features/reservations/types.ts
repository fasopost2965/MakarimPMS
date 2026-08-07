// F10 (channel-manager) a étendu l'enum Prisma avec EXPEDIA/AIRBNB — ce
// type était resté à l'ancien sous-ensemble (BOOKING_COM seul), alors que
// `POST /reservations` (staff) accepte déjà n'importe quelle valeur de
// l'enum backend en `canal`. Corrigé ici (Lot #7) pour rester synchrone.
export type CanalReservation =
  'WALK_IN' | 'DIRECT' | 'BOOKING_COM' | 'EXPEDIA' | 'AIRBNB';
// CH-061 (Lot #3 design) — jusqu'ici saisie uniquement via Paramètres
// (grille tarifaire des types de chambre), jamais exposée dans les
// formulaires de création (réservation, walk-in) malgré son support
// backend complet (CreateReservationDto.formule/WalkinCheckinDto.formule).
export type FormuleHebergement =
  'ROOM_ONLY' | 'BED_AND_BREAKFAST' | 'HALF_BOARD' | 'FULL_BOARD';
export type StatutReservation =
  'CONFIRMEE' | 'ANNULEE' | 'NO_SHOW' | 'TRANSFORMEE_EN_SEJOUR';
export type StatutChambre =
  | 'LIBRE_PROPRE'
  | 'RESERVEE'
  | 'OCCUPEE'
  | 'DEPART_PREVU'
  | 'A_NETTOYER'
  | 'EN_NETTOYAGE'
  | 'EN_MAINTENANCE';

export interface RoomType {
  id: number;
  nom: string;
  prixBase: string;
  capacite: number;
  // CH-038 — champs de formule d'hébergement (Priorité 3), optionnels côté
  // type pour ne pas casser les usages existants qui ne les lisent jamais
  // (WalkinCheckinDialog, ParametersPage saisons…) mais réellement présents
  // dans toute réponse backend (CreateRoomTypeDto/UpdateRoomTypeDto).
  prixPetitDejeuner?: string;
  prixDemiPension?: string;
  prixPensionComplete?: string;
}

export interface Room {
  id: number;
  numero: string;
  roomTypeId: number;
  // CH-038 (RD-024) — étage physique, nullable (chambres seedées avant
  // l'introduction du champ).
  etage?: number | null;
  statut: StatutChambre;
  roomType: RoomType;
}

export interface Guest {
  id: number;
  nom: string;
  prenom: string;
  pieceIdentite: string | null;
  telephone: string | null;
  email: string | null;
}

export interface Reservation {
  id: number;
  canal: CanalReservation;
  guestId: number;
  guest: Guest;
  roomId: number;
  room: Room;
  dateArrivee: string;
  dateDepart: string;
  statut: StatutReservation;
  sourceBrute: string | null;
  // Tarification saisonnière (cahier des charges §5.1/§5.4). Décimaux
  // Prisma sérialisés en string par l'API.
  prixTotalCalcule: string;
  prixTotalFinal: string;
  ajustementManuel: boolean;
  motifAjustement: string | null;
  // FIN-102 (composition du tarif public TTC) — occupation réelle, jamais
  // déduite de RoomType.capacite (backend/src/common/utils/occupancy.ts).
  // Nullable : optionnelle à la réservation (réservée aux réservations
  // créées avant ce déploiement, ou dont le canal ne la demande pas encore),
  // le check-in la redemande explicitement si absente ici (voir
  // ReservationCheckinDialog).
  nombreOccupants: number | null;
  createdAt: string;
  updatedAt: string;
}

// L'un des deux champs client est requis (module CRM 5.7) : guestId pour
// réutiliser un client existant (déclenche le contrôle blacklist côté
// serveur), guest pour en saisir un nouveau — voir GuestPicker.
export type CreateReservationInput = {
  roomId: number;
  dateArrivee: string;
  dateDepart: string;
  canal?: CanalReservation;
  formule?: FormuleHebergement;
  // FIN-102 — optionnelle ici (CreateReservationDto.nombreOccupants),
  // reprise telle quelle par le check-in si déjà connue ; jamais déduite de
  // RoomType.capacite si absente.
  nombreOccupants?: number;
} & (
  | { guestId: number; guest?: undefined }
  | {
      guestId?: undefined;
      guest: {
        nom: string;
        prenom: string;
        telephone?: string;
        email?: string;
      };
    }
);

export interface UpdateReservationInput {
  roomId?: number;
  dateArrivee?: string;
  dateDepart?: string;
  canal?: CanalReservation;
  statut?: StatutReservation;
  prixTotalFinal?: number;
  motifAjustement?: string;
}

// CH-007 (F6, self-checkin) — réponse de POST /reservations/:id/self-checkin-link.
export interface SelfCheckinLink {
  token: string;
  url: string;
  expiresAt: string;
}

// Sous-ensemble de SelfCheckinToken exposé par
// GET /reservations/:id/self-checkin-pending — null tant que le client n'a
// rien soumis (qu'un lien ait été généré ou non, cette route ne permet pas
// de distinguer les deux cas).
export interface SelfCheckinPending {
  numeroPiece: string | null;
  typePiece: 'CIN' | 'PASSEPORT' | 'SEJOUR' | 'AUTRE' | null;
  dateNaissance: string | null;
  paysProvenance: string | null;
  villeProvenance: string | null;
  paysDestination: string | null;
  villeDestination: string | null;
}
