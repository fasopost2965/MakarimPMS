import { apiRequest } from '@/lib/api-client';
import type { AuditLogEntry, AuditLogFilters } from './types';

// CH-015 — GET /audit-logs existait déjà côté backend (AuditController,
// lecture seule, INV-AUD-001) mais n'était consommé par aucune route
// frontend.
export function searchAuditLogs(filters: AuditLogFilters) {
  const query = new URLSearchParams();
  if (filters.entite) query.set('entite', filters.entite);
  if (filters.userId !== undefined) {
    query.set('userId', String(filters.userId));
  }
  if (filters.action) query.set('action', filters.action);
  if (filters.du) query.set('du', filters.du);
  if (filters.au) query.set('au', filters.au);
  const qs = query.toString();
  return apiRequest<AuditLogEntry[]>(`/audit-logs${qs ? `?${qs}` : ''}`);
}
