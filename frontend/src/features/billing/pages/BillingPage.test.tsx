import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api', () => ({
  listInvoices: vi.fn(),
  listStaysFacturables: vi.fn(),
  getBillingKpis: vi.fn(),
  generateInvoice: vi.fn(),
  createCreditNote: vi.fn(),
  getInvoice: vi.fn(),
  downloadInvoicePdf: vi.fn(),
  requestInvoiceDelivery: vi.fn(),
}));
vi.mock('@/features/payments/api', () => ({
  listPayments: vi.fn(),
}));

import {
  createCreditNote,
  generateInvoice,
  getBillingKpis,
  getInvoice,
  listInvoices,
  listStaysFacturables,
} from '../api';
import { listPayments } from '@/features/payments/api';
import { BillingPage } from './BillingPage';
import type { InvoiceDetail, InvoiceListItem, StayFacturable } from '../types';
import type { PaymentListItem } from '@/features/payments/types';

const KPIS = {
  facturesAujourdhui: 2,
  caFacture: '1500.00',
  aFacturer: 1,
  aEncaisser: '300.00',
};

const INVOICE: InvoiceListItem = {
  id: 1,
  numero: 'FAC-202608-000001',
  montantTotal: '650.00',
  statut: 'EMISE',
  createdAt: '2026-08-14T10:00:00.000Z',
  folio: {
    id: 10,
    stay: {
      id: 20,
      guest: { id: 1, nom: 'Sow', prenom: 'Amadou' },
      room: { id: 5, numero: '203' },
    },
  },
};

const STAY_FACTURABLE: StayFacturable = {
  id: 30,
  dateCheckin: '2026-08-10T00:00:00.000Z',
  dateCheckoutPrevue: '2026-08-13T00:00:00.000Z',
  dateCheckoutReelle: '2026-08-13T09:00:00.000Z',
  guest: { id: 2, nom: 'Idrissi', prenom: 'Fatima' },
  room: { id: 6, numero: '105' },
  folios: [{ id: 11 }],
  totalFacturable: '900.00',
};

const PAYMENT: PaymentListItem = {
  id: 1,
  moyen: 'CARTE',
  montant: '200.00',
  createdAt: '2026-08-14T09:00:00.000Z',
  folioId: 10,
  invoiceId: 1,
  invoice: { id: 1, numero: 'FAC-202608-000001' },
  folio: {
    stay: {
      id: 20,
      guest: { id: 1, nom: 'Sow', prenom: 'Amadou' },
      room: { id: 5, numero: '203' },
    },
  },
};

const INVOICE_DETAIL: InvoiceDetail = {
  id: 1,
  numero: 'FAC-202608-000001',
  montantTotal: '650.00',
  statut: 'EMISE',
  createdAt: '2026-08-14T10:00:00.000Z',
  creditNotes: [],
  payments: [],
  folio: {
    id: 10,
    stayId: 20,
    libelle: 'Folio principal',
    createdAt: '2026-08-10T00:00:00.000Z',
    invoices: [],
    lignes: [
      {
        id: 1,
        type: 'HEBERGEMENT',
        libelle: 'Hébergement — 3 nuits',
        montant: '650.00',
        tauxTva: '0',
        annulee: false,
        createdAt: '2026-08-10T00:00:00.000Z',
      },
    ],
    stay: {
      id: 20,
      dateCheckin: '2026-08-10T00:00:00.000Z',
      dateCheckoutPrevue: '2026-08-13T00:00:00.000Z',
      dateCheckoutReelle: '2026-08-13T09:00:00.000Z',
      guest: { id: 1, nom: 'Sow', prenom: 'Amadou', email: 'a@example.com' },
      room: { id: 5, numero: '203', roomType: { nom: 'Double Standard' } },
    },
  },
};

function setupMocks() {
  vi.mocked(getBillingKpis).mockResolvedValue(KPIS);
  vi.mocked(listInvoices).mockResolvedValue({
    data: [INVOICE],
    meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
  });
  vi.mocked(listStaysFacturables).mockResolvedValue({
    data: [STAY_FACTURABLE],
    meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
  });
  vi.mocked(listPayments).mockResolvedValue({
    data: [PAYMENT],
    meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
  });
  vi.mocked(getInvoice).mockResolvedValue(INVOICE_DETAIL);
}

