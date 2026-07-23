import type { Room, RoomType } from '../reservations/types';
import type { Invoice } from '../billing/types';

export type CategorieClient =
  'STANDARD' | 'VIP' | 'ENTREPRISE' | 'AGENCE' | 'BLACKLIST';

export interface Guest {
  id: number;
  nom: string;
  prenom: string;
  pieceIdentite: string | null;
  nationalite: string | null;
  telephone: string | null;
  email: string | null;
  categorie: CategorieClient;
  preferences: string | null;
  createdAt: string;
}

export interface CreateGuestInput {
  nom: string;
  prenom: string;
  pieceIdentite?: string;
  nationalite?: string;
  telephone?: string;
  email?: string;
  preferences?: string;
}

export type UpdateGuestInput = Partial<CreateGuestInput>;

export interface UpdateGuestCategorieInput {
  categorie: CategorieClient;
  motif: string;
}

export interface GuestStayHistorique {
  id: number;
  roomId: number;
  room: Room & { roomType: RoomType };
  dateCheckin: string;
  dateCheckoutPrevue: string;
  dateCheckoutReelle: string | null;
  statut: 'EN_COURS' | 'CHECKOUT';
}

export type GuestInvoice = Invoice;
