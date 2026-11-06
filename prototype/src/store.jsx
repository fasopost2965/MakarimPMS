// État applicatif centralisé (useReducer) + persistance locale.
//
// Principes :
//  - un seul point d'écriture par action métier (`CHECK_IN`, `COMMIT_ORDER`,
//    `PAY_FOLIO`, `CLOSE_DAY`…) — même discipline qu'un service backend ;
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
import { CARTE, PARAMS, PROFILS, SHIFTS, TYPES_CHAMBRE } from './data';
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
export function tvaDeLigne(ligne) {
  if (ligne.type === 'taxe') return 0;
  if (ligne.type === 'hebergement') return PARAMS.tvaHebergement;
  return PARAMS.tvaAnnexe;
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

// Écrans réellement ouverts à un profil : les droits paramétrés par la
// Direction priment sur la matrice documentée, qui sert de valeur par défaut.
export function ecransDuRole(state, profil) {
  const roles = state.roles?.[profil];
  return roles?.ecrans ?? (PROFILS[profil] ?? PROFILS.direction).ecrans;
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
      const lignes = [
        {
          id: `${folioId}-1`,
          libelle: `Hébergement ${nb} nuit${nb > 1 ? 's' : ''} — ${resa.formule}`,
          montant: montantHebergement(chambre.type, resa.formule, resa.occupants, nb),
          type: 'hebergement',
          // Le payeur par défaut suit la nature du client : une entreprise
          // règle l'hébergement, un particulier se règle lui-même. La ligne
          // reste modifiable une par une dans la Caisse.
          payeur: resa.societeId ? 'societe' : 'client',
        },
        {
          id: `${folioId}-2`,
          libelle: `Taxe de séjour (${resa.occupants} pers. × ${nb} nuit${nb > 1 ? 's' : ''})`,
          montant: montantTaxeSejour(resa.occupants, nb),
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
      return { ...next, journal: journal(next, `Check-in — ${resa.client}, chambre ${resa.chambre}`, 'jade') };
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
      return { ...next, journal: journal(next, `Check-out — ${sejour.client}, chambre ${sejour.chambre} · facture ${factureId}`, 'neutral') };
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
            depart: action.payload.depart,
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
      return { ...next, journal: journal(next, `Réservation — ${action.payload.client}, chambre ${action.payload.chambre}`, 'maj') };
    }

    case 'CANCEL_RESERVATION': {
      const next = {
        ...state,
        reservations: state.reservations.map((r) => (r.id === action.id ? { ...r, statut: 'annulee' } : r)),
      };
      return { ...next, journal: journal(next, `Réservation annulée — ${action.client ?? action.id}`, 'crimson') };
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
        journal: journal(next, `Table ${commande.table} encaissée — ${totalCommande(commande)} MAD (${action.moyen.toLowerCase()})`, 'jade'),
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
      return { ...next, journal: journal(next, `Encaissement ${montant} MAD — folio ${folio.id} (${action.moyen.toLowerCase()})`, 'jade') };
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
      return { ...next, journal: journal(next, `Facture ${numero} émise — ${folio.client}`, 'neutral') };
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
      return { ...next, journal: journal(next, `Séminaire confirmé — ${evt.entreprise} · acompte ${acompte} MAD (${numero})`, 'terra') };
    }

    // Action unique du POS : crée ou met à jour la commande d'une table puis
    // l'envoie en chambre (écriture folio) ou l'encaisse. Un seul point
    // d'écriture = pas de commande orpheline entre deux dispatchs.
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
        return { ...next, journal: journal(next, `Table ${table} encaissée — ${total} MAD (${String(moyen).toLowerCase()})`, 'jade') };
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
          `Répartition de facturation — folio ${action.folioId} : ligne affectée au ${action.payeur}`,
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

      const prix = prixNuit(chambre.type, sejour.formule, sejour.occupants);
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
          `Prolongation d’une nuit — ${sejour.client}, chambre ${sejour.chambre} (${prix} MAD facturés au client)`,
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
          lignes: r.lignes.map((l) => ({ libelle: l.libelle, montant: l.montant, tva: tvaDeLigne(l) })),
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
          `Facturation ${folio.chambre} — ${emises.map((f) => `${f.id} (${f.client})`).join(' + ')}`,
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
          `Shift ${tournee.shift} clôturé par ${tournee.agent} — rapport disponible pour ${suivante.label}`,
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

    case 'SET_PROFIL':
      return { ...state, profil: action.payload };

    case 'CLOSE_DAY': {
      const noShows = state.reservations.filter((r) => r.arrivee === state.date && r.statut === 'confirmee');
      const next = {
        ...state,
        date: isoAdd(state.date, 1),
        reservations: state.reservations.map((r) =>
          r.arrivee === state.date && r.statut === 'confirmee' ? { ...r, statut: 'no_show' } : r,
        ),
        journal: [
          {
            id: `J-close-${state.date}`,
            heure: fmtHeure(),
            texte: `Journée du ${state.date} clôturée — ${noShows.length} non-présentation(s) enregistrée(s)`,
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
    return TYPES_CHAMBRE[chambre?.type]?.prix ?? 0;
  };
  const totalNuit = [...restants, ...arrivees].reduce((sum, s) => sum + prix(s), 0);
  const adr = Math.round(totalNuit / Math.max(1, vendues));
  const revpar = Math.round((adr * occupation) / 100);

  const caHebergement = [...restants, ...arrivees].reduce((sum, s) => {
    const ch = state.chambres.find((c) => c.numero === s.chambre);
    return sum + montantHebergement(ch?.type, s.formule, s.occupants, 1);
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
