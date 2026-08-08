import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { HotelConfig } from '@/features/parameters/types';
import type { Folio, Invoice } from '../types';

vi.mock('@/features/parameters/api', () => ({
  getHotelConfig: vi.fn(),
}));

import { InvoicePrintModal } from './InvoicePrintModal';
import { getHotelConfig } from '@/features/parameters/api';

const ISO = '2026-01-15T00:00:00.000Z';

const invoice: Invoice = {
  id: 1,
  numero: 'FAC-202601-000001',
  montantTotal: '1572.00',
  statut: 'EMISE',
  createdAt: ISO,
  creditNotes: [],
  payments: [],
};

const folio: Pick<Folio, 'libelle' | 'lignes'> = {
  libelle: 'Folio principal',
  lignes: [
    {
      id: 1,
      type: 'HEBERGEMENT',
      libelle: 'Hébergement — 1 nuit',
      montant: '1200.00',
      tauxTva: '10',
      annulee: false,
      createdAt: ISO,
    },
    {
      id: 2,
      type: 'TAXE_SEJOUR',
      libelle: 'Taxe de séjour',
      montant: '12.00',
      tauxTva: '0',
      annulee: false,
      createdAt: ISO,
    },
    {
      id: 3,
      type: 'PAIEMENT',
      libelle: 'Paiement espèces',
      montant: '500.00',
      tauxTva: '0',
      annulee: false,
      createdAt: ISO,
    },
    {
      id: 4,
      type: 'EXTRA',
      libelle: 'Extra annulé',
      montant: '80.00',
      tauxTva: '20',
      annulee: true,
      createdAt: ISO,
    },
  ],
};

const guest = { nom: 'Alaoui', prenom: 'Karim', email: 'karim@example.com' };
const room = { numero: '502', roomType: { nom: 'Quadruple' } };

// CH-042 (docs/execution/PLAN_MISE_EN_PRODUCTION_BETA.md, Phase B) — deux
// garanties non négociables pour un document remis à un client réel :
// (1) jamais de coordonnées légales fabriquées quand HotelConfig ne les
// porte pas (contrairement à MakarimPMS_v2, qui affichait un ICE/RC/CNSS
// factices en toute circonstance) ; (2) un seul total affiché, celui déjà
// figé sur la facture (Invoice.montantTotal, ADR-004), jamais recalculé
// côté client à partir d'un taux de TVA supposé.
describe('InvoicePrintModal — pas de données fabriquées, un seul total figé', () => {
  it("n'affiche aucune ligne ICE/RC/IF quand HotelConfig ne les porte pas", async () => {
    vi.mocked(getHotelConfig).mockResolvedValue({
      id: 1,
      raisonSociale: 'Hôtel Makarim',
      ice: '',
      identifiantFiscal: '',
      rc: '',
      adresse: '',
      logoUrl: null,
      categorieEtoiles: 3,
      devise: 'MAD',
      formatDate: 'DD/MM/YYYY',
      updatedAt: ISO,
    } satisfies HotelConfig);

    render(
      <InvoicePrintModal
        open
        onClose={() => {}}
        invoice={invoice}
        folio={folio}
        guest={guest}
        room={room}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Hôtel Makarim')).toBeInTheDocument();
    });
    expect(screen.queryByText(/ICE:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/RC:/)).not.toBeInTheDocument();
  });

  it('affiche ICE/RC/IF réels quand HotelConfig les porte, jamais de valeur inventée', async () => {
    vi.mocked(getHotelConfig).mockResolvedValue({
      id: 1,
      raisonSociale: 'Hôtel Makarim SARL',
      ice: '001234567000089',
      identifiantFiscal: '45678912',
      rc: '9876',
      adresse: 'Tétouan, Maroc',
      logoUrl: null,
      categorieEtoiles: 3,
      devise: 'MAD',
      formatDate: 'DD/MM/YYYY',
      updatedAt: ISO,
    } satisfies HotelConfig);

    render(
      <InvoicePrintModal
        open
        onClose={() => {}}
        invoice={invoice}
        folio={folio}
        guest={guest}
        room={room}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/ICE: 001234567000089/)).toBeInTheDocument();
    });
    expect(screen.getByText(/RC: 9876/)).toBeInTheDocument();
    expect(screen.getByText(/IF: 45678912/)).toBeInTheDocument();
  });

  it('affiche uniquement le total TTC déjà figé sur la facture, sans le recalculer', async () => {
    vi.mocked(getHotelConfig).mockResolvedValue(null as unknown as HotelConfig);

    render(
      <InvoicePrintModal
        open
        onClose={() => {}}
        invoice={invoice}
        folio={folio}
        guest={guest}
        room={room}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Total TTC')).toBeInTheDocument();
    });
    expect(screen.getByText('1572.00 MAD')).toBeInTheDocument();

    // Lignes PAIEMENT et annulées absentes du tableau imprimable.
    expect(screen.queryByText('Paiement espèces')).not.toBeInTheDocument();
    expect(screen.queryByText('Extra annulé')).not.toBeInTheDocument();
    // Ligne hébergement bien présente avec son montant TTC (pas de TVA
    // recalculée dessus — FIN-102/UX-001B).
    expect(screen.getByText(/Hébergement — 1 nuit/)).toBeInTheDocument();
    expect(screen.getByText('1200.00')).toBeInTheDocument();
  });
});

