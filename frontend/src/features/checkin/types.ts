import type {
  FormuleHebergement,
  Guest,
  Reservation,
  Room,
} from '../reservations/types';
import type { PoliceRecord } from '../police/types';

export type StatutSejour = 'EN_COURS' | 'CHECKOUT';
export type TypeLigneFolio =
  'HEBERGEMENT' | 'EXTRA' | 'TAXE_SEJOUR' | 'PAIEMENT';

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
  // CH-003 — obligation légale DGSN, toujours inclus par le backend
  // (STAY_INCLUDE), jamais un appel séparé nécessaire pour savoir si la
  // fiche existe.
  policeRecord: PoliceRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface StayWithSolde extends Stay {
  soldeDu: string;
}

export type CategorieClient =
  'STANDARD' | 'VIP' | 'ENTREPRISE' | 'AGENCE' | 'BLACKLIST';

export interface CheckinGuestSummary {
  id: number;
  nom: string;
  prenom: string;
  pieceIdentite: string | null;
  nationalite: string | null;
  telephone: string | null;
  email: string | null;
  categorie: CategorieClient;
  preferences: string | null;
}

export interface RoomAvailability {
  disponible: boolean;
  datesConflit: string[];
  motifIndisponibilite?: string;
}

export type StatutAcompte = 'EN_ATTENTE' | 'ENCAISSE' | 'IMPUTE' | 'REMBOURSE';

export interface ReservationDeposit {
  id: number;
  reservationId: number;
  montant: string;
  moyen: 'ESPECES' | 'CARTE' | 'VIREMENT' | 'ACOMPTE';
  statut: StatutAcompte;
  createdAt: string;
}

// L'un des deux champs client est requis (module CRM 5.7) : guestId pour
// réutiliser un client existant (déclenche le contrôle blacklist côté
// serveur), guest pour en saisir un nouveau — voir GuestPicker.
export type WalkinCheckinInput = {
  roomId: number;
  dateCheckoutPrevue: string;
  formule?: FormuleHebergement;
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
