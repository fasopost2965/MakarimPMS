// ------------------------------------------------------------------
// Référentiels statiques du prototype — alignés sur la documentation :
// - Hôtel 3★, Tétouan, usage interne (docs/Cahier des charges final, §1)
// - ADR 3★ retenu 600 MAD (docs/modelisation_revenus_pms_makarim.xlsx)
// - TVA 10 % hébergement & pensions, 20 % prestations annexes / restauration
//   à la carte (cahier des charges §3.5.1)
// - Taxe de séjour 3 MAD / nuit / adulte, paramétrable (seed.ts)
// Volumétrie cible : 30 chambres, 1 restaurant (48 couverts), 1 salle.
// ------------------------------------------------------------------

export const HOTEL = {
  nom: 'Hôtel Makarim',
  categorie: '3 étoiles',
  ville: 'Tétouan',
  adresse: 'Avenue Mohammed V, Tétouan 93000',
  chambres: 30,
  devise: 'MAD',
  fuseau: 'Africa/Casablanca',
};

export const UTILISATEUR = {
  nom: 'Youssef Benali',
  initiales: 'YB',
  role: 'Réception · Chef de shift',
};

export const PARAMS = {
  taxeSejour: 3, // MAD / nuit / adulte — barème dépendant de la catégorie et de la commune
  tvaHebergement: 10,
  tvaAnnexe: 20,
  tvaSalle: 20,
  acompteEvenement: 30,
  plafondEspeces: 10_000,
};

export const TYPES_CHAMBRE = {
  double: { label: 'Double Standard', court: 'Double', prix: 500, capacite: 2 },
  twin: { label: 'Twin', court: 'Twin', prix: 550, capacite: 2 },
  triple: { label: 'Triple familiale', court: 'Triple', prix: 650, capacite: 3 },
  suite: { label: 'Suite junior', court: 'Suite', prix: 850, capacite: 3 },
};

export const STATUTS_CHAMBRE = {
  occupee: { label: 'Occupée', dot: 'bg-maj', chip: 'bg-maj-100 text-maj' },
  propre: { label: 'Libre propre', dot: 'bg-jade', chip: 'bg-jade-100 text-jade' },
  a_nettoyer: { label: 'À nettoyer', dot: 'bg-saffron', chip: 'bg-saffron-100 text-saffron' },
  hors_service: { label: 'Hors service', dot: 'bg-crimson', chip: 'bg-crimson-100 text-crimson' },
};

// Suppléments par personne et par nuit (cahier des charges §3.5.1 :
// petit-déjeuner, demi-pension et pension complète restent à 10 %).
export const FORMULES = [
  { code: 'RO', label: 'Logement seul', supplement: 0 },
  { code: 'BB', label: 'Petit-déjeuner', supplement: 60 },
  { code: 'DP', label: 'Demi-pension', supplement: 180 },
  { code: 'PC', label: 'Pension complète', supplement: 260 },
];

export const CANAUX = {
  walkin: { label: 'Walk-in', classe: 'bg-terra-100 text-terra border-terra/25', dot: 'bg-terra' },
  direct: { label: 'Direct', classe: 'bg-jade-100 text-jade border-jade/25', dot: 'bg-jade' },
  booking: { label: 'Booking.com', classe: 'bg-maj-100 text-maj border-maj/25', dot: 'bg-maj' },
};

