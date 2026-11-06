// État applicatif centralisé (useReducer) + persistance locale.
//
// Principes :
//  - un seul point d'écriture par action métier (`CHECK_IN`, `COMMIT_ORDER`,
//    `PAY_FOLIO`, `CLOSE_DAY`…) · même discipline qu'un service backend ;
//  - état dérivé calculé par des sélecteurs purs (`kpiDuJour`,
//    `chambresDisponibles`, `arriveesDuJour`…) et non stocké ;
//  - persistance sous la clé `makarim-prototype-v4` : la démonstration survit au
//    rechargement, le bouton ↺ la remet dans son état initial.
//
// Règles métier portées par le réducteur : BR-SEJ-002/004/005 (check-in, solde,
// libération), BR-CHA-002/003 (états chambre), BR-FAC-003 (annulation logique),
// BR-HK-001/003 (ménage), BR-RST-002 (envoi en chambre), BR-RES-007 (no-show),
// BR-FAC-001 (répartition société / client et factures séparées), BR-SEJ-007
// (prolongation), BR-RH-003/004 (tours de quart), BR-TR-004 (rôles).

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { buildInitialState } from './seed';
import {
  CARTE, MOTIFS_CHANGEMENT, PARAMS, PROFILS, RANG_STANDING, SHIFTS, SUIVI_NO_SHOW,
  TYPES_CHAMBRE,
} from './data';
import {
  montantHebergement, montantTaxeSejour, prixNuit, soldeFolio, totalCommande,
} from './lib/pricing';
import { fmtHeure, isoAdd, nuits as nbNuits } from './lib/date';

// v4 : ajout des clients, fiches de police, tours de quart, rôles
// paramétrables et de la répartition de facturation (payeur par ligne).
const STORAGE_KEY = 'makarim-prototype-v4';
const ANCIENNE_CLE = 'makarim-prototype-v3';
const StoreContext = createContext(null);

// Taux de TVA appliqué à une ligne de folio. La taxe de séjour n'est pas
// soumise à TVA (elle est reversée au Trésor), l'hébergement et les pensions
// sont à 10 %, les prestations annexes et la restauration à 20 %.
// Les taux viennent de `parametres.fiscalite` (éditable par la Direction) ;
// à défaut, des constantes du cahier des charges. Un changement de taux se
// répercute sur tous les calculs suivants sans toucher au code.
export function fiscaliteDe(state) {
  return state?.parametres?.fiscalite ?? {
    tvaHebergement: PARAMS.tvaHebergement,
    tvaAnnexe: PARAMS.tvaAnnexe,
    tvaSalle: PARAMS.tvaSalle,
    taxeSejour: PARAMS.taxeSejour,
    plafondEspeces: PARAMS.plafondEspeces,
  };
}

export function tvaDeLigne(ligne, fiscalite) {
  if (ligne.type === 'taxe') return 0;
  const f = fiscalite ?? { tvaHebergement: PARAMS.tvaHebergement, tvaAnnexe: PARAMS.tvaAnnexe };
  if (ligne.type === 'hebergement') return f.tvaHebergement ?? PARAMS.tvaHebergement;
  return f.tvaAnnexe ?? PARAMS.tvaAnnexe;
}

// Découpe un folio par payeur. Un même séjour peut mêler une part entreprise
// (les nuits commandées par la société) et une part client (prolongation,
// extras, restaurant). Cette fonction est la source unique de la répartition.
export function repartirFolio(state, folio) {
  const societe = state.clients?.find((c) => c.id === folio.societeId)
    ?? state.clients?.find((c) => c.societeId === folio.societeId);
  const nomSociete = societe?.nom ?? 'Entreprise';
  const groupes = {
    societe: { payeur: 'societe', libelle: nomSociete, lignes: [], total: 0 },
    client: { payeur: 'client', libelle: folio.client, lignes: [], total: 0 },
  };
  for (const ligne of folio.lignes) {
    const cle = ligne.payeur === 'societe' ? 'societe' : 'client';
    groupes[cle].lignes.push(ligne);
    groupes[cle].total += ligne.montant;
  }
  return [groupes.societe, groupes.client];
}

// Régie restaurant : le restaurant a sa propre caisse, mais l'hôtel encaisse
// pour son compte les notes portées en chambre et les paiements pris à la
// réception. Le relevé dit ce que l'hôtel doit reverser au restaurant.
export function regieRestaurant(state) {
  const duJour = state.commandes;
  const directes = duJour.filter((c) => c.statut === 'reglee' && !c.folioId);
  const enChambre = duJour.filter((c) => (c.statut === 'envoyee' || c.folioId) && c.statut !== 'reglee');
  const totalDirect = directes.reduce((s, c) => s + totalCommande(c), 0);
  const totalChambre = enChambre.reduce((s, c) => s + totalCommande(c), 0);
  const encaisseParHotel = totalDirect + totalChambre;

  // Détail des moyens de paiement, pour le contrôle de caisse du soir.
  const parMoyen = directes.reduce((acc, c) => {
    const cle = c.moyen ?? 'Non précisé';
    acc[cle] = (acc[cle] ?? 0) + totalCommande(c);
    return acc;
  }, {});

  return {
    directes,
    enChambre,
    totalDirect,
    totalChambre,
    encaisseParHotel,
    aReverser: encaisseParHotel,
    parMoyen,
    couverts: duJour.reduce((s, c) => s + c.couverts, 0),
    commandes: duJour.length,
  };
}

// Saison applicable à la date d'exploitation, à partir du mois.
export function saisonActive(state) {
  const mois = Number(state.date.slice(5, 7));
  const saisons = state.parametres?.saisons ?? [];
  if (mois >= 7 && mois <= 8) return saisons.find((s) => s.nom === 'Haute saison') ?? null;
  if (mois >= 4 && mois <= 6) return saisons.find((s) => s.nom === 'Moyenne saison') ?? null;
  if (mois === 9 || mois >= 10 || mois === 1) {
    return saisons.find((s) => s.nom === 'Épaule') ?? null;
  }
  return saisons.find((s) => s.nom === 'Basse saison') ?? null;
}

// Prix effectif d'un type de chambre à la date d'exploitation : grille
// publiée × coefficient de saison. Le coefficient est arrondi au dirham.
export function prixDuJour(state, type) {
  const base = state.parametres?.grille?.[type]?.prix ?? 0;
  const coef = saisonActive(state)?.coef ?? 1;
  return Math.round(base * coef);
}

export function articlesEnAlerte(state) {
  return state.stock.filter((a) => a.stock <= a.seuil);
}

// Écrans réellement ouverts à un profil : les droits paramétrés par la
// Direction priment sur la matrice documentée, qui sert de valeur par défaut.
export function ecransDuRole(state, profil) {
  const roles = state.roles?.[profil];
  return roles?.ecrans ?? (PROFILS[profil] ?? PROFILS.direction).ecrans;
}

// Enregistrement d'une non-présentation · une seule implémentation, utilisée
// par le bouton « Non présenté » et par la clôture de journée. Le no-show
// produit trois effets indissociables : le statut de la réservation, une nuit
// facturée, et une ligne dans le registre de suivi (ouverte jusqu'à traitement).
function enregistrerNoShow(state, resa, source = 'reception') {
  if (!resa || resa.statut !== 'confirmee') return null;
  if ((state.noShows ?? []).some((n) => n.reservationId === resa.id)) return null;
  const chambre = state.chambres.find((c) => c.numero === resa.chambre);
  const nb = nbNuits(resa.arrivee, resa.depart);
  const prix = prixNuit(chambre?.type, resa.formule, resa.occupants, state.parametres?.grille);
  const seq = state.seq.facture + 1;
  const numero = `FA-2026-0${String(seq).padStart(3, '0')}`;

  return {
    ...state,
    seq: { ...state.seq, facture: seq },
    reservations: state.reservations.map((r) =>
      r.id === resa.id ? { ...r, statut: 'no_show', noShowLe: state.date } : r,
    ),
    factures: [
      {
        id: numero,
        client: resa.client,
        type: resa.societeId ? 'societe' : 'hotel',
        payeur: resa.societeId ? 'societe' : 'client',
        societe: null,
        chambre: resa.chambre,
        montant: prix,
        statut: 'emise',
        date: state.date,
        lignes: [
          {
            libelle: `No-show ${resa.client} · 1 nuit retenue (${nb} nuit(s) réservée(s))`,
            montant: prix,
            tva: fiscaliteDe(state).tvaHebergement,
          },
        ],
      },
      ...state.factures,
    ],
    noShows: [
      {
        id: `NS-${(state.noShows?.length ?? 0) + 1}`,
        date: state.date,
        heure: fmtHeure(),
        reservationId: resa.id,
        client: resa.client,
        chambre: resa.chambre,
        canal: resa.canal ?? 'direct',
        arrivee: resa.arrivee,
        depart: resa.depart,
        montant: prix,
        factureId: numero,
        source,
        suivi: 'a_traiter',
        suiviNote: '',
        suiviPar: null,
        suiviLe: null,
        relances: [],
      },
      ...(state.noShows ?? []),
    ],
  };
}

