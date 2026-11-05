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
    ecrans: ['dashboard', 'chambres', 'reservations', 'restaurant', 'conference', 'caisse', 'tarifs'],
    montants: true,
  },
  reception: {
    label: 'Réception',
    personne: 'Salma Idrissi',
    initiales: 'SI',
    accueil: 'dashboard',
    ecrans: ['dashboard', 'chambres', 'reservations', 'caisse', 'restaurant'],
    montants: true,
  },
  gouvernante: {
    label: 'Gouvernante',
    personne: 'Naïma Chafik',
    initiales: 'NC',
    accueil: 'chambres',
    ecrans: ['chambres'],
    montants: false,
  },
  restaurant: {
    label: 'Restaurant',
    personne: 'Karim Azzouzi',
    initiales: 'KA',
    accueil: 'restaurant',
    ecrans: ['restaurant'],
    montants: true,
  },
  comptable: {
    label: 'Comptable',
    personne: 'Hicham Loukili',
    initiales: 'HL',
    accueil: 'caisse',
    ecrans: ['dashboard', 'caisse', 'tarifs'],
    montants: true,
  },
  maintenance: {
    label: 'Maintenance',
    personne: 'Rachid Amrani',
    initiales: 'RA',
    accueil: 'chambres',
    ecrans: ['chambres'],
    montants: false,
  },
};

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