// UX-001E — bloc "Déjà réglé"/"Reste à payer" ajouté sous le Total TTC,
// calculé par agrégation locale sur `folio.lignes` (jamais `invoice.payments`
// ni `computeSoldeDu`, voir InvoicePrintModal.tsx).
describe('InvoicePrintModal — UX-001E (déjà réglé / reste à payer)', () => {
  beforeEach(() => {
    vi.mocked(getHotelConfig).mockResolvedValue(null as unknown as HotelConfig);
  });

  it('affiche Déjà réglé et Reste à payer pour un paiement partiel', async () => {
    // Charges 1200 + 12 = 1212, Total TTC figé = 1572.00 (invoice mock
    // ci-dessus) ; un seul paiement PAIEMENT de 500.00 dans folio.lignes.
    render(
      <InvoicePrintModal
        open
        onClose={() => {}}
        invoice={invoice}
        folio={folio}
        guest={guest}
        room={room}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Déjà réglé')).toBeInTheDocument();
    });
    expect(screen.getByText('500.00 MAD')).toBeInTheDocument();
    expect(screen.getByText('Reste à payer')).toBeInTheDocument();
    expect(screen.getByText('1072.00 MAD')).toBeInTheDocument();
  });

  it('affiche Reste à payer = 0.00 MAD quand la facture est intégralement réglée (reproduction incident : 1594+100+6=1700, réglé 750+950)', async () => {
    const invoiceReglee: Invoice = {
      ...invoice,
      montantTotal: '1700.00',
    };
    const folioRegle: Pick<Folio, 'libelle' | 'lignes'> = {
      libelle: 'Folio principal',
      lignes: [
        {
          id: 10,
          type: 'HEBERGEMENT',
          libelle: 'Hébergement',
          montant: '1594.00',
          tauxTva: '0',
          annulee: false,
          createdAt: ISO,
        },
        {
          id: 11,
          type: 'EXTRA',
          libelle: 'Extra',
          montant: '100.00',
          tauxTva: '0',
          annulee: false,
          createdAt: ISO,
        },
        {
          id: 12,
          type: 'TAXE_SEJOUR',
          libelle: 'Taxe de séjour',
          montant: '6.00',
          tauxTva: '0',
          annulee: false,
          createdAt: ISO,
        },
        {
          id: 13,
          type: 'PAIEMENT',
          libelle: 'Règlement espèces',
          montant: '750.00',
          tauxTva: '0',
          annulee: false,
          createdAt: ISO,
        },
        {
          id: 14,
          type: 'PAIEMENT',
          libelle: 'Règlement carte',
          montant: '950.00',
          tauxTva: '0',
          annulee: false,
          createdAt: ISO,
        },
      ],
    };

    render(
      <InvoicePrintModal
        open
        onClose={() => {}}
        invoice={invoiceReglee}
        folio={folioRegle}
        guest={guest}
        room={room}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Total TTC')).toBeInTheDocument();
    });
    // Total TTC et Déjà réglé affichent tous deux 1700.00 MAD ici (facture
    // intégralement réglée) — les deux occurrences sont attendues.
    expect(screen.getAllByText('1700.00 MAD')).toHaveLength(2);
    expect(screen.getByText('Déjà réglé')).toBeInTheDocument();
    expect(screen.getByText('Reste à payer')).toBeInTheDocument();
    expect(screen.getByText('0.00 MAD')).toBeInTheDocument();
    // Les lignes de règlement n'apparaissent jamais dans le tableau des
    // prestations.
    expect(screen.queryByText('Règlement espèces')).not.toBeInTheDocument();
    expect(screen.queryByText('Règlement carte')).not.toBeInTheDocument();
  });

  it("n'affiche pas le bloc Déjà réglé/Reste à payer quand aucun paiement n'existe", async () => {
    const folioSansPaiement: Pick<Folio, 'libelle' | 'lignes'> = {
      libelle: 'Folio principal',
      lignes: [
        {
          id: 20,
          type: 'HEBERGEMENT',
          libelle: 'Hébergement',
          montant: '1200.00',
          tauxTva: '0',
          annulee: false,
          createdAt: ISO,
        },
      ],
    };
    const invoiceSansPaiement: Invoice = {
      ...invoice,
      montantTotal: '1200.00',
    };

    render(
      <InvoicePrintModal
        open
        onClose={() => {}}
        invoice={invoiceSansPaiement}
        folio={folioSansPaiement}
        guest={guest}
        room={room}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Total TTC')).toBeInTheDocument();
    });
    expect(screen.queryByText('Déjà réglé')).not.toBeInTheDocument();
    expect(screen.queryByText('Reste à payer')).not.toBeInTheDocument();
  });
});