// Profils RBAC du prototype — miroir de la matrice corrigée (voir
// docs/RBAC_MATRIX.md et la revue de cohérence des règles).
// `ecrans` = écrans accessibles, `montants` = autorisation de voir les montants.
export const PROFILS = {
  direction: {
    label: 'Direction',
    personne: 'Youssef Benali',
    initiales: 'YB',
    accueil: 'dashboard',
    ecrans: [
      'dashboard', 'chambres', 'reservations', 'restaurant', 'conference',
      'caisse', 'documents', 'police', 'tournees', 'roles', 'tarifs',
    ],
    montants: true,
  },
  reception: {
    label: 'Réception',
    personne: 'Salma Idrissi',
    initiales: 'SI',
    accueil: 'dashboard',
    ecrans: ['dashboard', 'chambres', 'reservations', 'caisse', 'restaurant', 'police', 'tournees', 'documents'],
    montants: true,
  },
  gouvernante: {
    label: 'Gouvernante',
    personne: 'Naïma Chafik',
    initiales: 'NC',
    accueil: 'chambres',
    ecrans: ['chambres', 'tournees'],
    montants: false,
  },
  restaurant: {
    label: 'Restaurant',
    personne: 'Karim Azzouzi',
    initiales: 'KA',
    accueil: 'restaurant',
    ecrans: ['restaurant', 'tournees'],
    montants: true,
  },
  comptable: {
    label: 'Comptable',
    personne: 'Hicham Loukili',
    initiales: 'HL',
    accueil: 'caisse',
    ecrans: ['dashboard', 'caisse', 'documents', 'tarifs'],
    montants: true,
  },
  maintenance: {
    label: 'Maintenance',
    personne: 'Rachid Amrani',
    initiales: 'RA',
    accueil: 'chambres',
    ecrans: ['chambres', 'tournees'],
    montants: false,
  },
};

// ------------------------------------------------------------------
// Clients : particuliers et entreprises (BR-CLI-001, BR-CLI-006)
// Un client « entreprise » porte une raison sociale, un ICE et des
// conditions de règlement : c'est ce qui autorise la facturation à la
// société au lieu du client lui-même (voir la répartition de facturation
// dans l'écran Caisse).
// ------------------------------------------------------------------
export const TYPES_CLIENT = {
  particulier: { label: 'Particulier', chip: 'bg-sand-200 text-ink-2', dot: 'bg-ink-3' },
  entreprise: { label: 'Entreprise', chip: 'bg-maj-100 text-maj', dot: 'bg-maj' },
};

export const ENTREPRISES = [
  {
    id: 'EN-1',
    raison: 'Attijariwafa Bank',
    ice: '001648392000047',
    adresse: '2 boulevard Al Massira, Tétouan',
    contact: 'Mme Fadwa Rami — achats',
    conditions: 'Facture mensuelle, 30 jours fin de mois',
  },
  {
    id: 'EN-2',
    raison: 'Al Omrane Nord',
    ice: '002015487000031',
    adresse: 'Avenue des FAR, Tétouan',
    contact: 'M. Karim Belkacem',
    conditions: 'Facture par séjour, virement à 15 jours',
  },
  {
    id: 'EN-3',
    raison: 'Cabinet Fiducia',
    ice: '002998734000012',
    adresse: 'Rue Ibn Battouta, Tétouan',
    contact: 'Mme Salima Ouazzani',
    conditions: 'Comptant à la remise de la facture',
  },
];

// Fiches de police : les champs exigés par le registre d'hébergement
// (nom, prénom, date et lieu de naissance, nationalité, profession,
// domicile, pièce d'identité, dates de séjour). Une fiche incomplète doit
// être signalée à la réception — c'est une obligation, pas une préférence.
export const CLIENT_VIDE = {
  type: 'particulier',
  societeId: null,
  nom: '',
  prenom: '',
  dateNaissance: '',
  lieuNaissance: '',
  nationalite: 'Marocaine',
  profession: '',
  domicile: '',
  ville: '',
  telephone: '',
  email: '',
  pieceType: 'CIN',
  pieceNumero: '',
  pieceDelivreeLe: '',
};

