import { apiRequest, apiRequestBlob } from '@/lib/api-client';
import type {
  PoliceRecord,
  SelfCheckinPending,
  UpsertPoliceRecordInput,
} from './types';

// GET /police/:stayId renvoie 404 tant qu'aucune fiche n'a été saisie —
// traité comme "pas encore de fiche" plutôt que comme une erreur (seul mode
// d'échec réel de cette route pour un stayId valide).
export async function getPoliceRecord(
  stayId: number,
): Promise<PoliceRecord | null> {
  try {
    return await apiRequest<PoliceRecord>(`/police/${stayId}`);
  } catch {
    return null;
  }
}

export function upsertPoliceRecord(
  stayId: number,
  input: UpsertPoliceRecordInput,
) {
  return apiRequest<PoliceRecord>(`/police/${stayId}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function downloadPoliceRecordPdf(stayId: number) {
  return apiRequestBlob(
    `/police/${stayId}/pdf`,
    `fiche-police-sejour-${stayId}.pdf`,
  );
}

// F6 — données pré-remplies par le client via le lien de self check-in
// (voir docs/governance/..., self-checkin.md). Null si le séjour ne vient
// pas d'une réservation, ou si aucune soumission self-checkin n'existe.
export async function getSelfCheckinPending(
  reservationId: number,
): Promise<SelfCheckinPending | null> {
  return apiRequest<SelfCheckinPending | null>(
    `/reservations/${reservationId}/self-checkin-pending`,
  );
}
