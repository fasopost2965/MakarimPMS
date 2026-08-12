import type { HousekeepingTask, PaginatedResponse } from './types';
import type { PrioriteTicket } from '../maintenance/types';

// F9 (déjà implémenté côté backend) — l'app mobile housekeeping utilise un
// jeton Bearer à portée réduite (AuthService.loginMobile, scope
// "mobile-housekeeping"), jamais le flux cookie/CSRF de lib/api-client.ts
// (CsrfGuard s'efface lui-même en l'absence de cookie d'accès — voir son
// commentaire — un client Bearer pur n'a jamais besoin d'en-tête CSRF).
// Client HTTP dédié et minimal plutôt que de réutiliser apiRequest(), qui
// suppose toujours des cookies + refresh automatique, inapplicable ici (F9 :
// "sans refresh token", ré-authentification simple à l'expiration).
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function mobileRequest<T>(
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;
    const err = new Error(message ?? `Erreur ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const text = await res.text();
  return text.length === 0 ? (undefined as T) : (JSON.parse(text) as T);
}

export function mobileLogin(email: string, motDePasse: string) {
  return mobileRequest<{ accessToken: string }>(
    '/mobile/housekeeping/login',
    null,
    { method: 'POST', body: JSON.stringify({ email, motDePasse }) },
  );
}

// B0.4B — remplace listMobileRooms()/updateMobileRoomStatus() (sélecteur
// libre de StatutChambre, retiré de l'UI) par le workflow HousekeepingTask
// déjà exposé côté backend (B0.4A). GET tasks/mine force toujours
// assignedUserId au user connecté côté serveur (anti-IDOR) — aucun
// paramètre de filtre par utilisateur n'existe ici côté client.
export function listMyTasks(token: string) {
  return mobileRequest<PaginatedResponse<HousekeepingTask>>(
    '/mobile/housekeeping/tasks/mine?active=true&limit=100',
    token,
  );
}

// B0.4B suite (Supervisor Inspection Queue Fix) — file de tâches TERMINEE
// tous agents confondus, réservée à housekeeping:control côté serveur
// (403 sinon). Contrairement à listMyTasks(), aucun filtre par utilisateur
// n'existe ni côté client ni côté serveur : c'est précisément l'inverse de
// tasks/mine. Ne jamais utiliser le statut HTTP d'une seule requête comme
// preuve de capacité stockée : c'est l'appelant (HousekeepingMobileApp) qui
// sonde cet endpoint à chaque session pour décider d'afficher ou non
// l'espace inspection — voir son commentaire dédié.
export function listInspectionQueue(token: string) {
  return mobileRequest<PaginatedResponse<HousekeepingTask>>(
    '/mobile/housekeeping/tasks/to-inspect?limit=100',
    token,
  );
}

export function startTask(token: string, id: number) {
  return mobileRequest<HousekeepingTask>(
    `/mobile/housekeeping/tasks/${id}/start`,
    token,
    { method: 'POST' },
  );
}

export function completeTask(token: string, id: number) {
  return mobileRequest<HousekeepingTask>(
    `/mobile/housekeeping/tasks/${id}/complete`,
    token,
    { method: 'POST' },
  );
}

export function validateTask(token: string, id: number, motif: string) {
  return mobileRequest<HousekeepingTask>(
    `/mobile/housekeeping/tasks/${id}/validate`,
    token,
    { method: 'POST', body: JSON.stringify({ motif }) },
  );
}

export function refuseTask(token: string, id: number, motif: string) {
  return mobileRequest<HousekeepingTask>(
    `/mobile/housekeeping/tasks/${id}/refuse`,
    token,
    { method: 'POST', body: JSON.stringify({ motif }) },
  );
}

export interface ReportIncidentPayload {
  roomId: number;
  typePanne: string;
  priorite?: PrioriteTicket;
}

// Délègue à MaintenanceService.createTicket() côté backend — crée un vrai
// MaintenanceTicket, jamais d'écriture directe de Room.statut. Pas de champ
// photoUrl ici : capture photo mobile (accès caméra, encodage data URI,
// validation de taille) volontairement hors périmètre B0.4B pour rester
// dans le minimal nécessaire (le DTO backend l'accepte déjà si un futur lot
// l'ajoute).
export function reportIncident(token: string, payload: ReportIncidentPayload) {
  return mobileRequest<unknown>('/mobile/housekeeping/incidents', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
