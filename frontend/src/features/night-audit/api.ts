import { apiRequest } from '@/lib/api-client';
import type {
  NightAuditCurrent,
  NightAuditHistoryEntry,
  NightAuditReport,
  NightAuditRun,
} from './types';

export function getCurrent() {
  return apiRequest<NightAuditCurrent>('/night-audit/current');
}

export function getHistory() {
  return apiRequest<NightAuditHistoryEntry[]>('/night-audit/history');
}

export function getReport(runId: number) {
  return apiRequest<NightAuditReport>(`/night-audit/${runId}/report`);
}

export function startNightAudit() {
  return apiRequest<NightAuditRun>('/night-audit/start', { method: 'POST' });
}

export function revalidate(runId: number) {
  return apiRequest<NightAuditRun>(`/night-audit/${runId}/revalidate`, {
    method: 'POST',
  });
}

export function acknowledgeWarning(
  runId: number,
  exceptionId: number,
  motif: string,
) {
  return apiRequest<unknown>(
    `/night-audit/${runId}/exceptions/${exceptionId}/acknowledge`,
    { method: 'POST', body: JSON.stringify({ motif }) },
  );
}

export function posting(runId: number) {
  return apiRequest<NightAuditRun>(`/night-audit/${runId}/posting`, {
    method: 'POST',
  });
}

export function reconcile(runId: number) {
  return apiRequest<NightAuditRun>(`/night-audit/${runId}/reconcile`, {
    method: 'POST',
  });
}

export function prepareClosing(runId: number) {
  return apiRequest<NightAuditRun>(`/night-audit/${runId}/prepare-closing`, {
    method: 'POST',
  });
}

export function closeNightAudit(runId: number, motif: string) {
  return apiRequest<NightAuditRun>(`/night-audit/${runId}/close`, {
    method: 'POST',
    body: JSON.stringify({ motif }),
  });
}
