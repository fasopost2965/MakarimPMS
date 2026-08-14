export type MoyenPaiement = 'ESPECES' | 'CARTE' | 'VIREMENT' | 'ACOMPTE';

export interface Payment {
  id: number;
  folioId: number;
  invoiceId: number | null;
  moyen: MoyenPaiement;
  montant: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface CreatePaymentInput {
  folioId: number;
  invoiceId?: number;
  moyen: MoyenPaiement;
  montant: string;
  idempotencyKey: string;
}

// DESIGN-010 (Billing Center) — GET /payments, registre global. Jamais de
// champ "encaissé par" (Payment n'a pas de userId fiable, mission §4/§13).
export interface PaymentListItem {
  id: number;
  moyen: MoyenPaiement;
  montant: string;
  createdAt: string;
  folioId: number;
  invoiceId: number | null;
  invoice: { id: number; numero: string } | null;
  folio: {
    stay: {
      id: number;
      guest: { id: number; nom: string; prenom: string };
      room: { id: number; numero: string };
    };
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
