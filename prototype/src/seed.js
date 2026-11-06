import {
  BASE_DATE, isoAdd, isoDiff, nuits as nbNuits,
} from './lib/date';
import { CLIENTS, PROFILS, SHIFTS, TACHES_TOURNEE, TYPES_CHAMBRE } from './data';
import { montantHebergement, montantTaxeSejour } from './lib/pricing';

// ------------------------------------------------------------------
// État initial de la démonstration — cohérent avec la cible :
// 30 chambres, 3 étages, 4 types. L'état est ensuite persisté et modifié
// par les parcours réels du prototype (check-in, commande, encaissement…).
// ------------------------------------------------------------------

export const PLAN_CHAMBRES = [
  [101, 'double'], [102, 'double'], [103, 'double'], [104, 'double'],
  [105, 'twin'], [106, 'twin'], [107, 'twin'],
  [108, 'triple'], [109, 'triple'], [110, 'triple'],
  [201, 'double'], [202, 'double'], [203, 'double'], [204, 'double'],
  [205, 'twin'], [206, 'twin'],
  [207, 'triple'], [208, 'triple'],
  [209, 'suite'], [210, 'suite'],
  [301, 'double'], [302, 'double'], [303, 'double'], [304, 'double'],
  [305, 'twin'], [306, 'twin'],
  [307, 'triple'], [308, 'triple'],
  [309, 'suite'], [310, 'suite'],
];

export const CLIENT_PAR_CHAMBRE = {
  101: { client: 'Famille El Amrani', formule: 'BB', occupants: 3, arrivee: -2, depart: 2, regle: true },
  102: { client: 'K. Schreiber', formule: 'BB', occupants: 2, arrivee: -1, depart: 3, regle: true },
  103: { client: 'S. Bennani', formule: 'RO', occupants: 1, arrivee: -2, depart: 0, regle: true },
  105: { client: 'Groupe Al Omrane', formule: 'DP', occupants: 2, arrivee: -1, depart: 4, regle: false },
  108: { client: 'M. et Mme Tazi', formule: 'DP', occupants: 2, arrivee: -2, depart: 2, regle: false },
  109: { client: 'L. Moreau', formule: 'BB', occupants: 2, arrivee: -1, depart: 5, regle: true },
  202: { client: 'A. Chakiri', formule: 'RO', occupants: 1, arrivee: -1, depart: 0, regle: true },
  204: { client: 'Groupe Attijari', formule: 'PC', occupants: 2, arrivee: -1, depart: 2, regle: false },
  207: { client: 'Famille Berrada', formule: 'DP', occupants: 3, arrivee: -3, depart: 4, regle: false },
  209: { client: 'R. El Fassi', formule: 'BB', occupants: 2, arrivee: -1, depart: 3, regle: true },
  303: { client: 'C. Dupont', formule: 'BB', occupants: 2, arrivee: -2, depart: 2, regle: true },
  305: { client: 'S. Benjelloun', formule: 'DP', occupants: 2, arrivee: -2, depart: 0, regle: false },
  306: { client: 'M. Rossi', formule: 'BB', occupants: 2, arrivee: -1, depart: 0, regle: true },
  307: { client: 'Famille Idrissi', formule: 'PC', occupants: 3, arrivee: -2, depart: 3, regle: false },
  309: { client: 'N. Haddad', formule: 'BB', occupants: 2, arrivee: -1, depart: 2, regle: true },
  310: { client: 'K. Andersen', formule: 'BB', occupants: 2, arrivee: -2, depart: 5, regle: false },
};

// Rattachement des séjours de démonstration aux fiches clients : seuls
// quelques noms sont connus, les autres afficheront une fiche « à compléter »
// — c'est exactement ce que la réception doit voir (obligation légale).
export const CLIENT_PAR_NOM = {
  'S. Bennani': 'CL-5',
  'L. Moreau': 'CL-6',
  'M. et Mme Tazi': 'CL-7',
  'K. Schreiber': 'CL-2',
  'Groupe Attijari': 'CL-3',
  'Groupe Al Omrane': 'CL-4',
};