export const CLIENTS = [
  {
    id: 'CL-1', type: 'particulier', nom: 'El Amrani', prenom: 'Yassine',
    dateNaissance: '1984-03-14', lieuNaissance: 'Tétouan', nationalite: 'Marocaine',
    profession: 'Ingénieur conseil', domicile: '18 rue Souika', ville: 'Tétouan',
    telephone: '+212 6 61 24 88 03', email: 'y.elamrani@example.ma',
    pieceType: 'CIN', pieceNumero: 'TB 841 205', pieceDelivreeLe: '2019-06-11',
  },
  {
    id: 'CL-2', type: 'particulier', nom: 'Schreiber', prenom: 'Katrin',
    dateNaissance: '1978-11-02', lieuNaissance: 'München', nationalite: 'Allemande',
    profession: 'Architecte', domicile: 'Leopoldstraße 42', ville: 'Munich',
    telephone: '+49 171 552 8890', email: 'k.schreiber@example.de',
    pieceType: 'Passeport', pieceNumero: 'C4K8L2P11', pieceDelivreeLe: '2022-02-17',
  },
  {
    id: 'CL-3', type: 'entreprise', societeId: 'EN-1', nom: 'Attijariwafa Bank', prenom: '—',
    dateNaissance: '', lieuNaissance: 'Casablanca', nationalite: 'Marocaine',
    profession: 'Établissement bancaire', domicile: '2 bd Al Massira', ville: 'Tétouan',
    telephone: '+212 5 39 96 12 00', email: 'achats.nord@example.ma',
    pieceType: 'RC', pieceNumero: 'RC 11245', pieceDelivreeLe: '',
  },
  {
    id: 'CL-4', type: 'entreprise', societeId: 'EN-2', nom: 'Al Omrane Nord', prenom: '—',
    dateNaissance: '', lieuNaissance: 'Tétouan', nationalite: 'Marocaine',
    profession: 'Aménagement urbain', domicile: 'Avenue des FAR', ville: 'Tétouan',
    telephone: '+212 5 39 97 41 20', email: 'direction@example.ma',
    pieceType: 'RC', pieceNumero: 'RC 20881', pieceDelivreeLe: '',
  },
  {
    id: 'CL-5', type: 'particulier', nom: 'Bennani', prenom: 'Sofia',
    dateNaissance: '1992-07-21', lieuNaissance: 'Rabat', nationalite: 'Marocaine',
    profession: 'Journaliste', domicile: '45 avenue Hassan II', ville: 'Rabat',
    telephone: '+212 6 12 44 71 90', email: 's.bennani@example.ma',
    pieceType: 'CIN', pieceNumero: 'RB 552 118', pieceDelivreeLe: '2021-09-03',
  },
  {
    id: 'CL-6', type: 'particulier', nom: 'Moreau', prenom: 'Léa',
    dateNaissance: '1990-01-09', lieuNaissance: 'Lyon', nationalite: 'Française',
    profession: 'Photographe', domicile: '12 rue des Capucins', ville: 'Lyon',
    telephone: '+33 6 88 41 20 55', email: 'lea.moreau@example.fr',
    pieceType: 'Passeport', pieceNumero: '21FR88410', pieceDelivreeLe: '2021-04-22',
  },
  {
    id: 'CL-7', type: 'particulier', nom: 'Tazi', prenom: 'Mehdi',
    dateNaissance: '1975-05-30', lieuNaissance: 'Fès', nationalite: 'Marocaine',
    profession: 'Commerçant', domicile: '7 derb El Horra', ville: 'Fès',
    telephone: '+212 6 70 11 22 33', email: 'm.tazi@example.ma',
    pieceType: 'CIN', pieceNumero: 'FE 118 447', pieceDelivreeLe: '2018-12-01',
  },
];

// ------------------------------------------------------------------
// Tours de quart — trois agents se relaient toutes les 8 heures. Le
// rapport de fin de shift tient lieu de cahier de transmission : ce que
// l'agent sortant signale doit être lu par l'agent entrant.
// ------------------------------------------------------------------
export const SHIFTS = [
  { cle: 'matin', label: 'Matin', plage: '06:00 → 14:00', agent: 'Salma Idrissi', role: 'Réception · Chef de shift' },
  { cle: 'apres-midi', label: 'Après-midi', plage: '14:00 → 22:00', agent: 'Omar Tazi', role: 'Réception' },
  { cle: 'nuit', label: 'Nuit', plage: '22:00 → 06:00', agent: 'Nadia El Fassi', role: 'Réception · veilleuse de nuit' },
];

export const TACHES_TOURNEE = [
  { id: 'passage', label: 'Passage des consignes avec le shift sortant', shift: 'tous' },
  { id: 'caisse', label: 'Comptage de caisse et fond de caisse vérifié', shift: 'tous' },
  { id: 'chambres', label: 'Contrôle des chambres à nettoyer', shift: 'tous' },
  { id: 'arrivees', label: 'Arrivées du jour pointées au planning', shift: 'tous' },
  { id: 'departs', label: 'Départs du jour contrôlés (folios soldés)', shift: 'tous' },
  { id: 'ronde', label: 'Ronde des étages et des issues de secours', shift: 'nuit' },
  { id: 'releve', label: 'Relevé des compteurs eau / électricité', shift: 'nuit' },
  { id: 'petitdej', label: 'Service petit-déjeuner dressé et contrôlé', shift: 'matin' },
  { id: 'menage', label: 'Point ménage avec la gouvernante', shift: 'matin' },
  { id: 'reservations', label: 'Rappel des réservations du lendemain', shift: 'apres-midi' },
  { id: 'resto', label: 'Point service avec le restaurant', shift: 'apres-midi' },
  { id: 'night-audit', label: 'Clôture de journée (night audit)', shift: 'nuit' },
];

