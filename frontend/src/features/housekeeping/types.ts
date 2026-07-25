import type { StatutChambre } from '../reservations/types';

// CH-014 — un enregistrement RoomStatusLog (jamais lu par aucune route avant
// ce chantier).
export interface RoomStatusLogEntry {
  id: number;
  roomId: number;
  ancienStatut: StatutChambre;
  nouveauStatut: StatutChambre;
  motif: string | null;
  userId: number | null;
  createdAt: string;
}