// Arrivées du jour, chambres déjà propres et vendues.
export const ARRIVEES_JOUR = {
  106: { client: 'B. El Khattabi', formule: 'BB', occupants: 2, nuits: 2, canal: 'booking', heures: '11:20' },
  301: { client: 'M. Lahlou', formule: 'RO', occupants: 1, nuits: 1, canal: 'walkin', heures: '14:10' },
  205: { client: 'A. García', formule: 'BB', occupants: 2, nuits: 3, canal: 'booking', heures: '15:30' },
  208: { client: 'Famille Chraibi', formule: 'DP', occupants: 3, nuits: 2, canal: 'direct', heures: '17:00' },
  210: { client: 'T. Nakamura', formule: 'BB', occupants: 2, nuits: 2, canal: 'booking', heures: '19:30' },
  308: { client: 'Groupe Al Omrane', formule: 'DP', occupants: 2, nuits: 4, canal: 'direct', heures: '13:45' },
};

// Réservations futures (planning) : chambre -> liste de séjours.
export const RESAS_FUTURES = [
  { chambre: 104, arrivee: 3, nuits: 2, client: 'L. Haddad', canal: 'booking', formule: 'BB', occupants: 2 },
  { chambre: 107, arrivee: 4, nuits: 3, client: 'M. Dupuis', canal: 'booking', formule: 'BB', occupants: 2 },
  { chambre: 110, arrivee: 2, nuits: 4, client: 'Famille Alami', canal: 'direct', formule: 'DP', occupants: 3 },
  { chambre: 201, arrivee: 5, nuits: 3, client: 'S. Kadiri', canal: 'booking', formule: 'RO', occupants: 2 },
  { chambre: 206, arrivee: 1, nuits: 2, client: 'H. Alaoui', canal: 'booking', formule: 'BB', occupants: 2 },
  { chambre: 302, arrivee: 8, nuits: 3, client: 'Y. Zniber', canal: 'direct', formule: 'BB', occupants: 2 },
  { chambre: 304, arrivee: 3, nuits: 2, client: 'P. Silva', canal: 'booking', formule: 'RO', occupants: 2 },
  { chambre: 101, arrivee: 6, nuits: 3, client: 'R. Mansouri', canal: 'booking', formule: 'BB', occupants: 2 },
  { chambre: 102, arrivee: 7, nuits: 2, client: 'A. Kabbaj', canal: 'direct', formule: 'BB', occupants: 2 },
  { chambre: 105, arrivee: 8, nuits: 4, client: 'Groupe ONCF', canal: 'direct', formule: 'DP', occupants: 2 },
  { chambre: 109, arrivee: 9, nuits: 3, client: 'J. Meyer', canal: 'booking', formule: 'BB', occupants: 2 },
  { chambre: 201, arrivee: 10, nuits: 2, client: 'S. Bennani', canal: 'booking', formule: 'RO', occupants: 1 },
  { chambre: 206, arrivee: 11, nuits: 3, client: 'F. Ouazzani', canal: 'direct', formule: 'BB', occupants: 2 },
  { chambre: 209, arrivee: 12, nuits: 2, client: 'L. Bennani', canal: 'booking', formule: 'BB', occupants: 2 },
  { chambre: 303, arrivee: 9, nuits: 2, client: 'T. Ferrand', canal: 'booking', formule: 'BB', occupants: 2 },
  { chambre: 307, arrivee: 10, nuits: 3, client: 'G. Marjane', canal: 'direct', formule: 'DP', occupants: 3 },
  { chambre: 310, arrivee: 13, nuits: 1, client: 'K. Andersen', canal: 'booking', formule: 'BB', occupants: 2 },
];

const MENU_LIGNES = {
  105: [{ articleId: 6, qte: 2 }],
  204: [{ articleId: 8, qte: 2 }, { articleId: 19, qte: 2 }],
  207: [{ articleId: 9, qte: 3 }, { articleId: 20, qte: 3 }],
  307: [{ articleId: 12, qte: 3 }, { articleId: 19, qte: 3 }],
  310: [{ articleId: 2, qte: 2 }, { articleId: 10, qte: 2 }, { articleId: 21, qte: 2 }],
};

