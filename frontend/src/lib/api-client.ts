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

// CH-011 : GET /auth/me exige un Bearer (contrairement au reste du module
// auth) — un préfixe "/auth/" générique traiterait à tort son 401 comme un
// mauvais mot de passe et ne tenterait jamais de refresh. Liste explicite
// plutôt qu'un préfixe, pour ne plus jamais avoir ce même angle mort si une
// future route non publique s'ajoute sous /auth/.
const PUBLIC_AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/roles-actifs',
];

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
  // Les routes publiques du module auth (login, refresh, forgot/reset-
  // password, roles-actifs) ne doivent jamais déclencher une tentative de
  // refresh sur un 401 (ex. mauvais mot de passe) — l'erreur réelle doit
  // remonter telle quelle. GET /auth/me n'en fait pas partie (CH-011) : un
  // 401 dessus peut légitimement venir d'un access token expiré.
  const isAuthEndpoint = PUBLIC_AUTH_ENDPOINTS.includes(path);
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

  // NestJS envoie un corps vide (pas le littéral "null") aussi bien pour un
  // 204 explicite que pour un handler qui renvoie `null`/`undefined` sur un
  // autre statut (ex. GET .../self-checkin-pending) — res.json() sur un
  // corps vide lève "Unexpected end of JSON input" dans ce dernier cas.
  // Détecté en implémentant CH-007 (docs/governance/REGISTRE_CHANTIERS.md) :
  // bug latent déjà présent (jamais déclenché) dans le pré-remplissage
  // self-checkin de PoliceRecordForm, corrigé ici une seule fois pour tous
  // les appelants plutôt que contourné localement.
  const text = await res.text();
  return text.length === 0 ? (undefined as T) : (JSON.parse(text) as T);
}

// Téléchargement de fichiers non-JSON (ex. exports CSV du module reporting)
// nécessitant l'en-tête d'authentification — un simple <a href> ne peut pas
// porter l'Authorization Bearer, donc on fetch en blob et on déclenche le
// téléchargement navigateur nous-mêmes.
export async function apiRequestBlob(
  path: string,
  filename: string,
): Promise<void> {
  const accessToken = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `Erreur ${res.status}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
