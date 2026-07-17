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
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationInput {
  roomId: number;
  dateArrivee: string;
  dateDepart: string;
  canal?: CanalReservation;
  guest: {
    nom: string;
    prenom: string;
    telephone?: string;
    email?: string;
  };
}

export interface UpdateReservationInput {
  roomId?: number;
  dateArrivee?: string;
  dateDepart?: string;
  canal?: CanalReservation;
  statut?: StatutReservation;
}
