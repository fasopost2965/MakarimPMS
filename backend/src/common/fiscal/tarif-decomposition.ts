import { FormuleHebergement, Prisma, TaxMode } from '@prisma/client';
import {
  calculateFormuleTotal,
  RoomTypeFormulePricingLike,
} from '../../modules/reservations/utils/pricing';
import { computeTaxLineAmount } from '../../modules/billing/utils/invoice-calc';

// FIN-102 — fonction fiscale pure et unique de décomposition du tarif
// public TTC (ADR-008 suite, docs/modules/billing.md). Le tarif public TTC
// annoncé au client (ex. Suite 900 MAD/nuit × 2 nuits = 1800 MAD) n'est
// jamais majoré par les prestations incluses ou les taxes statutaires — il
// les ABSORBE : le montant HEBERGEMENT résiduel est calculé EN DERNIER, par
// soustraction, jamais recalculé indépendamment (même technique que
// `ventilerMontantTTC`, common/fiscal/ttc-ventilation.ts, appliquée un
// niveau au-dessus). C'est cette soustraction finale qui garantit
// l'invariant par construction :
//
//   hebergement + formuleIncluse + Σ taxesStatutaires === tarifPublicTTC
//
// Point d'implémentation unique : createFolioPrincipal/checkinFromReservation
// /checkinWalkIn/extendStay (StayService) doivent tous appeler cette même
// fonction, jamais une variante locale.
//
// Aucune dépendance à @nestjs/common ici (même convention que
// reservations/utils/rate-restrictions.ts, pricing.ts, ttc-ventilation.ts) :
// une composition impossible lève une erreur dédiée
// (CompositionTarifaireImpossibleError), traduite par l'appelant
// (StayService) en ConflictException.
export interface TaxeApplicableLike {
  id: number;
  type: string;
  mode: TaxMode;
  taux: Prisma.Decimal;
}

export interface TaxeStatutaireDecomposee {
  taxRateConfigId: number;
  type: string;
  montant: Prisma.Decimal;
}

export interface TarifDecompose {
  hebergement: Prisma.Decimal;
  formuleIncluse: Prisma.Decimal;
  taxesStatutaires: TaxeStatutaireDecomposee[];
}

export class CompositionTarifaireImpossibleError extends Error {
  constructor(
    public readonly tarifPublicTTC: Prisma.Decimal,
    public readonly formuleIncluse: Prisma.Decimal,
    public readonly totalTaxesStatutaires: Prisma.Decimal,
  ) {
    super(
      `Composition tarifaire impossible : la formule incluse (${formuleIncluse.toFixed(2)} MAD) et les taxes statutaires (${totalTaxesStatutaires.toFixed(2)} MAD) dépassent à elles seules le tarif public TTC vendu (${tarifPublicTTC.toFixed(2)} MAD) — le montant HEBERGEMENT résiduel serait négatif.`,
    );
  }
}

export function decomposerTarifPublicTTC(params: {
  tarifPublicTTC: Prisma.Decimal;
  nuits: number;
  occupants: number;
  formule: FormuleHebergement;
  roomType: RoomTypeFormulePricingLike;
  taxesApplicables: TaxeApplicableLike[];
}): TarifDecompose {
  const {
    tarifPublicTTC,
    nuits,
    occupants,
    formule,
    roomType,
    taxesApplicables,
  } = params;

  // Prestation standard incluse (petit-déjeuner/demi-pension/pension
  // complète) — ROOM_ONLY n'ajoute jamais rien (même garde que
  // calculateFormuleTotal côté appelants historiques).
  const formuleIncluse =
    formule === FormuleHebergement.ROOM_ONLY
      ? new Prisma.Decimal(0)
      : calculateFormuleTotal(formule, roomType, nuits, occupants);

  // Taxes statutaires : chaque taxe MONTANT_FIXE (seul mode réellement
  // configuré aujourd'hui, cf. seed.ts — TAXE_SEJOUR) est indépendante du
  // résiduel HEBERGEMENT (nuits × occupants × taux), donc jamais circulaire.
  // Une taxe POURCENTAGE hypothétique (aucune ne passe le filtre
  // `applicableParDefaut`/exclusion TVA_HEBERGEMENT/TVA_ANNEXE aujourd'hui,
  // voir BillingService.generateInvoice) serait calculée ici sur le résiduel
  // encore disponible après la formule incluse et les taxes déjà traitées
  // dans cette boucle (ordre du tableau `taxesApplicables`) — décision de
  // cadrage documentée pour rester cohérente avec l'invariant final, jamais
  // exercée en pratique faute de configuration réelle (point 10 de la
  // mission FIN-102, aucun taux TPT codé en dur).
  const taxesStatutaires: TaxeStatutaireDecomposee[] = [];
  let baseRestante = tarifPublicTTC.sub(formuleIncluse);
  for (const tax of taxesApplicables) {
    const montant = computeTaxLineAmount(tax, nuits, occupants, baseRestante);
    taxesStatutaires.push({
      taxRateConfigId: tax.id,
      type: tax.type,
      montant,
    });
    baseRestante = baseRestante.sub(montant);
  }

  const totalTaxesStatutaires = taxesStatutaires.reduce(
    (acc, t) => acc.add(t.montant),
    new Prisma.Decimal(0),
  );
  const totalPrelevements = formuleIncluse.add(totalTaxesStatutaires);

  // Protection contre une composition impossible (formuleIncluse +
  // Σtaxes > tarifPublicTTC) : jamais de ligne HEBERGEMENT négative, jamais
  // de troncature silencieuse à zéro — l'appelant doit faire échouer/rollback
  // la transaction englobante.
  if (totalPrelevements.gt(tarifPublicTTC)) {
    throw new CompositionTarifaireImpossibleError(
      tarifPublicTTC,
      formuleIncluse,
      totalTaxesStatutaires,
    );
  }

  // HEBERGEMENT résiduel calculé EN DERNIER, par soustraction — jamais
  // recalculé indépendamment (garantit l'invariant par construction).
  const hebergement = tarifPublicTTC.sub(totalPrelevements);

  return { hebergement, formuleIncluse, taxesStatutaires };
}
