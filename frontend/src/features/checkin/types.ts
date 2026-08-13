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
  // DESIGN-006 — champ scalaire de Stay, toujours renvoyé par STAY_INCLUDE
  // (backend/src/modules/stay/stay.service.ts) mais jusqu'ici absent de ce
  // type frontend.
  formule: FormuleHebergement;
  // FIN-102 — occupation réelle du séjour, jamais déduite de
  // RoomType.capacite (backend/src/common/utils/occupancy.ts). Nullable
  // uniquement pour un séjour créé avant ce déploiement (legacy).
  nombreOccupants: number | null;
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

// GL-003 (MX-002A) — payload d'entrée de POST /stays/:id/extend
// (ExtendStayDto, backend/src/modules/stay/dto/extend-stay.dto.ts).
export interface ExtendStayInput {
  nouvelleDateCheckoutPrevue: string;
  motif: string;
}

// Formes des corps d'erreur structurés levés par StayService.extendStay
// (backend/src/modules/stay/stay.service.ts) — narrowing explicite de
// `ApiError.details` (voir lib/api-client.ts), jamais un type large exposé
// automatiquement par le client HTTP lui-même.
export interface RoomUnavailableErrorDetails {
  code: 'ROOM_UNAVAILABLE';
  message: string;
  alternatives: Room[];
}

export interface PaymentRequiredErrorDetails {
  code: 'PAYMENT_REQUIRED';
  message: string;
  amountRequired: string;
  availableCredit: string;
}

// GL-003B — réponse de POST /stays/:id/extension-deposit
// (StayService.createExtensionDeposit). `payment` reste `null` quand le
// crédit déjà disponible couvrait déjà le supplément visé (aucun
// encaissement créé) — voir montantAEncaisser ci-dessous côté backend.
export interface ExtensionDepositResult {
  payment: { id: number; montant: string } | null;
  montantEncaisse: string;
  message?: string;
}

// L'un des deux champs client est requis (module CRM 5.7) : guestId pour
// réutiliser un client existant (déclenche le contrôle blacklist côté
// serveur), guest pour en saisir un nouveau — voir GuestPicker.
export type WalkinCheckinInput = {
  roomId: number;
  dateCheckoutPrevue: string;
  formule?: FormuleHebergement;
  // FIN-102 — un walk-in n'a jamais de réservation préexistante à
  // consulter : ce champ est strictement obligatoire (WalkinDto backend),
  // jamais déduit de RoomType.capacite (common/utils/occupancy.ts).
  nombreOccupants: number;
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
