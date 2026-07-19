export type CanalReservation = 'WALK_IN' | 'DIRECT' | 'BOOKING_COM';
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
}

export interface Room {
  id: number;
  numero: string;
  roomTypeId: number;
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
