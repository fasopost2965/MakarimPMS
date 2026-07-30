// F11 (docs/modules/restaurant.md, RD-025) — module feuille sans table
// Prisma propre, la note restaurant s'écrit directement en FolioLine
// (TypeLigneFolio.RESTAURANT). Types calqués sur la projection stricte
// renvoyée par RestaurantController — jamais de solde/folio complet exposé
// au compte RESTAURATEUR (RestaurantService.findStaysInHouse).
export interface RestaurantStayInHouse {
  stayId: number;
  roomNumber: string;
  guestName: string;
  checkoutDate: string;
}

// Reflet de la FolioLine RESTAURANT créée par addCharge()/updateCharge().
export interface RestaurantCharge {
  id: number;
  folioId: number;
  libelle: string;
  montant: string;
  annulee: boolean;
  createdAt: string;
}

export interface CreateRestaurantChargeInput {
  stayId: number;
  libelle: string;
  montant: string;
  commentaire?: string;
}

// RD-F11-02 — jamais de mutation directe : le motif (≥ 10 caractères,
// exigé côté backend) justifie l'annulation soft + recréation.
export interface UpdateRestaurantChargeInput {
  libelle: string;
  montant: string;
  commentaire?: string;
  motif: string;
}

export interface RestaurantDailyReportRoom {
  roomNumber: string;
  stayId: number;
  charges: {
    id: number;
    libelle: string;
    montant: string;
    annulee: boolean;
    createdAt: string;
  }[];
}