function journal(state, texte, ton = 'maj') {
  return [{ id: `J-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, heure: fmtHeure(), texte, ton }, ...state.journal].slice(0, 40);
}

function reducer(state, action) {
  switch (action.type) {
    case 'CHECK_IN': {
      const resa = state.reservations.find((r) => r.id === action.reservationId);
      if (!resa) return state;
      const chambre = state.chambres.find((c) => c.numero === resa.chambre);
      if (!chambre || chambre.statut !== 'propre') return state;

      const seqS = state.seq.sejour + 1;
      const seqF = state.seq.folio + 1;
      const sejourId = `S-${seqS}`;
      const folioId = `F-${1000 + seqF}`;
      const nb = nbNuits(resa.arrivee, resa.depart);

      // Séjour à la demi-journée : forfait fixe, pas de nuit, donc pas de
      // taxe de séjour (elle est due par nuit et par adulte · BR-FAC-007).
      if (resa.typeSejour && resa.typeSejour !== 'nuit') {
        const folioIdDJ = `F-${1000 + state.seq.folio + 1}`;
        const sejourIdDJ = `S-${state.seq.sejour + 1}`;
        const libelle = resa.typeSejour === 'matinee' ? 'Matinée (day-use)' : 'Après-midi (day-use)';
        const ligneDJ = {
          id: `${folioIdDJ}-1`,
          libelle,
          montant: state.parametres?.demiJournee ?? 200,
          type: 'hebergement',
          payeur: resa.societeId ? 'societe' : 'client',
          dayUse: true,
        };
        const nextDJ = {
          ...state,
          seq: { ...state.seq, sejour: state.seq.sejour + 1, folio: state.seq.folio + 1 },
          chambres: state.chambres.map((c) =>
            c.numero === resa.chambre ? { ...c, statut: 'occupee', sejourId: sejourIdDJ, note: null } : c,
          ),
          reservations: state.reservations.map((r) =>
            r.id === resa.id ? { ...r, statut: 'en_sejour', sejourId: sejourIdDJ } : r,
          ),
          sejours: [
            ...state.sejours,
            {
              id: sejourIdDJ,
              chambre: resa.chambre,
              client: resa.client,
              arrivee: resa.arrivee,
              depart: resa.arrivee,
              formule: 'RO',
              occupants: resa.occupants,
              folioId: folioIdDJ,
              statut: 'en_cours',
              typeSejour: resa.typeSejour,
              clientId: resa.clientId ?? null,
              societeId: resa.societeId ?? null,
            },
          ],
          folios: [
            ...state.folios,
            {
              id: folioIdDJ,
              chambre: resa.chambre,
              client: resa.client,
              sejourId: sejourIdDJ,
              clientId: resa.clientId ?? null,
              societeId: resa.societeId ?? null,
              statut: 'ouvert',
              lignes: [ligneDJ],
              paiements: [],
            },
          ],
        };
        return {
          ...nextDJ,
          journal: journal(nextDJ, `Check-in demi-journée · ${resa.client}, chambre ${resa.chambre}`, 'jade'),
        };
      }

      const lignes = [
        {
          id: `${folioId}-1`,
          libelle: `Hébergement ${nb} nuit${nb > 1 ? 's' : ''} · ${resa.formule}`,
          montant: montantHebergement(chambre.type, resa.formule, resa.occupants, nb, state.parametres?.grille),
          type: 'hebergement',
          // Le payeur par défaut suit la nature du client : une entreprise
          // règle l'hébergement, un particulier se règle lui-même. La ligne
          // reste modifiable une par une dans la Caisse.
          payeur: resa.societeId ? 'societe' : 'client',
        },
        {
          id: `${folioId}-2`,
          libelle: `Taxe de séjour (${resa.occupants} pers. × ${nb} nuit${nb > 1 ? 's' : ''})`,
          montant: montantTaxeSejour(resa.occupants, nb, fiscaliteDe(state).taxeSejour),
          type: 'taxe',
          payeur: resa.societeId ? 'societe' : 'client',
        },
      ];

      const next = {
        ...state,
        seq: { ...state.seq, sejour: seqS, folio: seqF },
        chambres: state.chambres.map((c) =>
          c.numero === resa.chambre ? { ...c, statut: 'occupee', sejourId, note: null } : c,
        ),
        reservations: state.reservations.map((r) =>
          r.id === resa.id ? { ...r, statut: 'en_sejour', sejourId } : r,
        ),
        sejours: [
          ...state.sejours,
          {
            id: sejourId,
            chambre: resa.chambre,
            client: resa.client,
            arrivee: resa.arrivee,
            depart: resa.depart,
            formule: resa.formule,
            occupants: resa.occupants,
            folioId,
            statut: 'en_cours',
            clientId: resa.clientId ?? null,
            societeId: resa.societeId ?? null,
          },
        ],
        folios: [
          ...state.folios,
          {
            id: folioId,
            chambre: resa.chambre,
            client: resa.client,
            sejourId,
            clientId: resa.clientId ?? null,
            societeId: resa.societeId ?? null,
            statut: 'ouvert',
            lignes,
            paiements: [],
          },
        ],
      };
      return { ...next, journal: journal(next, `Check-in · ${resa.client}, chambre ${resa.chambre}`, 'jade') };
    }

    case 'CHECK_OUT': {
      const sejour = state.sejours.find((s) => s.id === action.sejourId);
      if (!sejour) return state;
      const folio = state.folios.find((f) => f.id === sejour.folioId);
      if (!folio || soldeFolio(folio) > 0) return state;

      const factureId = `FA-2026-0${state.seq.facture + 1}`;
      const total = folio.lignes.reduce((s, l) => s + l.montant, 0);
      const next = {
        ...state,
        seq: { ...state.seq, facture: state.seq.facture + 1 },
        chambres: state.chambres.map((c) =>
          c.numero === sejour.chambre ? { ...c, statut: 'a_nettoyer', sejourId: null } : c,
        ),
        sejours: state.sejours.filter((s) => s.id !== sejour.id),
        reservations: state.reservations.map((r) =>
          r.sejourId === sejour.id ? { ...r, statut: 'terminee' } : r,
        ),
        folios: state.folios.map((f) => (f.id === folio.id ? { ...f, statut: 'facture' } : f)),
        factures: [{ id: factureId, client: sejour.client, montant: total, statut: 'emise', date: state.date, chambre: sejour.chambre }, ...state.factures],
      };
      return { ...next, journal: journal(next, `Check-out · ${sejour.client}, chambre ${sejour.chambre} · facture ${factureId}`, 'neutral') };
    }

    case 'SET_ROOM_STATUS': {
      const next = {
        ...state,
        chambres: state.chambres.map((c) =>
          c.numero === action.numero ? { ...c, statut: action.statut, note: action.note ?? null } : c,
        ),
      };
      return { ...next, journal: journal(next, `Chambre ${action.numero} → ${action.statut.replace('_', ' ')}`, 'neutral') };
    }

    case 'CREATE_RESERVATION': {
      const seq = state.seq.resa + 1;
      // Demi-journée : pas de nuit, donc départ le jour même.
      const typeSejour = action.payload.typeSejour ?? 'nuit';
      const next = {
        ...state,
        seq: { ...state.seq, resa: seq },
        reservations: [
          ...state.reservations,
          {
            id: `R-${seq}`,
            chambre: String(action.payload.chambre),
            client: action.payload.client,
            arrivee: action.payload.arrivee,
            depart: typeSejour === 'nuit' ? action.payload.depart : action.payload.arrivee,
            typeSejour,
            canal: action.payload.canal,
            formule: action.payload.formule,
            occupants: action.payload.occupants,
            heure: '',
            statut: 'confirmee',
            sejourId: null,
            clientId: action.payload.clientId ?? null,
            societeId: action.payload.societeId ?? null,
          },
        ],
      };
      return {
        ...next,
        journal: journal(
          next,
          `Réservation · ${action.payload.client}, chambre ${action.payload.chambre}${typeSejour !== 'nuit' ? ' (demi-journée)' : ''}`,
          'maj',
        ),
      };
    }

    case 'CANCEL_RESERVATION': {
      const next = {
        ...state,
        reservations: state.reservations.map((r) => (r.id === action.id ? { ...r, statut: 'annulee' } : r)),
      };
      return { ...next, journal: journal(next, `Réservation annulée · ${action.client ?? action.id}`, 'crimson') };
    }

    case 'CREATE_ORDER': {
      const seq = state.seq.commande + 1;
      const next = {
        ...state,
        seq: { ...state.seq, commande: seq },
        commandes: [
          ...state.commandes,
          {
            id: `C-${seq}`,
            table: action.payload.table,
            couverts: action.payload.couverts,
            statut: 'ouverte',
            heure: fmtHeure(),
            folioId: null,
            lignes: action.payload.lignes,
          },
        ],
      };
      return next;
    }

    case 'SEND_ORDER_TO_ROOM': {
      const commande = state.commandes.find((c) => c.id === action.commandeId);
      if (!commande) return state;
      const chambre = state.chambres.find((c) => c.numero === action.chambre);
      const sejour = state.sejours.find((s) => s.id === chambre?.sejourId);
      const folio = state.folios.find((f) => f.id === sejour?.folioId);
      if (!folio) return state;

      const nouvelles = commande.lignes.map((l, i) => ({
        id: `${folio.id}-r${Date.now()}-${i}`,
        libelle: `${l.qte} × ${l.nom}`,
        montant: l.prix * l.qte,
        type: 'restaurant',
      }));

      const next = {
        ...state,
        folios: state.folios.map((f) => (f.id === folio.id ? { ...f, lignes: [...f.lignes, ...nouvelles] } : f)),
        commandes: state.commandes.map((c) =>
          c.id === commande.id ? { ...c, statut: 'envoyee', folioId: folio.id, folioChambre: action.chambre } : c,
        ),
      };
      return {
        ...next,
        journal: journal(
          next,
          `Note restaurant ${totalCommande(commande)} MAD envoyée au folio de la chambre ${action.chambre}`,
          'maj',
        ),
      };
    }

    case 'PAY_ORDER': {
      const commande = state.commandes.find((c) => c.id === action.commandeId);
      if (!commande) return state;
      const next = {
        ...state,
        commandes: state.commandes.map((c) =>
          c.id === commande.id ? { ...c, statut: 'reglee', moyen: action.moyen } : c,
        ),
      };
      return {
        ...next,
        journal: journal(next, `Table ${commande.table} encaissée · ${totalCommande(commande)} MAD (${action.moyen.toLowerCase()})`, 'jade'),
      };
    }

    case 'PAY_FOLIO': {
      const folio = state.folios.find((f) => f.id === action.folioId);
      if (!folio) return state;
      const montant = action.montant ?? Math.max(0, soldeFolio(folio));
      const paiements = [
        ...folio.paiements,
        { id: `${folio.id}-p${folio.paiements.length + 1}`, moyen: action.moyen, montant, heure: fmtHeure() },
      ];
      const reste = folio.lignes.reduce((s, l) => s + l.montant, 0) - paiements.reduce((s, p) => s + p.montant, 0);
      const next = {
        ...state,
        folios: state.folios.map((f) =>
          f.id === folio.id ? { ...f, paiements, statut: reste <= 0 ? 'solde' : f.statut } : f,
        ),
      };
      return { ...next, journal: journal(next, `Encaissement ${montant} MAD · folio ${folio.id} (${action.moyen.toLowerCase()})`, 'jade') };
    }

    case 'INVOICE_FOLIO': {
      const folio = state.folios.find((f) => f.id === action.folioId);
      if (!folio) return state;
      const seq = state.seq.facture + 1;
      const total = folio.lignes.reduce((s, l) => s + l.montant, 0);
      const numero = `FA-2026-0${seq}`;
      const next = {
        ...state,
        seq: { ...state.seq, facture: seq },
        folios: state.folios.map((f) => (f.id === folio.id ? { ...f, statut: 'facture' } : f)),
        factures: [{ id: numero, client: folio.client, montant: total, statut: 'emise', date: state.date, chambre: folio.chambre }, ...state.factures],
      };
      return { ...next, journal: journal(next, `Facture ${numero} émise · ${folio.client}`, 'neutral') };
    }

    case 'CONFIRM_EVENT': {
      const evt = action.evenement;
      const seq = state.seq.facture + 1;
      const numero = `FA-2026-0${seq}`;
      const acompte = Math.round(evt.montant * (PARAMS.acompteEvenement / 100));
      const next = {
        ...state,
        seq: { ...state.seq, evenement: state.seq.evenement + 1, facture: seq },
        evenements: [
          ...state.evenements,
          {
            id: `E-${state.seq.evenement + 1}`,
            statut: 'confirme',
            acompte,
            ...evt,
          },
        ],
        factures: [
          { id: numero, client: evt.entreprise, montant: acompte, statut: 'emise', date: state.date, type: 'acompte séminaire' },
          ...state.factures,
        ],
      };
      return { ...next, journal: journal(next, `Séminaire confirmé · ${evt.entreprise} · acompte ${acompte} MAD (${numero})`, 'terra') };
    }

    // Action unique du POS : crée ou met à jour la commande d'une table puis
    // l'envoie en chambre (écriture folio) ou l'encaisse. Un seul point
    // d'écriture = pas de commande orpheline entre deux dispatchs.
    // Cycle de vie d'un événement de la salle : un devis se confirme, une
    // option se lève. L'annulation libère le créneau (BR-EVT-001) sans
    // effacer l'historique commercial (BR-AUD-001).
    case 'MAJ_EVENEMENT': {
      const evt = state.evenements.find((e) => e.id === action.id);
      if (!evt) return state;
      const patch = action.patch ?? {};
      const acompte = patch.statut === 'confirme'
        ? Math.round((patch.montant ?? evt.montant) * (PARAMS.acompteEvenement / 100))
        : evt.acompte;
      const next = {
        ...state,
        evenements: state.evenements.map((e) =>
          e.id === action.id ? { ...e, ...patch, acompte } : e,
        ),
      };
      const libelle = patch.statut === 'confirme'
        ? `confirmé · acompte de ${acompte} MAD`
        : patch.statut === 'annule' ? 'annulé, créneau libéré' : 'modifié';
      return { ...next, journal: journal(next, `Salle · ${evt.entreprise} ${libelle}`, patch.statut === 'annule' ? 'crimson' : 'jade') };
    }

    case 'COMMIT_ORDER': {
      const { table, couverts, lignes, mode, chambre: chambreNumero, moyen } = action.payload;
      if (!lignes?.length) return state;
      const existante = state.commandes.find((c) => c.table === table && c.statut === 'ouverte');
      const seq = state.seq.commande + 1;
      const id = existante?.id ?? `C-${seq}`;
      const base = {
        id,
        table,
        couverts,
        lignes,
        heure: existante?.heure ?? fmtHeure(),
        statut: mode === 'room' ? 'envoyee' : 'reglee',
        folioId: null,
        moyen: mode === 'cash' ? moyen : undefined,
      };

      if (mode === 'cash') {
        const next = {
          ...state,
          seq: { ...state.seq, commande: existante ? state.seq.commande : seq },
          commandes: existante
            ? state.commandes.map((c) => (c.id === id ? base : c))
            : [...state.commandes, base],
        };
        const total = lignes.reduce((s2, l) => s2 + l.prix * l.qte, 0);
        return { ...next, journal: journal(next, `Table ${table} encaissée · ${total} MAD (${String(moyen).toLowerCase()})`, 'jade') };
      }

      const chambre = state.chambres.find((c) => c.numero === chambreNumero);
      const sejour = state.sejours.find((s2) => s2.id === chambre?.sejourId);
      const folio = state.folios.find((f) => f.id === sejour?.folioId);
      if (!folio) return state;

      const nouvelles = lignes.map((l, i) => ({
        id: `${folio.id}-r${Date.now()}-${i}`,
        libelle: `${l.qte} × ${l.nom}`,
        montant: l.prix * l.qte,
        type: 'restaurant',
      }));
      const total = lignes.reduce((s2, l) => s2 + l.prix * l.qte, 0);
      const next = {
        ...state,
        seq: { ...state.seq, commande: existante ? state.seq.commande : seq },
        folios: state.folios.map((f) => (f.id === folio.id ? { ...f, lignes: [...f.lignes, ...nouvelles] } : f)),
        commandes: existante
          ? state.commandes.map((c) => (c.id === id ? { ...base, folioId: folio.id, folioChambre: chambreNumero } : c))
          : [...state.commandes, { ...base, folioId: folio.id, folioChambre: chambreNumero }],
      };
      return { ...next, journal: journal(next, `Note restaurant ${total} MAD envoyée au folio de la chambre ${chambreNumero}`, 'maj') };
    }

    case 'TOGGLE_ARTICLE': {
      return {
        ...state,
        carte: state.carte.map((a) => (a.id === action.id ? { ...a, dispo: !a.dispo } : a)),
      };
    }

    // ---------------------------------------------------------------
    // Facturation : un même folio peut être payé par deux personnes
    // différentes (société + client). Le payeur se choisit ligne à ligne.
    // ---------------------------------------------------------------
    case 'SET_PAYEUR': {
      const next = {
        ...state,
        folios: state.folios.map((f) =>
          f.id !== action.folioId
            ? f
            : {
                ...f,
                lignes: f.lignes.map((l) =>
                  l.id === action.ligneId ? { ...l, payeur: action.payeur } : l,
                ),
              },
        ),
      };
      return {
        ...next,
        journal: journal(
          next,
          `Répartition de facturation · folio ${action.folioId} : ligne affectée au ${action.payeur}`,
          'neutral',
        ),
      };
    }

    case 'PROLONGER_SEJOUR': {
      const sejour = state.sejours.find((s) => s.id === action.sejourId);
      if (!sejour) return state;
      const chambre = state.chambres.find((c) => c.numero === sejour.chambre);
      const folio = state.folios.find((f) => f.id === sejour.folioId);
      if (!chambre || !folio) return state;

      const prix = prixNuit(chambre.type, sejour.formule, sejour.occupants, state.parametres?.grille);
      const taxe = PARAMS.taxeSejour * sejour.occupants;
      const nouveauDepart = isoAdd(sejour.depart, 1);
      const lignes = [
        ...folio.lignes,
        {
          id: `${folio.id}-n${folio.lignes.length + 1}`,
          libelle: 'Nuit supplémentaire demandée par le client',
          montant: prix,
          type: 'hebergement',
          // Une prolongation décidée par le client sur son propre compte ne
          // se refacture pas à l'entreprise : la ligne naît « client ».
          payeur: 'client',
          prolongation: true,
        },
        {
          id: `${folio.id}-t${folio.lignes.length + 2}`,
          libelle: 'Taxe de séjour (1 nuit, prolongation)',
          montant: taxe,
          type: 'taxe',
          payeur: 'client',
          prolongation: true,
        },
      ];

      const next = {
        ...state,
        sejours: state.sejours.map((s) =>
          s.id === sejour.id ? { ...s, depart: nouveauDepart } : s,
        ),
        chambres: state.chambres.map((c) =>
          c.numero === sejour.chambre ? { ...c, depart: nouveauDepart } : c,
        ),
        reservations: state.reservations.map((r) =>
          r.sejourId === sejour.id ? { ...r, depart: nouveauDepart } : r,
        ),
        folios: state.folios.map((f) => (f.id === folio.id ? { ...f, lignes } : f)),
      };
      return {
        ...next,
        journal: journal(
          next,
          `Prolongation d’une nuit · ${sejour.client}, chambre ${sejour.chambre} (${prix} MAD facturés au client)`,
          'maj',
        ),
      };
    }

    case 'EMETTRE_FACTURES': {
      const folio = state.folios.find((f) => f.id === action.folioId);
      if (!folio) return state;

      const repartition = repartirFolio(state, folio);
      const payeurs = repartition.filter((r) => r.lignes.length > 0);
      if (payeurs.length === 0) return state;

      let seq = state.seq.facture;
      const emises = payeurs.map((r) => {
        seq += 1;
        const numero = `FA-2026-0${String(seq).padStart(3, '0')}`;
        return {
          id: numero,
          client: r.libelle,
          type: r.payeur === 'societe' ? 'societe' : 'hotel',
          payeur: r.payeur,
          societe: r.payeur === 'societe' ? r.libelle : null,
          folioId: folio.id,
          chambre: folio.chambre,
          montant: r.total,
          statut: 'emise',
          date: state.date,
          lignes: r.lignes.map((l) => ({
            libelle: l.libelle,
            montant: l.montant,
            // Taux issu du paramétrage fiscal en vigueur, pas d'une constante.
            tva: tvaDeLigne(l, fiscaliteDe(state)),
          })),
        };
      });

      const next = {
        ...state,
        seq: { ...state.seq, facture: seq },
        folios: state.folios.map((f) => (f.id === folio.id ? { ...f, statut: 'facture' } : f)),
        factures: [...emises, ...state.factures],
      };
      return {
        ...next,
        journal: journal(
          next,
          `Facturation ${folio.chambre} · ${emises.map((f) => `${f.id} (${f.client})`).join(' + ')}`,
          'neutral',
        ),
      };
    }

    // ---------------------------------------------------------------
    // Tours de quart : checklist, main courante, clôture signée.
    // ---------------------------------------------------------------
    case 'TOGGLE_TACHE_TOURNEE': {
      const next = {
        ...state,
        tournees: state.tournees.map((t) =>
          t.id !== action.tourneeId
            ? t
            : {
                ...t,
                statut: t.statut === 'a_venir' ? 'en_cours' : t.statut,
                taches: t.taches.map((x) => (x.id === action.tacheId ? { ...x, fait: !x.fait } : x)),
              },
        ),
      };
      return next;
    }

    case 'AJOUTER_EVENEMENT_TOURNEE': {
      if (!action.texte.trim()) return state;
      const next = {
        ...state,
        tournees: state.tournees.map((t) =>
          t.id !== action.tourneeId
            ? t
            : {
                ...t,
                evenements: [...t.evenements, { heure: fmtHeure(), texte: action.texte.trim() }],
              },
        ),
      };
      return next;
    }

    case 'CLOTURER_TOURNEE': {
      const tournee = state.tournees.find((t) => t.id === action.tourneeId);
      if (!tournee) return state;
      const suivante = SHIFTS[(SHIFTS.findIndex((s) => s.cle === tournee.shift) + 1) % SHIFTS.length];
      const next = {
        ...state,
        tournees: state.tournees.map((t) =>
          t.id !== tournee.id
            ? t
            : {
                ...t,
                statut: 'clos',
                fin: fmtHeure(),
                closLe: fmtHeure(),
                signe: true,
                remarques: action.remarques ?? t.remarques,
                consignes: action.consignes ?? t.consignes,
                caisse: { ...t.caisse, comptage: action.comptage ?? t.caisse.comptage },
              },
        ),
      };
      return {
        ...next,
        journal: journal(
          next,
          `Shift ${tournee.shift} clôturé par ${tournee.agent} · rapport disponible pour ${suivante.label}`,
          'jade',
        ),
      };
    }

    // ---------------------------------------------------------------
    // Direction : paramétrage des rôles (écrans + visibilité montants).
    // ---------------------------------------------------------------
    case 'SET_ROLES': {
      const next = { ...state, roles: action.roles };
      return { ...next, journal: journal(next, 'Matrice des rôles mise à jour par la Direction', 'neutral') };
    }

    case 'UPDATE_FICHE_POLICE': {
      const next = {
        ...state,
        fichesPolice: state.fichesPolice.map((f) => {
          if (f.id !== action.ficheId) return f;
          const maj = { ...f, ...action.patch };
          const complete = Boolean(
            (maj.nom ?? '').trim() &&
              (maj.pieceNumero ?? '').trim() &&
              (maj.dateNaissance ?? '').trim() &&
              (maj.nationalite ?? '').trim(),
          );
          return { ...maj, statut: complete ? 'complete' : 'a_completer', signee: complete };
        }),
      };
      return {
        ...next,
        journal: journal(next, `Fiche de police ${action.ficheId} mise à jour`, 'neutral'),
      };
    }

    // ---------------------------------------------------------------
    // Publication de la grille tarifaire. C'est cette action qui rend les
    // nouveaux prix effectifs : tant qu'elle n'a pas été exécutée, la
    // grille reste un brouillon côté écran (BR-TR-003).
    // ---------------------------------------------------------------
    case 'PUBLIER_GRILLE': {
      const grille = action.grille;
      const invalides = Object.entries(grille).filter(
        ([, g]) => !Number.isFinite(Number(g.prix)) || Number(g.prix) <= 0,
      );
      if (invalides.length > 0) return state;

      const parametres = {
        ...state.parametres,
        grille: Object.fromEntries(
          Object.entries(grille).map(([cle, g]) => [
            cle,
            { ...state.parametres.grille[cle], prix: Math.round(Number(g.prix)) },
          ]),
        ),
        saisons: action.saisons ?? state.parametres.saisons,
        demiJournee: action.demiJournee ?? state.parametres.demiJournee,
        version: (state.parametres.version ?? 0) + 1,
        publieeLe: state.date,
        publieePar: action.par ?? 'Direction',
      };
      const next = { ...state, parametres };
      return {
        ...next,
        journal: journal(
          next,
          `Grille tarifaire publiée · version ${parametres.version} (${parametres.publieePar})`,
          'jade',
        ),
      };
    }

    // ---------------------------------------------------------------
    // Chambres : création et paramétrage.
    // ---------------------------------------------------------------
    case 'AJOUTER_CHAMBRE': {
      const numero = String(action.chambre.numero ?? '').trim();
      if (!numero) return state;
      if (state.chambres.some((c) => c.numero === numero)) return state;
      const chambre = {
        numero,
        etage: Number(action.chambre.etage ?? Math.floor(Number(numero) / 100) ?? 0),
        type: action.chambre.type ?? 'double',
        statut: action.chambre.statut ?? 'propre',
        sejourId: null,
        minibar: Boolean(action.chambre.minibar),
        active: true,
      };
      const next = { ...state, chambres: [...state.chambres, chambre] };
      return { ...next, journal: journal(next, `Chambre ${numero} créée (${chambre.type})`, 'maj') };
    }

    case 'MAJ_CHAMBRE': {
      const next = {
        ...state,
        chambres: state.chambres.map((c) =>
          c.numero === action.numero ? { ...c, ...action.patch } : c,
        ),
      };
      return {
        ...next,
        journal: journal(next, `Chambre ${action.numero} mise à jour`, 'neutral'),
      };
    }

    // ---------------------------------------------------------------
    // Fonctionnalités activables (stock, minibar, day-use, channel manager…).
    // ---------------------------------------------------------------
    case 'SET_OPTION': {
      const parametres = {
        ...state.parametres,
        options: { ...state.parametres.options, [action.cle]: action.valeur },
      };
      const next = { ...state, parametres };
      return {
        ...next,
        journal: journal(
          next,
          `Fonctionnalité « ${action.cle} » ${action.valeur ? 'activée' : 'désactivée'}`,
          'neutral',
        ),
      };
    }

    case 'SET_HOTEL': {
      const parametres = {
        ...state.parametres,
        hotel: { ...state.parametres.hotel, ...action.patch },
      };
      const next = { ...state, parametres };
      return { ...next, journal: journal(next, 'Identité de l’établissement mise à jour', 'neutral') };
    }

    // ---------------------------------------------------------------
    // Stock : entrées, sorties et consommation minibar.
    // ---------------------------------------------------------------
    case 'MOUVEMENT_STOCK': {
      const article = state.stock.find((a) => a.id === action.articleId);
      if (!article) return state;
      const qte = Math.max(0, Number(action.qte) || 0);
      if (qte === 0) return state;
      const delta = action.type === 'entree' ? qte : -qte;
      const nouveau = Math.max(0, article.stock + delta);
      const mouvement = {
        id: `M-${state.mouvementsStock.length + 1}-${Date.now()}`,
        date: state.date,
        heure: fmtHeure(),
        articleId: article.id,
        type: action.type,
        qte,
        motif: action.motif ?? '',
        chambre: action.chambre ?? null,
      };
      const next = {
        ...state,
        stock: state.stock.map((a) => (a.id === article.id ? { ...a, stock: nouveau } : a)),
        mouvementsStock: [mouvement, ...state.mouvementsStock],
      };
      return {
        ...next,
        journal: journal(
          next,
          `${action.type === 'entree' ? 'Entrée' : 'Sortie'} de stock · ${qte} × ${article.nom}`,
          'neutral',
        ),
      };
    }

    // Consommation du minibar depuis la chambre : décrémente le stock et
    // porte la ligne au folio (BR-RST-002, extension aux consommables).
    case 'CONSOMMER_MINIBAR': {
      const chambre = state.chambres.find((c) => c.numero === action.numero);
      if (!chambre?.sejourId) return state;
      const sejour = state.sejours.find((s) => s.id === chambre.sejourId);
      const folio = state.folios.find((f) => f.id === sejour?.folioId);
      if (!sejour || !folio) return state;

      const lignes = [];
      let stock = state.stock;
      let index = 0;
      for (const dotation of action.dotations ?? []) {
        const article = stock.find((a) => a.id === dotation.articleId);
        if (!article || article.stock < dotation.qte) continue;
        index += 1;
        lignes.push({
          id: `${folio.id}-mb${folio.lignes.length + index}`,
          libelle: `Minibar · ${dotation.qte} × ${article.nom}`,
          montant: article.prix * dotation.qte,
          type: 'restaurant',
          payeur: 'client',
        });
        stock = stock.map((a) =>
          a.id === article.id ? { ...a, stock: a.stock - dotation.qte } : a,
        );
      }
      if (lignes.length === 0) return state;

      const next = {
        ...state,
        stock,
        folios: state.folios.map((f) =>
          f.id === folio.id ? { ...f, lignes: [...f.lignes, ...lignes] } : f,
        ),
      };
      return {
        ...next,
        journal: journal(
          next,
          `Minibar chambre ${chambre.numero} · ${lignes.length} ligne(s) portée(s) au folio`,
          'maj',
        ),
      };
    }

    // ---------------------------------------------------------------
    // Channel manager (simulation) : connexion, synchronisation, push.
    // ---------------------------------------------------------------
    case 'TOGGLE_CANAL': {
      const next = {
        ...state,
        canauxDistribution: state.canauxDistribution.map((c) =>
          c.id === action.id
            ? {
                ...c,
                etat: c.etat === 'connecte' ? 'deconnecte' : 'connecte',
                dernierSync: c.etat === 'connecte' ? 'nc' : fmtHeure(),
              }
            : c,
        ),
      };
      const canal = next.canauxDistribution.find((c) => c.id === action.id);
      return {
        ...next,
        journal: journal(
          next,
          `Canal ${canal.nom} ${canal.etat === 'connecte' ? 'connecté' : 'déconnecté'}`,
          'neutral',
        ),
      };
    }

    case 'SYNC_CANAL': {
      const next = {
        ...state,
        canauxDistribution: state.canauxDistribution.map((c) =>
          c.id === action.id ? { ...c, dernierSync: fmtHeure(), erreurs: 0 } : c,
        ),
      };
      const canal = next.canauxDistribution.find((c) => c.id === action.id);
      return {
        ...next,
        journal: journal(next, `Synchronisation ${canal.nom} · ${fmtHeure()}`, 'jade'),
      };
    }

    case 'POUSSER_TARIFS': {
      const heure = fmtHeure();
      const next = {
        ...state,
        canauxDistribution: state.canauxDistribution.map((c) =>
          c.etat === 'connecte' ? { ...c, dernierSync: heure } : c,
        ),
      };
      const nb = next.canauxDistribution.filter((c) => c.etat === 'connecte').length;
      return {
        ...next,
        journal: journal(
          next,
          `Tarifs et disponibilités poussés vers ${nb} canal(aux) · grille v${next.parametres.version}`,
          'jade',
        ),
      };
    }

    // ---------------------------------------------------------------
    // No-show (BR-RES-007) : la réservation est marquée non présentée et la
    // première nuit est due. L'annulation se fait sans suppression physique
    // (BR-AUD-001).
    // ---------------------------------------------------------------
    case 'MARQUER_NO_SHOW': {
      const resa = state.reservations.find((r) => r.id === action.id);
      const next = enregistrerNoShow(state, resa, 'reception');
      if (!next) return state;
      return {
        ...next,
        journal: journal(
          next,
          `No-show · ${resa.client}, chambre ${resa.chambre} : 1 nuit facturée, dossier de suivi ouvert`,
          'crimson',
        ),
      };
    }

    // Suivi d'un no-show : on ne modifie pas le passé, on ajoute une étape.
    // Chaque passage est horodaté et signé dans `relances`.
    case 'SUIVRE_NO_SHOW': {
      const dossier = (state.noShows ?? []).find((n) => n.id === action.id);
      if (!dossier) return state;
      const par = action.par ?? state.session?.nom ?? 'Réception';
      const patch = action.patch ?? {};
      const nouvelleEtape = patch.note && patch.note.trim()
        ? {
            le: state.date,
            par,
            texte: `${patch.suivi ? (SUIVI_NO_SHOW.find((x) => x.cle === patch.suivi)?.label ?? '') : ''} ${patch.note.trim()}`.trim(),
          }
        : null;
      const next = {
        ...state,
        noShows: state.noShows.map((n) =>
          n.id === action.id
            ? {
                ...n,
                suivi: patch.suivi ?? n.suivi,
                suiviNote: patch.note !== undefined ? patch.note.trim() : n.suiviNote,
                suiviPar: par,
                suiviLe: state.date,
                relances: nouvelleEtape ? [...(n.relances ?? []), nouvelleEtape] : (n.relances ?? []),
              }
            : n,
        ),
      };
      const libelle = SUIVI_NO_SHOW.find((x) => x.cle === (patch.suivi ?? dossier.suivi))?.label ?? 'suivi';
      return {
        ...next,
        journal: journal(next, `No-show ${dossier.client} · suivi mis à jour : ${libelle}`, 'maj'),
      };
    }

    // ---------------------------------------------------------------
    // Paramétrage : carte du restaurant, prestations de la salle, fiscalité,
    // verrou tarifaire et comptes agents. Tout passe par le même réducteur
    // pour que chaque modification soit journalisée (BR-AUD-002).
    // ---------------------------------------------------------------
    case 'AJOUTER_ARTICLE_CARTE': {
      const next = {
        ...state,
        carte: [...state.carte, { ...action.article, dispo: action.article.dispo ?? true }],
      };
      return {
        ...next,
        journal: journal(next, `Carte restaurant · « ${action.article.nom} » ajouté (${action.article.cat})`, 'jade'),
      };
    }

    case 'MAJ_ARTICLE_CARTE': {
      const article = state.carte.find((a) => a.id === action.id);
      if (!article) return state;
      const next = {
        ...state,
        carte: state.carte.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)),
      };
      const p = action.patch;
      const texte = p.prix !== undefined && p.prix !== article.prix
        ? `prix ${article.prix} → ${p.prix} MAD`
        : p.dispo !== undefined
          ? (p.dispo ? 'remis à la carte' : 'marqué en rupture')
          : 'modifié';
      return { ...next, journal: journal(next, `Carte restaurant · « ${article.nom} » ${texte}`, 'maj') };
    }

    case 'SUPPRIMER_ARTICLE_CARTE': {
      const article = state.carte.find((a) => a.id === action.id);
      if (!article) return state;
      // Suppression logique : les notes déjà émises gardent leur libellé et
      // leur prix, l'article disparaît seulement de la carte (BR-AUD-001).
      const next = {
        ...state,
        carte: state.carte.map((a) => (a.id === action.id ? { ...a, supprime: true, dispo: false } : a)),
      };
      return {
        ...next,
        journal: journal(next, `Carte restaurant · « ${article.nom} » retiré de la carte`, 'crimson'),
      };
    }

    case 'AJOUTER_PRESTATION_SALLE': {
      const liste = state.parametres?.prestationsSalle ?? [];
      const next = {
        ...state,
        parametres: {
          ...state.parametres,
          prestationsSalle: [...liste, { ...action.prestation, active: true }],
        },
      };
      return {
        ...next,
        journal: journal(next, `Salle · prestation « ${action.prestation.label} » ajoutée`, 'jade'),
      };
    }

    case 'MAJ_PRESTATION_SALLE': {
      const liste = state.parametres?.prestationsSalle ?? [];
      const presta = liste.find((p) => p.cle === action.cle);
      if (!presta) return state;
      const next = {
        ...state,
        parametres: {
          ...state.parametres,
          prestationsSalle: liste.map((p) => (p.cle === action.cle ? { ...p, ...action.patch } : p)),
        },
      };
      const texte = action.patch.prix !== undefined && action.patch.prix !== presta.prix
        ? `prix ${presta.prix} → ${action.patch.prix} MAD`
        : action.patch.active === false ? 'désactivée' : action.patch.active === true ? 'réactivée' : 'modifiée';
      return { ...next, journal: journal(next, `Salle · « ${presta.label} » ${texte}`, 'maj') };
    }

    // La fiscalité est sensible : tout changement est tracé avec l'ancienne
    // et la nouvelle valeur, et ne s'applique qu'aux écritures suivantes.
    case 'SET_FISCALITE': {
      const avant = state.parametres?.fiscalite ?? {};
      const apres = { ...avant, ...action.patch };
      const next = { ...state, parametres: { ...state.parametres, fiscalite: apres } };
      const changements = Object.keys(action.patch)
        .filter((k) => avant[k] !== apres[k])
        .map((k) => `${k} ${avant[k] ?? 'nc'} → ${apres[k]}`);
      return {
        ...next,
        journal: journal(next, `Fiscalité mise à jour · ${changements.join(', ') || 'aucun écart'}`, 'crimson'),
      };
    }

    case 'SET_VERROU_TARIFS': {
      const next = { ...state, parametres: { ...state.parametres, verrouTarifs: action.actif } };
      return {
        ...next,
        journal: journal(
          next,
          action.actif ? 'Grille tarifaire verrouillée' : 'Grille tarifaire déverrouillée (session courante)',
          action.actif ? 'jade' : 'saffron',
        ),
      };
    }

    case 'CREER_COMPTE': {
      const { compte } = action;
      if (!compte?.identifiant) return state;
      const existe = (state.comptes ?? []).some(
        (c) => c.identifiant.toLowerCase() === compte.identifiant.toLowerCase(),
      );
      if (existe) return state;
      const seq = (state.comptes?.length ?? 0) + 1;
      const next = {
        ...state,
        comptes: [
          ...(state.comptes ?? []),
          {
            id: `U-${seq}`,
            nom: compte.nom,
            identifiant: compte.identifiant.toLowerCase(),
            email: compte.email ?? '',
            profil: compte.profil,
            actif: true,
            creeLe: state.date,
          },
        ],
      };
      return {
        ...next,
        journal: journal(next, `Compte créé · ${compte.nom} (${PROFILS[compte.profil]?.label ?? compte.profil})`, 'jade'),
      };
    }

    case 'MAJ_COMPTE': {
      const compte = (state.comptes ?? []).find((c) => c.id === action.id);
      if (!compte) return state;
      const next = {
        ...state,
        comptes: state.comptes.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };
      const texte = action.patch.actif === false
        ? 'désactivé'
        : action.patch.actif === true
          ? 'réactivé'
          : 'modifié';
      return { ...next, journal: journal(next, `Compte ${compte.nom} ${texte}`, 'maj') };
    }

    // Changement de chambre : jamais une simple réécriture du numéro.
    //  - la chambre d'accueil doit être libre sur les mêmes dates ;
    //  - le standing doit être égal ou supérieur, sauf surclassement assumé ;
    //  - le motif et son origine (client / hôtel) sont obligatoires ;
    //  - l'opération est historisée et rattachée au client.
    case 'CHANGER_CHAMBRE': {
      const { refType, refId, chambre: numeroCible, motif, commentaire, par } = action;
      const cible = state.chambres.find((c) => c.numero === numeroCible);
      const source = refType === 'sejour'
        ? state.sejours.find((x) => x.id === refId)
        : state.reservations.find((x) => x.id === refId);
      if (!cible || !source) return state;
      if (source.chambre === numeroCible) return state;

      const chambreSource = state.chambres.find((c) => c.numero === source.chambre);
      if (!chambreSource) return state;
      if (RANG_STANDING[cible.type] < RANG_STANDING[chambreSource.type]) return state;

      const occupee = [...state.reservations, ...state.sejours].some(
        (x) =>
          x.chambre === numeroCible &&
          x.id !== refId &&
          (x.statut === 'confirmee' || x.statut === 'en_sejour' || !x.statut) &&
          x.arrivee < source.depart &&
          x.depart > source.arrivee,
      );
      if (occupee || cible.statut === 'hors_service') return state;

      const motifRef = MOTIFS_CHANGEMENT.find((m) => m.cle === motif) ?? MOTIFS_CHANGEMENT[0];
      const supplement = prixDuJour(state, cible.type) - prixDuJour(state, chambreSource.type);

      const changement = {
        id: `CC-${(state.changementsChambre?.length ?? 0) + 1}`,
        date: state.date,
        heure: fmtHeure(),
        refType,
        refId,
        client: source.client,
        de: source.chambre,
        vers: numeroCible,
        standing: `${TYPES_CHAMBRE[chambreSource.type].court} → ${TYPES_CHAMBRE[cible.type].court}`,
        motif: motifRef.cle,
        motifLabel: motifRef.label,
        origine: motifRef.origine,
        tarif: motifRef.tarif,
        supplement: motifRef.tarif === 'gratuit' ? 0 : supplement,
        commentaire: commentaire?.trim() ?? '',
        par: par ?? state.session?.nom ?? 'Réception',
      };

      const next = {
        ...state,
        changementsChambre: [...(state.changementsChambre ?? []), changement],
        chambres: state.chambres.map((c) => {
          if (c.numero === numeroCible) return { ...c, minibar: c.minibar ?? false };
          return c;
        }),
        sejours: refType === 'sejour'
          ? state.sejours.map((x) => (x.id === refId ? { ...x, chambre: numeroCible } : x))
          : state.sejours,
        reservations: refType === 'resa'
          ? state.reservations.map((x) => (x.id === refId ? { ...x, chambre: numeroCible, changeLe: state.date } : x))
          : state.reservations,
        folios: refType === 'sejour'
          ? state.folios.map((f) =>
              f.id === source.folioId ? { ...f, chambre: numeroCible, lignes: f.lignes } : f,
            )
          : state.folios,
      };

      return {
        ...next,
        journal: journal(
          next,
          `Changement de chambre · ${source.client} : ${source.chambre} → ${numeroCible} (${motifRef.label})`,
          'maj',
        ),
      };
    }

    // ---------------------------------------------------------------
    // Session : chaque agent se connecte avec son propre compte.
    // ---------------------------------------------------------------
    case 'LOGIN': {
      const compte = action.compte;
      if (!compte) return state;
      return {
        ...state,
        session: {
          compteId: compte.id,
          identifiant: compte.identifiant,
          profil: compte.profil,
          nom: compte.nom,
          ouverture: fmtHeure(),
        },
        profil: compte.profil,
      };
    }

    case 'LOGOUT': {
      const next = { ...state, session: null };
      return {
        ...next,
        journal: journal(
          next,
          `${state.session?.nom ?? 'Un agent'} a fermé sa session`,
          'neutral',
        ),
      };
    }

    case 'SET_PROFIL':
      return { ...state, profil: action.payload };

    case 'CLOSE_DAY': {
      // Les arrivées non enregistrées deviennent des non-présentations
      // enregistrées : statut + nuit facturée + dossier de suivi.
      const restantes = state.reservations.filter(
        (r) => r.arrivee === state.date && r.statut === 'confirmee',
      );
      let courant = state;
      for (const r of restantes) courant = enregistrerNoShow(courant, r, 'cloture') ?? courant;
      const noShows = restantes;
      const next = {
        ...courant,
        date: isoAdd(state.date, 1),
        reservations: courant.reservations.map((r) =>
          r.arrivee === state.date && r.statut === 'confirmee' ? { ...r, statut: 'no_show' } : r,
        ),
        journal: [
          {
            id: `J-close-${state.date}`,
            heure: fmtHeure(),
            texte: `Journée du ${state.date} clôturée · ${noShows.length} non-présentation(s) enregistrée(s)`,
            ton: 'neutral',
          },
        ],
      };
      return next;
    }

    case 'RESET':
      return initialise();

    default:
      return state;
  }
}

function initialise() {
  return buildInitialState(CARTE.map((a) => ({ ...a })));
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(ANCIENNE_CLE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.chambres) {
          // Fusion avec le seed : un état enregistré par une version
          // antérieure (sans clients, fiches de police, tournées ni rôles)
          // reste utilisable au lieu de casser l'écran au premier accès.
          const defauts = initialise();
          return {
            ...defauts,
            ...parsed,
            profil: parsed.profil ?? 'direction',
            roles: parsed.roles ?? defauts.roles,
            clients: parsed.clients ?? defauts.clients,
            fichesPolice: parsed.fichesPolice ?? defauts.fichesPolice,
            tournees: parsed.tournees ?? defauts.tournees,
            // v7 : un état enregistré avant le registre des non-présentations
            // reçoit les dossiers de démonstration au lieu d'un écran vide.
            noShows: parsed.noShows ?? defauts.noShows,
          };
        }
      }
    } catch {
      /* état corrompu → on repart du seed */
    }
    return initialise();
  });

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota / mode privé : la démo reste utilisable en mémoire */
    }
  }, [state]);

  const actions = useMemo(
    () => ({
      checkIn: (reservationId) => dispatch({ type: 'CHECK_IN', reservationId }),
      checkOut: (sejourId) => dispatch({ type: 'CHECK_OUT', sejourId }),
      setRoomStatus: (numero, statut, note) => dispatch({ type: 'SET_ROOM_STATUS', numero, statut, note }),
      createReservation: (payload) => dispatch({ type: 'CREATE_RESERVATION', payload }),
      cancelReservation: (id, client) => dispatch({ type: 'CANCEL_RESERVATION', id, client }),
      createOrder: (payload) => dispatch({ type: 'CREATE_ORDER', payload }),
      sendOrderToRoom: (commandeId, chambre) => dispatch({ type: 'SEND_ORDER_TO_ROOM', commandeId, chambre }),
      payOrder: (commandeId, moyen) => dispatch({ type: 'PAY_ORDER', commandeId, moyen }),
      payFolio: (folioId, moyen, montant) => dispatch({ type: 'PAY_FOLIO', folioId, moyen, montant }),
      invoiceFolio: (folioId) => dispatch({ type: 'INVOICE_FOLIO', folioId }),
      confirmEvent: (evenement) => dispatch({ type: 'CONFIRM_EVENT', evenement }),
      majEvenement: (id, patch) => dispatch({ type: 'MAJ_EVENEMENT', id, patch }),
      toggleArticle: (id) => dispatch({ type: 'TOGGLE_ARTICLE', id }),
      commitOrder: (payload) => dispatch({ type: 'COMMIT_ORDER', payload }),
      closeDay: () => dispatch({ type: 'CLOSE_DAY' }),
      setProfil: (profil) => dispatch({ type: 'SET_PROFIL', payload: profil }),
      setPayeur: (folioId, ligneId, payeur) =>
        dispatch({ type: 'SET_PAYEUR', folioId, ligneId, payeur }),
      prolongerSejour: (sejourId) => dispatch({ type: 'PROLONGER_SEJOUR', sejourId }),
      emettreFactures: (folioId) => dispatch({ type: 'EMETTRE_FACTURES', folioId }),
      toggleTacheTournee: (tourneeId, tacheId) =>
        dispatch({ type: 'TOGGLE_TACHE_TOURNEE', tourneeId, tacheId }),
      ajouterEvenementTournee: (tourneeId, texte) =>
        dispatch({ type: 'AJOUTER_EVENEMENT_TOURNEE', tourneeId, texte }),
      cloturerTournee: (tourneeId, payload) =>
        dispatch({ type: 'CLOTURER_TOURNEE', tourneeId, ...payload }),
      setRoles: (roles) => dispatch({ type: 'SET_ROLES', roles }),
      publierGrille: (grille, saisons, demiJournee, par) =>
        dispatch({ type: 'PUBLIER_GRILLE', grille, saisons, demiJournee, par }),
      ajouterChambre: (chambre) => dispatch({ type: 'AJOUTER_CHAMBRE', chambre }),
      majChambre: (numero, patch) => dispatch({ type: 'MAJ_CHAMBRE', numero, patch }),
      setOption: (cle, valeur) => dispatch({ type: 'SET_OPTION', cle, valeur }),
      setHotel: (patch) => dispatch({ type: 'SET_HOTEL', patch }),
      mouvementStock: (articleId, type, qte, motif, chambre) =>
        dispatch({ type: 'MOUVEMENT_STOCK', articleId, type, qte, motif, chambre }),
      consommerMinibar: (numero, dotations) =>
        dispatch({ type: 'CONSOMMER_MINIBAR', numero, dotations }),
      toggleCanal: (id) => dispatch({ type: 'TOGGLE_CANAL', id }),
      syncCanal: (id) => dispatch({ type: 'SYNC_CANAL', id }),
      pousserTarifs: () => dispatch({ type: 'POUSSER_TARIFS' }),
      marquerNoShow: (id) => dispatch({ type: 'MARQUER_NO_SHOW', id }),
      suivreNoShow: (id, patch, par) => dispatch({ type: 'SUIVRE_NO_SHOW', id, patch, par }),
      ajouterArticleCarte: (article) => dispatch({ type: 'AJOUTER_ARTICLE_CARTE', article }),
      majArticleCarte: (id, patch) => dispatch({ type: 'MAJ_ARTICLE_CARTE', id, patch }),
      supprimerArticleCarte: (id) => dispatch({ type: 'SUPPRIMER_ARTICLE_CARTE', id }),
      ajouterPrestationSalle: (prestation) => dispatch({ type: 'AJOUTER_PRESTATION_SALLE', prestation }),
      majPrestationSalle: (cle, patch) => dispatch({ type: 'MAJ_PRESTATION_SALLE', cle, patch }),
      setFiscalite: (patch) => dispatch({ type: 'SET_FISCALITE', patch }),
      setVerrouTarifs: (actif) => dispatch({ type: 'SET_VERROU_TARIFS', actif }),
      creerCompte: (compte) => dispatch({ type: 'CREER_COMPTE', compte }),
      majCompte: (id, patch) => dispatch({ type: 'MAJ_COMPTE', id, patch }),
      changerChambre: (payload) => dispatch({ type: 'CHANGER_CHAMBRE', ...payload }),
      login: (compte) => dispatch({ type: 'LOGIN', compte }),
      logout: () => dispatch({ type: 'LOGOUT' }),
      updateFichePolice: (ficheId, patch) =>
        dispatch({ type: 'UPDATE_FICHE_POLICE', ficheId, patch }),
      reset: () => {
        localStorage.removeItem(STORAGE_KEY);
        dispatch({ type: 'RESET' });
      },
    }),
    [],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useApp() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useApp doit être utilisé dans AppProvider');
  return ctx;
}

/* -------------------------- Sélecteurs -------------------------- */

export function chambresVendues(state) {
  return state.sejours.filter((s) => s.statut === 'en_cours').length;
}

export function arriveesDuJour(state) {
  return state.reservations
    .filter((r) => r.arrivee === state.date && r.statut === 'confirmee')
    .sort((a, b) => (a.heure || '99').localeCompare(b.heure || '99'));
}

export function departsDuJour(state) {
  return state.sejours.filter((s) => s.depart === state.date);
}

export function folioDuSejour(state, sejour) {
  return state.folios.find((f) => f.id === sejour?.folioId);
}

export function kpiDuJour(state) {
  const enChambre = state.sejours.filter((s) => s.statut === 'en_cours');
  const arrivees = arriveesDuJour(state);
  const departs = departsDuJour(state);
  // Ventes de la nuit à venir : séjours qui ne partent pas aujourd'hui + arrivées du jour.
  const restants = enChambre.filter((s) => s.depart > state.date);
  const vendues = restants.length + arrivees.length;
  const occupation = Math.round((vendues / state.chambres.length) * 100);

  const prix = (s) => {
    const chambre = state.chambres.find((c) => c.numero === s.chambre);
    return prixDuJour(state, chambre?.type);
  };
  const totalNuit = [...restants, ...arrivees].reduce((sum, s) => sum + prix(s), 0);
  const adr = Math.round(totalNuit / Math.max(1, vendues));
  const revpar = Math.round((adr * occupation) / 100);

  const caHebergement = [...restants, ...arrivees].reduce((sum, s) => {
    const ch = state.chambres.find((c) => c.numero === s.chambre);
    return sum + montantHebergement(ch?.type, s.formule, s.occupants, 1, state.parametres?.grille);
  }, 0);

  const caRestauration =
    state.commandes.filter((c) => c.statut === 'reglee').reduce((s, c) => s + totalCommande(c), 0) +
    state.commandes
      .filter((c) => c.statut === 'envoyee')
      .reduce((s, c) => s + totalCommande(c), 0);

  const caConference = state.evenements
    .filter((e) => e.statut === 'confirme')
    .reduce((s, e) => s + (e.acompte ?? 0), 0);

  return {
    occupation,
    vendues,
    enChambre: enChambre.length,
    arrivees: arrivees.length,
    departs: departs.length,
    adr,
    revpar,
    caHebergement,
    caRestauration,
    caConference,
    caTotal: caHebergement + caRestauration + caConference,
  };
}

// Disponibilité sur une plage donnée : un chevauchement de dates suffit à
// rendre la chambre indisponible, quel que soit son état courant (une chambre
// occupée jusqu'à vendredi reste vendable à partir de samedi).
export function chambresDisponibles(state, arrivee, depart) {
  return state.chambres.filter((c) => {
    if (c.statut === 'hors_service') return false;
    const chevaucheResa = state.reservations.some(
      (r) =>
        r.chambre === c.numero &&
        ['confirmee', 'en_sejour'].includes(r.statut) &&
        r.arrivee < depart &&
        r.depart > arrivee,
    );
    const chevaucheSejour = state.sejours.some(
      (s) => s.chambre === c.numero && s.arrivee < depart && s.depart > arrivee,
    );
    return !chevaucheResa && !chevaucheSejour;
  });
}

export function soldeDuFolio(folio) {
  return soldeFolio(folio);
}

/* ---------------------- Sélecteurs de paramétrage ---------------------- */

// Carte effective : les articles retirés restent en base (historique des notes)
// mais ne sont plus proposés à la vente.
export function articlesCarte(state) {
  return (state.carte ?? []).filter((a) => !a.supprime);
}

export function prestationsSalle(state) {
  return (state.parametres?.prestationsSalle ?? []).filter((p) => p.active !== false);
}

// Historique d'un client : séjours, réservations, factures et changements de
// chambre regroupés sous le même nom. Sert au panneau « dossier client ».
export function historiqueClient(state, nom) {
  if (!nom) return { sejours: [], reservations: [], factures: [], changements: [], noShows: [] };
  const cle = nom.trim().toLowerCase();
  const meme = (x) => (x ?? '').trim().toLowerCase() === cle;
  return {
    sejours: (state.sejours ?? []).filter((s) => meme(s.client)),
    reservations: (state.reservations ?? []).filter((r) => meme(r.client)),
    factures: (state.factures ?? []).filter((f) => meme(f.client)),
    changements: (state.changementsChambre ?? []).filter((c) => meme(c.client)),
    // Un no-show est un antécédent commercial : il doit remonter au dossier.
    noShows: (state.noShows ?? []).filter((n) => meme(n.client)),
  };
}

export function changementsDe(state, refType, refId) {
  return (state.changementsChambre ?? []).filter((c) => c.refType === refType && c.refId === refId);
}

// Dossiers de non-présentation encore ouverts, du plus récent au plus ancien.
export function noShowsASuivre(state) {
  return (state.noShows ?? []).filter((n) => n.suivi !== 'clos');
}

export function montantNoShows(state) {
  return (state.noShows ?? []).reduce((s, n) => s + (n.montant ?? 0), 0);
}