// Catalogue des droits paramétrables par la Direction (écran « Rôles »).
export const PERMISSIONS = [
  { cle: 'dashboard', label: 'Tableau de bord', groupe: 'Pilotage' },
  { cle: 'chambres', label: 'Chambres & housekeeping', groupe: 'Exploitation' },
  { cle: 'reservations', label: 'Réservations', groupe: 'Exploitation' },
  { cle: 'restaurant', label: 'Restaurant', groupe: 'Exploitation' },
  { cle: 'conference', label: 'Salle de conférence', groupe: 'Exploitation' },
  { cle: 'police', label: 'Fiches de police', groupe: 'Réception' },
  { cle: 'tournees', label: 'Tours de quart', groupe: 'Réception' },
  { cle: 'caisse', label: 'Caisse & factures', groupe: 'Administration' },
  { cle: 'documents', label: 'Documents & PDF', groupe: 'Administration' },
  { cle: 'roles', label: 'Rôles & permissions', groupe: 'Administration' },
  { cle: 'tarifs', label: 'Tarifs & paramètres', groupe: 'Administration' },
];

export const CATEGORIES_RESTO = ['Entrées', 'Plats', 'Grillades', 'Desserts', 'Boissons'];

export const CARTE = [
  { id: 1, cat: 'Entrées', nom: 'Salade marocaine', prix: 45, dispo: true, desc: 'Tomate, poivron, cumin' },
  { id: 2, cat: 'Entrées', nom: 'Harira maison', prix: 35, dispo: true, desc: 'Vermicelles, coriandre' },
  { id: 3, cat: 'Entrées', nom: 'Briouates aux crevettes', prix: 65, dispo: true, desc: '3 pièces, chermoula' },
  { id: 4, cat: 'Entrées', nom: 'Zaalouk', prix: 40, dispo: true, desc: 'Aubergines fumées' },
  { id: 5, cat: 'Entrées', nom: 'Salade César', prix: 70, dispo: false, desc: 'Rupture — poulet attendu' },
  { id: 6, cat: 'Plats', nom: 'Tajine poulet citron', prix: 95, dispo: true, desc: 'Semoule fine' },
  { id: 7, cat: 'Plats', nom: 'Tajine kefta œuf', prix: 85, dispo: true, desc: 'Bœuf, tomate fraîche' },
  { id: 8, cat: 'Plats', nom: 'Couscous royal', prix: 110, dispo: true, desc: 'Agneau, poulet, merguez' },
  { id: 9, cat: 'Plats', nom: 'Pastilla au poulet', prix: 100, dispo: true, desc: 'Amandes, cannelle' },
  { id: 10, cat: 'Plats', nom: 'Poisson du jour', prix: 120, dispo: true, desc: 'Loup de Martil' },
  { id: 11, cat: 'Plats', nom: 'Rfissa', prix: 90, dispo: true, desc: 'Poulet beldi, triglia' },
  { id: 12, cat: 'Grillades', nom: 'Brochettes mixtes', prix: 105, dispo: true, desc: 'Bœuf, poulet, merguez' },
  { id: 13, cat: 'Grillades', nom: 'Merguez grillées', prix: 75, dispo: true, desc: 'Frites maison' },
  { id: 14, cat: 'Grillades', nom: 'Escalope grillée', prix: 85, dispo: true, desc: 'Légumes de saison' },
  { id: 15, cat: 'Grillades', nom: 'Côtelettes d’agneau', prix: 130, dispo: true, desc: '3 pièces' },
  { id: 16, cat: 'Desserts', nom: 'Pastilla au lait', prix: 45, dispo: true, desc: 'Fleur d’oranger' },
  { id: 17, cat: 'Desserts', nom: 'Oranges à la cannelle', prix: 30, dispo: true, desc: 'Fruit de saison' },
  { id: 18, cat: 'Desserts', nom: 'Cornes de gazelle', prix: 35, dispo: true, desc: '3 pièces' },
  { id: 19, cat: 'Boissons', nom: 'Thé à la menthe', prix: 20, dispo: true, desc: 'Théière individuelle' },
  { id: 20, cat: 'Boissons', nom: 'Jus d’orange pressé', prix: 25, dispo: true, desc: '25 cl' },
  { id: 21, cat: 'Boissons', nom: 'Eau minérale', prix: 15, dispo: true, desc: '50 cl' },
  { id: 22, cat: 'Boissons', nom: 'Café / expresso', prix: 18, dispo: true, desc: 'Double possible' },
];

