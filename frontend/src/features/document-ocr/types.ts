// CH-022 (docs/governance/REGISTRE_CHANTIERS.md) — le backend (F5,
// POST /document-ocr/scan) existait déjà et était pleinement fonctionnel ;
// seule cette interface manquait. Purement consultatif — aucune écriture,
// la réception relit et enregistre manuellement via GuestsPage/le formulaire
// de fiche de police existants (docs/modules/document-ocr.md §3).

// Sous-ensemble de TypePiece pertinent pour ce scan (seuls CIN/PASSEPORT
// portent une zone MRZ) — délibérément distinct de features/police/types.ts
// (qui inclut aussi SEJOUR/AUTRE, non valides pour ce endpoint).
export type TypeDocumentScan = 'CIN' | 'PASSEPORT';

export type MrzFormat = 'TD3_PASSEPORT' | 'TD1_CIN';

export interface DocumentOcrResult {
  formatDetecte: MrzFormat | null;
  numeroPiece: string | null;
  nom: string | null;
  prenom: string | null;
  nationalite: string | null;
  dateNaissance: string | null;
  sexe: 'M' | 'F' | null;
  dateExpiration: string | null;
  checksumValide: boolean;
  lignesMrz: string[];
  avertissement?: string;
  texteBrutOcr: string;
}
