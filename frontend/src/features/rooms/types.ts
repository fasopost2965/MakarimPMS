// Entités Room/RoomType déjà canoniquement déclarées dans
// reservations/types.ts (réutilisées par ParametersPage.tsx pour les
// tarifs saisonniers) — pas redéclarées ici pour éviter toute divergence,
// même convention que le reste du frontend.
export type { Room, RoomType } from '../reservations/types';

export interface CreateRoomInput {
  numero: string;
  roomTypeId: number;
  etage?: number;
  motif: string;
}

export interface UpdateRoomInput {
  numero?: string;
  roomTypeId?: number;
  etage?: number;
  motif: string;
}

export interface CreateRoomTypeInput {
  nom: string;
  prixBase: string;
  capacite: number;
  prixPetitDejeuner?: string;
  prixDemiPension?: string;
  prixPensionComplete?: string;
  motif: string;
}

export interface UpdateRoomTypeInput {
  nom?: string;
  prixBase?: string;
  capacite?: number;
  prixPetitDejeuner?: string;
  prixDemiPension?: string;
  prixPensionComplete?: string;
  motif: string;
}
