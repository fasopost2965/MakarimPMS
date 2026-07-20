import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './token-storage';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

// Déclenché quand le refresh échoue définitivement (refresh token absent,
// expiré ou invalide) : l'App écoute cet événement pour renvoyer
// l'utilisateur vers l'écran de connexion.
type AuthFailureListener = () => void;
let authFailureListener: AuthFailureListener | null = null;
export function onAuthFailure(listener: AuthFailureListener) {
  authFailureListener = listener;
}

// Mutualise les tentatives de refresh concurrentes (plusieurs requêtes en
// 401 en même temps) pour n'appeler /auth/refresh qu'une seule fois.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;

  const body = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
  };
  setTokens(body.accessToken, body.refreshToken);
  return body.accessToken;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  _retried = false,
): Promise<T> {
  // Les routes du module auth (login, refresh, forgot/reset-password,
  // roles-actifs) sont publiques côté backend et ne doivent jamais
  // déclencher une tentative de refresh sur un 401 (ex. mauvais mot de
  // passe) — l'erreur réelle doit remonter telle quelle.
  const isAuthEndpoint = path.startsWith('/auth/');
  const accessToken = getAccessToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401 && !isAuthEndpoint && !_retried) {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const newToken = await refreshPromise;
    if (newToken) {
      return apiRequest<T>(path, init, true);
    }
    clearTokens();
    authFailureListener?.();
    throw new Error('Session expirée, veuillez vous reconnecter.');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `Erreur ${res.status}`);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
