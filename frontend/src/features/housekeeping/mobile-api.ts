import type { StatutChambre } from '../reservations/types';

// F9 (déjà implémenté côté backend) — l'app mobile housekeeping utilise un
// jeton Bearer à portée réduite (AuthService.loginMobile, scope
// "mobile-housekeeping"), jamais le flux cookie/CSRF de lib/api-client.ts
// (CsrfGuard s'efface lui-même en l'absence de cookie d'accès — voir son
// commentaire — un client Bearer pur n'a jamais besoin d'en-tête CSRF).
// Client HTTP dédié et minimal plutôt que de réutiliser apiRequest(), qui
// suppose toujours des cookies + refresh automatique, inapplicable ici (F9 :
// "sans refresh token", ré-authentification simple à l'expiration).
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface MobileRoomSummary {
  id: number;
  numero: string;
  statut: StatutChambre;
  typeChambre: string;
}

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

export function listMobileRooms(token: string) {
  return mobileRequest<MobileRoomSummary[]>(
    '/mobile/housekeeping/rooms',
    token,
  );
}

export function updateMobileRoomStatus(
  token: string,
  id: number,
  statut: StatutChambre,
  commentaire?: string,
) {
  return mobileRequest<unknown>(
    `/mobile/housekeeping/rooms/${id}/statut`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ statut, commentaire: commentaire || undefined }),
    },
  );
}
