import { FolioLine, Prisma, TypeLigneFolio } from '@prisma/client';
import { calculateInvoiceTotal } from './invoice-calc';

// Ligne de folio minimale pour ces tests unitaires purs — seuls
// `type`/`montant`/`annulee` sont lus par calculateInvoiceTotal.
function ligne(
  type: TypeLigneFolio,
  montant: number,
  annulee = false,
): FolioLine {
  return {
    id: 0,
    folioId: 0,
    type,
    libelle: '',
    montant: new Prisma.Decimal(montant),
    tauxTva: new Prisma.Decimal(0),
    annulee,
    motifAnnulation: null,
    taxRateConfigId: null,
    createdAt: new Date(),
  };
}

describe('calculateInvoiceTotal (ADR-008 — montants déjà TTC)', () => {
  it('HEBERGEMENT 400 + EXTRA 50 + RESTAURANT 14 + TAXE_SEJOUR 3 + PAIEMENT 100 → 467 (PAIEMENT ignoré)', () => {
    const lignes = [
      ligne(TypeLigneFolio.HEBERGEMENT, 400),
      ligne(TypeLigneFolio.EXTRA, 50),
      ligne(TypeLigneFolio.RESTAURANT, 14),
      ligne(TypeLigneFolio.TAXE_SEJOUR, 3),
      ligne(TypeLigneFolio.PAIEMENT, 100),
    ];
    const total = calculateInvoiceTotal(lignes);
    expect(total.toNumber()).toBe(467);
  });

  it('exclut les lignes annulées', () => {
    const lignes = [
      ligne(TypeLigneFolio.HEBERGEMENT, 400),
      ligne(TypeLigneFolio.EXTRA, 50, true),
    ];
    const total = calculateInvoiceTotal(lignes);
    expect(total.toNumber()).toBe(400);
  });

  // Preuve du bug corrigé par FIN-101B/ADR-008 : une ligne PAIEMENT transmise
  // directement à calculateInvoiceTotal (sans passer par le filtrage amont
  // de BillingService.generateInvoice) reste exclue — défense en profondeur
  // n°2, indépendante du filtrage du service.
  it('exclut une ligne PAIEMENT même transmise directement, sans filtrage amont', () => {
    const lignes = [
      ligne(TypeLigneFolio.HEBERGEMENT, 500),
      ligne(TypeLigneFolio.PAIEMENT, 200),
    ];
    const total = calculateInvoiceTotal(lignes);
    expect(total.toNumber()).toBe(500);
  });

  it('aucune TVA ajoutée : HEBERGEMENT 500 seul reste 500 (pas 550)', () => {
    const lignes = [ligne(TypeLigneFolio.HEBERGEMENT, 500)];
    const total = calculateInvoiceTotal(lignes);
    expect(total.toNumber()).toBe(500);
  });
});