// DESIGN-010 (Billing Center) — module de production complet, mission §24.
// Aucun mock réseau réel : listInvoices/listStaysFacturables/listPayments/
// getBillingKpis/getInvoice/generateInvoice/createCreditNote sont tous
// simulés (vi.mock), le composant lui-même n'est jamais mocké.
describe('BillingPage — onglets, KPI, recherche, RBAC', () => {
  it('affiche la bande de KPI et l’onglet Factures par défaut', async () => {
    setupMocks();
    render(<BillingPage permissions={['billing:read', 'billing:write']} />);

    expect(await screen.findByText('2')).toBeInTheDocument(); // facturesAujourdhui
    expect(await screen.findByText('FAC-202608-000001')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Factures' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('bascule vers l’onglet À facturer et affiche les séjours facturables', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<BillingPage permissions={['billing:read', 'billing:write']} />);

    await screen.findByText('FAC-202608-000001');
    await user.click(screen.getByRole('tab', { name: 'À facturer' }));

    expect(await screen.findByText('Idrissi Fatima')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Générer facture' }),
    ).toBeEnabled();
  });

  it('bascule vers l’onglet Paiements, sans colonne "encaissé par"', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<BillingPage permissions={['billing:read']} />);

    await screen.findByText('FAC-202608-000001');
    await user.click(screen.getByRole('tab', { name: 'Paiements' }));

    expect(await screen.findByText('Carte')).toBeInTheDocument();
    expect(screen.queryByText(/encaissé par/i)).not.toBeInTheDocument();
  });

  it('filtre les factures via la recherche (client)', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<BillingPage permissions={['billing:read']} />);

    await screen.findByText('FAC-202608-000001');
    await user.type(screen.getByLabelText('Recherche'), 'inexistant');

    await waitFor(() => {
      expect(screen.queryByText('FAC-202608-000001')).not.toBeInTheDocument();
    });
  });

  it('génère une facture depuis "À facturer" et rafraîchit KPI/Factures', async () => {
    setupMocks();
    vi.mocked(generateInvoice).mockResolvedValue({
      id: 2,
      numero: 'FAC-202608-000002',
      montantTotal: '900.00',
      statut: 'EMISE',
      createdAt: '2026-08-14T11:00:00.000Z',
      creditNotes: [],
      payments: [],
    });
    const user = userEvent.setup();
    render(<BillingPage permissions={['billing:read', 'billing:write']} />);

    await screen.findByText('FAC-202608-000001');
    await user.click(screen.getByRole('tab', { name: 'À facturer' }));
    await screen.findByText('Idrissi Fatima');

    await user.click(screen.getByRole('button', { name: 'Générer facture' }));

    await waitFor(() => {
      expect(generateInvoice).toHaveBeenCalledWith(11);
    });
    // Le refresh global doit re-solliciter les KPI (facture générée).
    await waitFor(() => {
      expect(vi.mocked(getBillingKpis).mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('billing:write absent : bouton "Générer facture" désactivé', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<BillingPage permissions={['billing:read']} />);

    await screen.findByText('FAC-202608-000001');
    await user.click(screen.getByRole('tab', { name: 'À facturer' }));
    await screen.findByText('Idrissi Fatima');

    expect(
      screen.getByRole('button', { name: 'Générer facture' }),
    ).toBeDisabled();
  });

  // DESIGN-010 (correction RBAC finale suite) — billing:send est une
  // permission dédiée, indépendante de billing:write (mission §RBAC finale
  // suite, simule le profil Réception : billing:read + billing:send, jamais
  // billing:write).
  it('billing:send (sans billing:write) : bouton "Envoyer" visible dans le registre, "Générer facture" reste désactivé', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<BillingPage permissions={['billing:read', 'billing:send']} />);

    await screen.findByText('FAC-202608-000001');
    expect(screen.getByTitle('Envoyer par email/WhatsApp')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'À facturer' }));
    await screen.findByText('Idrissi Fatima');
    expect(
      screen.getByRole('button', { name: 'Générer facture' }),
    ).toBeDisabled();
  });

  it('billing:send (sans billing:write) : "Envoyer" visible dans le panneau facture, "Créer un avoir" absent', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<BillingPage permissions={['billing:read', 'billing:send']} />);

    await user.click(await screen.findByText('FAC-202608-000001'));

    expect(
      await screen.findByRole('button', { name: 'Envoyer' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Créer un avoir' }),
    ).not.toBeInTheDocument();
  });

  it('billing:read seul (sans billing:send) : "Envoyer" absent du registre et du panneau', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<BillingPage permissions={['billing:read']} />);

    await screen.findByText('FAC-202608-000001');
    expect(
      screen.queryByTitle('Envoyer par email/WhatsApp'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText('FAC-202608-000001'));
    await screen.findByText(/Cette facture est figée/);
    expect(
      screen.queryByRole('button', { name: 'Envoyer' }),
    ).not.toBeInTheDocument();
  });

  it('ouvre le panneau facture, affiche le bandeau "figée" et masque l’avoir sans billing:write', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<BillingPage permissions={['billing:read']} />);

    await user.click(await screen.findByText('FAC-202608-000001'));

    expect(
      await screen.findByText(/Cette facture est figée/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Créer un avoir' }),
    ).not.toBeInTheDocument();
  });

  it('crée un avoir (billing:write + statut EMISE) et rafraîchit la facture', async () => {
    setupMocks();
    vi.mocked(createCreditNote).mockResolvedValue({
      id: 1,
      motif: 'Erreur de saisie sur le montant, correction nécessaire',
      montant: '650.00',
      createdAt: '2026-08-14T12:00:00.000Z',
    });
    vi.mocked(getInvoice)
      .mockResolvedValueOnce(INVOICE_DETAIL)
      .mockResolvedValueOnce({
        ...INVOICE_DETAIL,
        statut: 'ANNULEE_PAR_AVOIR',
      });
    const user = userEvent.setup();
    render(<BillingPage permissions={['billing:read', 'billing:write']} />);

    await user.click(await screen.findByText('FAC-202608-000001'));
    await screen.findByText(/Cette facture est figée/);

    await user.click(screen.getByRole('button', { name: 'Créer un avoir' }));
    await user.type(
      screen.getByLabelText(/Motif/),
      'Erreur de saisie sur le montant, correction nécessaire',
    );
    await user.click(screen.getByRole('button', { name: "Confirmer l'avoir" }));

    await waitFor(() => {
      expect(createCreditNote).toHaveBeenCalledWith(
        1,
        'Erreur de saisie sur le montant, correction nécessaire',
      );
    });
  });

  it('gère une erreur API proprement (registre Factures)', async () => {
    vi.mocked(getBillingKpis).mockResolvedValue(KPIS);
    vi.mocked(listInvoices).mockRejectedValue(new Error('Erreur serveur'));
    vi.mocked(listStaysFacturables).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
    vi.mocked(listPayments).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });

    render(<BillingPage permissions={['billing:read']} />);

    expect(await screen.findByText('Erreur serveur')).toBeInTheDocument();
  });
});
