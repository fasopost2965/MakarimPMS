import type { Guest, Reservation, Room } from "../reservations/types";

export type StatutSejour = "EN_COURS" | "CHECKOUT" | "ANNULE";
export type TypeLigneFolio =
  "HEBERGEMENT" | "EXTRA" | "TAXE_SEJOUR" | "PAIEMENT";

export interface FolioLine {
  id: number;
  folioId: number;
  type: TypeLigneFolio;
  libelle: string;
  montant: string;
  annulee: boolean;
  motifAnnulation: string | null;
  createdAt: string;
}

export interface Folio {
  id: number;
  stayId: number;
  libelle: string;
  lignes: FolioLine[];
  createdAt: string;
}

export interface Stay {
  id: number;
  reservationId: number | null;
  reservation: Reservation | null;
  roomId: number;
  room: Room;
  guestId: number;
  guest: Guest;
  dateCheckin: string;
  dateCheckoutPrevue: string;
  dateCheckoutReelle: string | null;
  statut: StatutSejour;
  folios: Folio[];
  createdAt: string;
  updatedAt: string;
}

export interface StayWithSolde extends Stay {
  soldeDu: string;
}

// L'un des deux champs client est requis (module CRM 5.7) : guestId pour
// réutiliser un client existant (déclenche le contrôle blacklist côté
// serveur), guest pour en saisir un nouveau — voir GuestPicker.
export type WalkinCheckinInput = {
  roomId: number;
  dateCheckoutPrevue: string;
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
