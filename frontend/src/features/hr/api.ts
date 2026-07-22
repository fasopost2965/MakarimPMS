import { apiRequest } from '@/lib/api-client';
import type {
  AjusterSegmentInput,
  CalculerPaieInput,
  CreateEmployeeInput,
  Employee,
  PaySlip,
  StatutCourant,
  TimeShift,
} from './types';

// Pointage self-service — dérivé du JWT côté serveur, jamais d'employeeId
// transmis (voir AttendanceController côté backend).
export function demarrerService() {
  return apiRequest<TimeShift>('/rh/attendance/demarrer', { method: 'POST' });
}

export function mettreEnPause() {
  return apiRequest<TimeShift>('/rh/attendance/pause', { method: 'POST' });
}

export function reprendreService() {
  return apiRequest<TimeShift>('/rh/attendance/reprendre', { method: 'POST' });
}

export function terminerService() {
  return apiRequest<TimeShift>('/rh/attendance/terminer', { method: 'POST' });
}

export function statutCourant() {
  return apiRequest<StatutCourant>('/rh/attendance/statut-courant');
}

// Administration RH (permission `rh`).
export function listEmployees() {
  return apiRequest<Employee[]>('/rh/employees');
}

export function createEmployee(input: CreateEmployeeInput) {
  return apiRequest<Employee>('/rh/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function historiqueEmployee(employeeId: number) {
  return apiRequest<TimeShift[]>(`/rh/attendance/employees/${employeeId}`);
}

export function ajusterSegment(segmentId: number, input: AjusterSegmentInput) {
  return apiRequest<TimeShift>(`/rh/attendance/segments/${segmentId}/ajuster`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function calculerPaie(input: CalculerPaieInput) {
  return apiRequest<PaySlip>('/rh/payroll/calculate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function validerPaie(id: number) {
  return apiRequest<PaySlip>(`/rh/payroll/${id}/valider`, { method: 'PATCH' });
}

export function listSlipsValides(employeeId?: number) {
  const qs = employeeId ? `?employeeId=${employeeId}` : '';
  return apiRequest<PaySlip[]>(`/rh/payroll/slips${qs}`);
}
