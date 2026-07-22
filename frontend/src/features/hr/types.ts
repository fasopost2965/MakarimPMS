export type StatutTimeShift = 'NON_DEMARRE' | 'ACTIF' | 'EN_PAUSE' | 'TERMINE';
export type TypeSegment = 'TRAVAIL' | 'PAUSE';

export interface StatutCourant {
  bloqueDeconnexion: boolean;
  statut: StatutTimeShift;
  timeShiftId: number | null;
  startedAt: string | null;
}

export interface TimeShiftSegment {
  id: number;
  timeShiftId: number;
  type: TypeSegment;
  debut: string;
  fin: string | null;
}

export interface TimeShift {
  id: number;
  employeeId: number;
  statut: StatutTimeShift;
  startedAt: string;
  endedAt: string | null;
  segments: TimeShiftSegment[];
}

export interface Employee {
  id: number;
  userId: number;
  matriculeCnss: string | null;
  salaireBase: string;
  dateEmbauche: string;
  actif: boolean;
  user: { id: number; nom: string; email: string };
}

export interface CreateEmployeeInput {
  userId: number;
  matriculeCnss?: string;
  salaireBase: string;
  dateEmbauche: string;
}

export interface AjusterSegmentInput {
  nouveauDebut?: string;
  nouvelleFin?: string;
  motif: string;
}

export interface PaySlip {
  id: number;
  employeeId: number;
  mois: number;
  annee: number;
  salaireBase: string;
  indemnites: string;
  retenueCnss: string;
  retenueAmo: string;
  salaireNet: string;
  estValide: boolean;
  issuedAt: string;
  validatedById: number | null;
  chargesPatronales?: string;
}

export interface CalculerPaieInput {
  employeeId: number;
  mois: number;
  annee: number;
  indemnites?: string;
}
