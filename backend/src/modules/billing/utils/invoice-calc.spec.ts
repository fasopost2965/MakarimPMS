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

  // DESIGN-009B.1 — AJUSTEMENT_HAUSSE/AJUSTEMENT_BAISSE (changement de
  // chambre, GL-002) étaient auparavant totalement ignorés ici (aucune
  // branche ne les reconnaissait — catégorie B, « ignorés »), alors que
  // computeSoldeDu (stay/utils/solde.ts) les traitait déjà correctement.
  it('AJUSTEMENT_HAUSSE 300 augmente le total facturable de 300', () => {
    const lignes = [
      ligne(TypeLigneFolio.HEBERGEMENT, 1191),
      ligne(TypeLigneFolio.AJUSTEMENT_HAUSSE, 300),
    ];
    const total = calculateInvoiceTotal(lignes);
    expect(total.toNumber()).toBe(1491);
  });

  it('AJUSTEMENT_BAISSE 300 diminue le total facturable de 300 (crédit, jamais un montant négatif stocké)', () => {
    const lignes = [
      ligne(TypeLigneFolio.HEBERGEMENT, 1491),
      ligne(TypeLigneFolio.AJUSTEMENT_BAISSE, 300),
    ];
    const total = calculateInvoiceTotal(lignes);
    expect(total.toNumber()).toBe(1191);
  });

  it('AJUSTEMENT_HAUSSE annulée est exclue du total, mêmes règles que tout autre type annulé', () => {
    const lignes = [
      ligne(TypeLigneFolio.HEBERGEMENT, 1191),
      ligne(TypeLigneFolio.AJUSTEMENT_HAUSSE, 300, true),
    ];
    const total = calculateInvoiceTotal(lignes);
    expect(total.toNumber()).toBe(1191);
  });

  it('PAIEMENT reste exclu (jamais soustrait) même en présence d’un AJUSTEMENT_BAISSE — les deux crédits ne se confondent pas', () => {
    const lignes = [
      ligne(TypeLigneFolio.HEBERGEMENT, 1491),
      ligne(TypeLigneFolio.PAIEMENT, 500),
      ligne(TypeLigneFolio.AJUSTEMENT_BAISSE, 300),
    ];
    const total = calculateInvoiceTotal(lignes);
    // PAIEMENT ignoré (500 n'apparaît nulle part) ; seul AJUSTEMENT_BAISSE
    // (crédit sur la charge elle-même) est soustrait : 1491 - 300 = 1191.
    expect(total.toNumber()).toBe(1191);
  });
});
