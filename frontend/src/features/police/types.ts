export type TypePiece = 'CIN' | 'PASSEPORT' | 'SEJOUR' | 'AUTRE';

export interface PoliceRecord {
  id: number;
  stayId: number;
  guestId: number;
  numeroPiece: string;
  typePiece: TypePiece;
  nationalite: string;
  dateNaissance: string;
  paysProvenance: string | null;
  villeProvenance: string | null;
  paysDestination: string | null;
  villeDestination: string | null;
  dateArrivee: string;
  dateDepart: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPoliceRecordInput {
  numeroPiece: string;
  typePiece: TypePiece;
  nationalite: string;
  dateNaissance: string;
  paysProvenance?: string;
  villeProvenance?: string;
  paysDestination?: string;
  villeDestination?: string;
}

// Sous-ensemble de SelfCheckinToken (F6) exposé par
// GET /reservations/:id/self-checkin-pending — champs "en attente" saisis
// par le client avant son arrivée, à valider/compléter par la réception.
export interface SelfCheckinPending {
  numeroPiece: string | null;
  typePiece: TypePiece | null;
  dateNaissance: string | null;
  paysProvenance: string | null;
  villeProvenance: string | null;
  paysDestination: string | null;
  villeDestination: string | null;
}
