// DESIGN-005 — données mockées LOCALEMENT pour les 3 prototypes desktop
// uniquement. Aucun appel réseau ici (voir README.md du dossier). Les
// formes sont calquées sur les vrais contrats API pour que la comparaison
// visuelle reste honnête sur ce qui est réellement affichable en prod.

// ---------------------------------------------------------------------------
// Miroir de DashboardResume (GET /dashboard/resume) — REAL.
export interface MockDashboardResume {
  tauxOccupation: number;
  chambresOccupees: number;
  totalChambres: number;
  arriveesAujourdhui: number;
  departsAujourdhui: number;
  chambresANettoyer: number;
  encaisseAujourdhui: string;
}

export const mockResume: MockDashboardResume = {
  tauxOccupation: 79.2,
  chambresOccupees: 19,
  totalChambres: 24,
  arriveesAujourdhui: 5,
  departsAujourdhui: 3,
  chambresANettoyer: 4,
  encaisseAujourdhui: '18450.00',
};

// ---------------------------------------------------------------------------
// Miroir partiel de Room (GET /rooms) — REAL (déjà utilisé par
// RoomsToCleanWidget).
export interface MockRoom {
  id: number;
  numero: string;
  etage: number | null;
  statut:
    | 'LIBRE_PROPRE'
    | 'OCCUPEE'
    | 'A_NETTOYER'
    | 'EN_NETTOYAGE'
    | 'EN_MAINTENANCE';
}

export const mockRooms: MockRoom[] = [
  { id: 1, numero: '101', etage: 1, statut: 'A_NETTOYER' },
  { id: 2, numero: '104', etage: 1, statut: 'EN_NETTOYAGE' },
  { id: 3, numero: '208', etage: 2, statut: 'A_NETTOYER' },
  { id: 4, numero: '212', etage: 2, statut: 'EN_MAINTENANCE' },
];

// Liste déterministe des `mockResume.totalChambres` (24) chambres —
// utilisée par le Prototype D pour que la grille "État des chambres" et les
// KPI dérivés (ex. "Chambres propres libres") restent mutuellement
// cohérents (mêmes chiffres partout), plutôt que deux approximations
// indépendantes. Les 4 premières reprennent `mockRooms` ci-dessus tel
// quel ; le reste complète jusqu'à `chambresOccupees` occupées et le solde
// en LIBRE_PROPRE — cohérent avec `mockResume` (DERIVED, pas une nouvelle
// donnée).
export const mockAllRooms: MockRoom[] = (() => {
  const rooms = [...mockRooms];
  const occupiedAlready = rooms.filter((r) => r.statut === 'OCCUPEE').length;
  let occupiedRemaining = mockResume.chambresOccupees - occupiedAlready;
  for (let i = rooms.length; i < mockResume.totalChambres; i++) {
    const numero = String(100 + i + 1);
    const etage = Math.floor(i / 8) + 1;
    if (occupiedRemaining > 0) {
      rooms.push({ id: i + 1, numero, etage, statut: 'OCCUPEE' });
      occupiedRemaining--;
    } else {
      rooms.push({ id: i + 1, numero, etage, statut: 'LIBRE_PROPRE' });
    }
  }
  return rooms;
})();

// ---------------------------------------------------------------------------
// Miroir partiel de MaintenanceTicket (GET /maintenance-tickets) — REAL
// (déjà utilisé par OpenMaintenanceWidget).
export interface MockTicket {
  id: number;
  roomNumero: string | null;
  typePanne: string;
  priorite: 'BASSE' | 'MOYENNE' | 'HAUTE' | 'URGENTE';
}

export const mockTickets: MockTicket[] = [
  {
    id: 1,
    roomNumero: '212',
    typePanne: 'Climatisation en panne',
    priorite: 'URGENTE',
  },
  {
    id: 2,
    roomNumero: '305',
    typePanne: 'Robinet qui fuit',
    priorite: 'MOYENNE',
  },
  {
    id: 3,
    roomNumero: '110',
    typePanne: 'Ampoule salle de bain',
    priorite: 'BASSE',
  },
];

// ---------------------------------------------------------------------------
// Miroir de JourAgrege (dérivé de GET /reporting/yield-forecast) — REAL.
export interface MockForecastDay {
  date: string;
  label: string;
  tauxOccupation: number;
  chambresOccupees: number;
  totalChambres: number;
}

export const mockForecast: MockForecastDay[] = [
  {
    date: '2026-08-12',
    label: 'mer. 12',
    tauxOccupation: 79,
    chambresOccupees: 19,
    totalChambres: 24,
  },
  {
    date: '2026-08-13',
    label: 'jeu. 13',
    tauxOccupation: 83,
    chambresOccupees: 20,
    totalChambres: 24,
  },
  {
    date: '2026-08-14',
    label: 'ven. 14',
    tauxOccupation: 92,
    chambresOccupees: 22,
    totalChambres: 24,
  },
  {
    date: '2026-08-15',
    label: 'sam. 15',
    tauxOccupation: 96,
    chambresOccupees: 23,
    totalChambres: 24,
  },
  {
    date: '2026-08-16',
    label: 'dim. 16',
    tauxOccupation: 88,
    chambresOccupees: 21,
    totalChambres: 24,
  },
  {
    date: '2026-08-17',
    label: 'lun. 17',
    tauxOccupation: 71,
    chambresOccupees: 17,
    totalChambres: 24,
  },
  {
    date: '2026-08-18',
    label: 'mar. 18',
    tauxOccupation: 67,
    chambresOccupees: 16,
    totalChambres: 24,
  },
];

// ---------------------------------------------------------------------------
// Miroir de RoleActif (GET /auth/roles-actifs) — REAL, déjà utilisé par
// LoginPage. Réutilisé ici comme base honnête pour l'entrée "par espace
// métier" : ce sont les rôles réellement seedés (voir backend/prisma/
// seed.ts), pas une invention (le PMS n'a pas de notion de "Restaurant"
// distincte du rôle RESTAURATEUR).
export interface MockRole {
  id: number;
  nom: string;
}

export const mockRoles: MockRole[] = [
  { id: 1, nom: 'Réception' },
  { id: 2, nom: 'Gouvernante' },
  { id: 3, nom: 'Comptable' },
  { id: 4, nom: 'Maintenance' },
  { id: 5, nom: 'RH' },
  { id: 6, nom: 'RESTAURATEUR' },
  { id: 7, nom: 'Administrateur' },
];

// ---------------------------------------------------------------------------
// DESIGN ONLY — aucune API "arrivées/départs nommés" n'existe sur le
// Dashboard aujourd'hui (GET /dashboard/resume ne renvoie que des compteurs,
// jamais de liste). Ces libellés simulent ce à quoi ressemblerait la liste
// SI GET /reservations/arrivals-today (déjà utilisé par CheckinPage) était
// branchée sur le Dashboard — classé NEEDS BACKEND dans le rapport pour
// cette raison précise (l'API existe ailleurs dans l'app, pas encore sur ce
// widget). Volontairement affiché avec un badge "aperçu" dans les
// prototypes pour ne jamais laisser croire que c'est déjà branché.
export const mockArrivals = [
  { nom: 'Karim El Amrani', chambre: '208', heure: '14:00' },
  { nom: 'Société Atlas Trading', chambre: '104', heure: '15:30' },
  { nom: 'Fatima Zahra Idrissi', chambre: '301', heure: '16:00' },
];

export const mockDepartures = [
  { nom: 'Youssef Bennani', chambre: '101', heure: '11:00' },
  { nom: 'Laura Martins', chambre: '212', heure: '12:00' },
];