export const TABLES = [
  { id: 'T1', couverts: 2, zone: 'Salle' },
  { id: 'T2', couverts: 2, zone: 'Salle' },
  { id: 'T3', couverts: 4, zone: 'Salle' },
  { id: 'T4', couverts: 4, zone: 'Salle' },
  { id: 'T5', couverts: 6, zone: 'Salle' },
  { id: 'T6', couverts: 2, zone: 'Terrasse' },
  { id: 'T7', couverts: 4, zone: 'Terrasse' },
  { id: 'T8', couverts: 4, zone: 'Terrasse' },
  { id: 'T9', couverts: 8, zone: 'Terrasse' },
  { id: 'T10', couverts: 2, zone: 'Terrasse' },
  { id: 'T11', couverts: 2, zone: 'Bar' },
  { id: 'T12', couverts: 4, zone: 'Bar' },
];

export const SALLE = {
  nom: 'Salle Martil',
  superficie: 90,
  capacites: [
    { format: 'Théâtre', places: 60 },
    { format: 'École', places: 40 },
    { format: 'U / réunion', places: 28 },
    { format: 'Cocktail', places: 70 },
  ],
  equipements: [
    'Vidéoprojecteur + écran 2,4 m',
    'Paperboard × 2',
    'Wi-Fi fibre dédié',
    'Climatisation',
    'Sono + 2 micros HF',
    'Terrasse pause-café 40 m²',
  ],
  tarifs: {
    locationJour: 2500,
    demiJournee: 1500,
    pauseCafe: 35,
    dejeuner: 120,
    diner: 150,
    projecteur: 300,
    paperboard: 150,
    micro: 200,
  },
};

export const PRESTATIONS_EVENEMENT = [
  { cle: 'pauseCafe', label: 'Pause-café (2 services)', prix: SALLE.tarifs.pauseCafe, type: 'pers' },
  { cle: 'dejeuner', label: 'Déjeuner 3 plats', prix: SALLE.tarifs.dejeuner, type: 'pers' },
  { cle: 'diner', label: 'Dîner de gala', prix: SALLE.tarifs.diner, type: 'pers' },
  { cle: 'projecteur', label: 'Vidéoprojecteur', prix: SALLE.tarifs.projecteur, type: 'forfait' },
  { cle: 'paperboard', label: 'Paperboard (×2)', prix: SALLE.tarifs.paperboard, type: 'forfait' },
  { cle: 'micro', label: 'Sono + 2 micros HF', prix: SALLE.tarifs.micro, type: 'forfait' },
];

export const CRENEAUX = {
  matin: 'Matin 9:00–13:00',
  'apres-midi': 'Après-midi 14:00–18:00',
  soiree: 'Soirée 19:00–23:00',
};

export const SAISONS = [
  { nom: 'Basse saison', periode: '10 janv. → 31 mars', coef: 1 },
  { nom: 'Moyenne saison', periode: '1 avril → 30 juin', coef: 1.15 },
  { nom: 'Haute saison', periode: '1 juil. → 31 août', coef: 1.38 },
  { nom: 'Épaule', periode: '1 sept. → 20 déc.', coef: 1.1 },
];

export const POLITIQUE = [
  'Annulation gratuite jusqu’à 48 h avant l’arrivée',
  'Hors délai : 1 nuit retenue (flexible) — 100 % (non remboursable)',
  'Garantie par empreinte bancaire ou acompte de 30 %',
  'Taxe de séjour 3 MAD / nuit / adulte, reversée au Trésor',
];