export function buildInitialState(carte = []) {
  const date = BASE_DATE;
  const chambres = [];
  const sejours = [];
  const folios = [];
  const reservations = [];

  let seqSejour = 0;
  let seqFolio = 0;
  let seqResa = 0;

  for (const [numero, type] of PLAN_CHAMBRES) {
    chambres.push({ numero: String(numero), etage: Math.floor(numero / 100), type, statut: 'propre', sejourId: null });
  }

  const chambreParNumero = (n) => chambres.find((c) => c.numero === String(n));

  // 1. Séjours en cours
  for (const [numero, info] of Object.entries(CLIENT_PAR_CHAMBRE)) {
    const chambre = chambreParNumero(numero);
    const arrivee = isoAdd(date, info.arrivee);
    const depart = isoAdd(date, info.depart);
    const nb = nbNuits(arrivee, depart);
    seqSejour += 1;
    seqFolio += 1;
    const sejourId = `S-${seqSejour}`;
    const folioId = `F-${1000 + seqFolio}`;

    // Rattachement éventuel à une entreprise : c'est lui qui autorise la
    // facturation séparée (part société / part client) dans la Caisse.
    const ficheClient = CLIENTS.find((c) => c.id === CLIENT_PAR_NOM[info.client]);
    const societeId = ficheClient?.type === 'entreprise' ? ficheClient.societeId : null;
    const payeurDefaut = societeId ? 'societe' : 'client';

    const lignes = [
      {
        id: `${folioId}-1`,
        libelle: `Hébergement ${nb} nuit${nb > 1 ? 's' : ''} — ${info.formule}`,
        montant: montantHebergement(chambre.type, info.formule, info.occupants, nb),
        type: 'hebergement',
        payeur: payeurDefaut,
      },
      {
        id: `${folioId}-2`,
        libelle: `Taxe de séjour (${info.occupants} pers. × ${nb} nuit${nb > 1 ? 's' : ''})`,
        montant: montantTaxeSejour(info.occupants, nb),
        type: 'taxe',
        payeur: payeurDefaut,
      },
    ];

    for (const [i, ligne] of (MENU_LIGNES[numero] ?? []).entries()) {
      const article = carte.find((a) => a.id === ligne.articleId);
      if (!article) continue;
      lignes.push({
        id: `${folioId}-r${i}`,
        libelle: `${ligne.qte} × ${article.nom}`,
        montant: article.prix * ligne.qte,
        type: 'restaurant',
        // Les consommations du client sur son propre compte restent à sa
        // charge, même quand l'hébergement est payé par l'entreprise.
        payeur: 'client',
      });
    }

    const total = lignes.reduce((s, l) => s + l.montant, 0);
    const paiements = info.regle
      ? [{ id: `${folioId}-p1`, moyen: 'Carte bancaire', montant: total, heure: '09:12' }]
      : [];

    folios.push({
      id: folioId,
      chambre: String(numero),
      client: info.client,
      sejourId,
      clientId: ficheClient?.id ?? null,
      societeId,
      statut: 'ouvert',
      lignes,
      paiements,
    });

    sejours.push({
      id: sejourId,
      chambre: String(numero),
      client: info.client,
      arrivee,
      depart,
      formule: info.formule,
      occupants: info.occupants,
      folioId,
      statut: 'en_cours',
      clientId: ficheClient?.id ?? null,
      societeId,
    });

    chambre.statut = 'occupee';
    chambre.sejourId = sejourId;
  }

  // 2. Arrivées du jour (chambres propres, réservation confirmée)
  for (const [numero, info] of Object.entries(ARRIVEES_JOUR)) {
    const chambre = chambreParNumero(numero);
    seqResa += 1;
    reservations.push({
      id: `R-${seqResa}`,
      chambre: String(numero),
      client: info.client,
      arrivee: date,
      depart: isoAdd(date, info.nuits),
      canal: info.canal,
      formule: info.formule,
      occupants: info.occupants,
      heure: info.heures,
      statut: 'confirmee',
      sejourId: null,
    });
    chambre.statut = 'propre';
  }

  // 3. Réservations futures
  for (const r of RESAS_FUTURES) {
    seqResa += 1;
    reservations.push({
      id: `R-${seqResa}`,
      chambre: String(r.chambre),
      client: r.client,
      arrivee: isoAdd(date, r.arrivee),
      depart: isoAdd(date, r.arrivee + r.nuits),
      canal: r.canal,
      formule: r.formule,
      occupants: r.occupants,
      heure: '',
      statut: 'confirmee',
      sejourId: null,
    });
  }

  // 4. États particuliers : ménage et hors service
  for (const numero of ['110', '304']) {
    const c = chambreParNumero(numero);
    c.statut = 'a_nettoyer';
  }
  const hs = chambreParNumero('203');
  hs.statut = 'hors_service';
  hs.note = 'Climatisation — pièce commandée';

  // 5. Commandes restaurant (2 ouvertes, 3 réglées)
  const commandes = [
    {
      id: 'C-201', table: 'T1', couverts: 2, statut: 'ouverte', heure: '12:40', folioId: null,
      lignes: [
        { articleId: 6, nom: 'Tajine poulet citron', prix: 95, qte: 2 },
        { articleId: 19, nom: 'Thé à la menthe', prix: 20, qte: 2 },
      ],
    },
    {
      id: 'C-202', table: 'T3', couverts: 4, statut: 'ouverte', heure: '13:05', folioId: null,
      lignes: [
        { articleId: 8, nom: 'Couscous royal', prix: 110, qte: 2 },
        { articleId: 12, nom: 'Brochettes mixtes', prix: 105, qte: 2 },
        { articleId: 20, nom: 'Jus d’orange pressé', prix: 25, qte: 4 },
      ],
    },
    {
      id: 'C-203', table: 'T7', couverts: 4, statut: 'reglee', heure: '12:55', folioId: null, moyen: 'Espèces',
      lignes: [
        { articleId: 7, nom: 'Tajine kefta œuf', prix: 85, qte: 2 },
        { articleId: 17, nom: 'Oranges à la cannelle', prix: 30, qte: 2 },
      ],
    },
    {
      id: 'C-204', table: 'T12', couverts: 4, statut: 'reglee', heure: '13:20', folioId: null, moyen: 'Carte bancaire',
      lignes: [
        { articleId: 10, nom: 'Poisson du jour', prix: 120, qte: 3 },
        { articleId: 21, nom: 'Eau minérale', prix: 15, qte: 3 },
      ],
    },
    {
      id: 'C-205', table: 'T5', couverts: 6, statut: 'reglee', heure: '12:10', folioId: null, moyen: 'Espèces',
      lignes: [
        { articleId: 13, nom: 'Merguez grillées', prix: 75, qte: 4 },
        { articleId: 19, nom: 'Thé à la menthe', prix: 20, qte: 4 },
      ],
    },
  ];

  // 6. Événementiel
  const evenements = [
    {
      id: 'E-1', titre: 'Séminaire Attijari — formation crédit', entreprise: 'Attijariwafa Bank',
      date: isoAdd(date, 1), creneau: 'matin', participants: 22, statut: 'confirme',
      montant: 14_240, acompte: 4_272, devis: null,
    },
    {
      id: 'E-2', titre: 'Réunion CODIR', entreprise: 'Al Omrane',
      date: isoAdd(date, 2), creneau: 'matin', participants: 12, statut: 'confirme',
      montant: 3_960, acompte: 1_188, devis: null,
    },
    {
      id: 'E-3', titre: 'Atelier qualité ISO', entreprise: 'Cabinet Fiducia',
      date: isoAdd(date, 3), creneau: 'apres-midi', participants: 16, statut: 'option',
      montant: 5_180, acompte: 0, devis: null,
    },
    {
      id: 'E-4', titre: 'Cocktail promotion 2026', entreprise: 'ENSA Tétouan',
      date: isoAdd(date, 10), creneau: 'soiree', participants: 55, statut: 'devis',
      montant: 18_400, acompte: 0, devis: null,
    },
    {
      id: 'E-5', titre: 'Formation SST', entreprise: 'Croissant Rouge',
      date: isoAdd(date, 6), creneau: 'matin', participants: 18, statut: 'confirme',
      montant: 9_720, acompte: 2_916, devis: null,
    },
  ];

  // 7. Factures déjà émises (historique de la journée) — avec le détail des
  //    lignes : sans lui, un PDF de facture n'est pas conforme (mention des
  //    prestations et ventilation de TVA obligatoires).
  const factures = [
    {
      id: 'FA-2026-0184', client: 'Al Omrane Nord', type: 'societe', payeur: 'societe',
      societe: 'Al Omrane Nord', chambre: '105', statut: 'payee', date,
      lignes: [
        { libelle: 'Hébergement 3 nuits — Demi-pension (2 pers.)', montant: 8_580, tva: 10 },
        { libelle: 'Taxe de séjour (2 pers. × 3 nuits)', montant: 18, tva: 0 },
        { libelle: 'Restaurant — 2 dîners', montant: 822, tva: 20 },
      ],
    },
    {
      id: 'FA-2026-0185', client: 'Attijariwafa Bank', type: 'societe', payeur: 'societe',
      societe: 'Attijariwafa Bank', chambre: '—', statut: 'emise', date,
      lignes: [
        { libelle: 'Location salle Martil — matinée', montant: 1_500, tva: 20 },
        { libelle: 'Pause-café 2 services (22 pers.)', montant: 770, tva: 20 },
        { libelle: 'Vidéoprojecteur + sonorisation', montant: 500, tva: 20 },
        { libelle: 'Déjeuner 3 plats (12 pers.)', montant: 1_440, tva: 20 },
      ],
    },
  ];
  for (const f of factures) f.montant = f.lignes.reduce((t, l) => t + l.montant, 0);

  // 8. Fiches de police — établies à l'arrivée pour chaque séjour en cours.
  //    `complete` exige la pièce d'identité : une fiche sans CIN ou passeport
  //    est signalée en rouge à la réception.
  const fichesPolice = sejours.map((sj, i) => {
    const cl = CLIENTS.find((c) => c.id === CLIENT_PAR_NOM[sj.client]) ?? null;
    const complete = Boolean(cl && (cl.pieceNumero ?? '').trim());
    return {
      id: `FP-${String(i + 1).padStart(4, '0')}`,
      sejourId: sj.id,
      chambre: sj.chambre,
      client: sj.client,
      clientId: cl?.id ?? null,
      type: cl?.type ?? 'particulier',
      societeId: cl?.societeId ?? null,
      nom: cl?.nom ?? sj.client,
      prenom: cl?.prenom ?? '',
      dateNaissance: cl?.dateNaissance ?? '',
      lieuNaissance: cl?.lieuNaissance ?? '',
      nationalite: cl?.nationalite ?? '',
      profession: cl?.profession ?? '',
      domicile: cl?.domicile ?? '',
      ville: cl?.ville ?? '',
      telephone: cl?.telephone ?? '',
      pieceType: cl?.pieceType ?? 'CIN',
      pieceNumero: cl?.pieceNumero ?? '',
      arrivee: sj.arrivee,
      depart: sj.depart,
      occupants: sj.occupants,
      etablieLe: sj.arrivee,
      signee: complete,
      statut: complete ? 'complete' : 'a_completer',
    };
  });

  // 9. Tours de quart : le matin est clos et signé, l'après-midi en cours,
  //    la nuit à venir. Le rapport de shift sert de cahier de transmission.
  const tournees = [
    {
      id: `TQ-${date}-matin`,
      date,
      shift: 'matin',
      agent: SHIFTS[0].agent,
      statut: 'clos',
      debut: '06:00',
      fin: '14:00',
      closLe: '14:05',
      taches: TACHES_TOURNEE.filter((t) => t.shift === 'tous' || t.shift === 'matin').map((t, i) => ({
        id: t.id, label: t.label, fait: i !== 2,
      })),
      evenements: [
        { heure: '06:40', texte: 'Chambre 203 hors service : climatisation, pièce commandée chez le frigoriste.' },
        { heure: '09:15', texte: 'Famille El Amrani (101) demande un lit d’appoint — installé, 0 MAD.' },
        { heure: '11:20', texte: 'Arrivée chambre 106 enregistrée, fiche de police à compléter (passeport non remis).' },
        { heure: '12:50', texte: 'Groupe Attijari : 2 chambres supplémentaires demandées pour demain.' },
      ],
      remarques:
        'Deux départs en retard (103 et 202) : clients encore en chambre à 14 h, prévenir le soir.',
      consignes: 'Relancer la pièce d’identité de la 106 avant 20 h. Contrôler la 110 remise en état.',
      caisse: { fond: 500, comptage: 5240, ecart: 0 },
      signe: true,
    },
    {
      id: `TQ-${date}-apres-midi`,
      date,
      shift: 'apres-midi',
      agent: SHIFTS[1].agent,
      statut: 'en_cours',
      debut: '14:00',
      fin: null,
      closLe: null,
      taches: TACHES_TOURNEE.filter((t) => t.shift === 'tous' || t.shift === 'apres-midi').map((t, i) => ({
        id: t.id, label: t.label, fait: i < 2,
      })),
      evenements: [
        { heure: '14:30', texte: 'Passage de consignes avec Salma — 2 départs en retard signalés.' },
      ],
      remarques: '',
      consignes: '',
      caisse: { fond: 500, comptage: 0, ecart: 0 },
      signe: false,
    },
    {
      id: `TQ-${date}-nuit`,
      date,
      shift: 'nuit',
      agent: SHIFTS[2].agent,
      statut: 'a_venir',
      debut: '22:00',
      fin: null,
      closLe: null,
      taches: TACHES_TOURNEE.filter((t) => t.shift === 'tous' || t.shift === 'nuit').map((t) => ({
        id: t.id, label: t.label, fait: false,
      })),
      evenements: [],
      remarques: '',
      consignes: '',
      caisse: { fond: 500, comptage: 0, ecart: 0 },
      signe: false,
    },
  ];

  // 10. Droits paramétrables : la Direction part des profils documentés et
  //     peut les ajuster depuis l'écran « Rôles & permissions ».
  const roles = Object.fromEntries(
    Object.entries(PROFILS).map(([cle, p]) => [cle, { ecrans: [...p.ecrans], montants: p.montants }]),
  );

  const clients = CLIENTS.map((c) => ({ ...c }));

  const journal = [
    { id: 'J-1', heure: '13:42', texte: 'Note restaurant 230 MAD envoyée au folio de la chambre 204', ton: 'maj' },
    { id: 'J-2', heure: '13:20', texte: 'Table T12 encaissée — 405 MAD (carte bancaire)', ton: 'jade' },
    { id: 'J-3', heure: '12:55', texte: 'Table T7 encaissée — 230 MAD (espèces)', ton: 'jade' },
    { id: 'J-4', heure: '11:20', texte: 'Arrivée enregistrée — chambre 106, B. El Khattabi', ton: 'maj' },
  ];

  return {
    date,
    // Profil RBAC actif dans la démonstration (cf. data.js > PROFILS).
    profil: 'direction',
    carte,
    chambres,
    sejours,
    reservations,
    folios,
    commandes,
    evenements,
    factures,
    // Nouveaux référentiels d'exploitation (voir data.js).
    clients,
    fichesPolice,
    tournees,
    roles,
    journal,
    seq: { sejour: seqSejour, folio: seqFolio, resa: seqResa, commande: 205, evenement: 5, facture: 185, fiche: fichesPolice.length },
  };
}

export { nbNuits };
