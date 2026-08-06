import { clearLoggedInHint, getCsrfToken, setCsrfToken } from './token-storage';

// MX-002A — avant cette classe, apiRequest ne préservait que `body.message`
// sur une erreur HTTP : toute donnée métier structurée renvoyée par le
// backend (ex. StayController POST /stays/:id/extend, `{code:
// "ROOM_UNAVAILABLE", alternatives: [...]}` ou `{code: "PAYMENT_REQUIRED",
// amountRequired, availableCredit}`, voir stay.service.ts) était
// silencieusement perdue. `ApiError extends Error` : tout code appelant
// existant qui fait `error instanceof Error` (déjà la convention partout
// dans `features/*`) continue de fonctionner sans changement. `details`
// reste `unknown` volontairement — ce fichier ne connaît pas la forme des
// corps d'erreur métier de chaque module, à chaque appelant de la
// restreindre explicitement (ex. `details as { alternatives?: Room[] }`)
// plutôt que de figer ici une interface qui fuirait dans toute l'app.
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    // Nécessaire lors de l'extension d'un built-in (Error) ciblé par le
    // `tsconfig` de ce projet — sans ceci, `instanceof ApiError` peut
    // échouer silencieusement selon la cible de compilation.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

async function parseErrorBody(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const message =
    typeof body?.message === 'string' ? body.message : `Erreur ${res.status}`;
  const code = typeof body?.code === 'string' ? body.code : undefined;
  return new ApiError(res.status, message, code, body ?? undefined);
}

// `||` et non `??` : une chaîne vide (ARG Docker non renseigné au build, voir
// frontend/Dockerfile) doit aussi retomber sur le fallback — `??` ne le fait
// que pour null/undefined, jamais pour une chaîne vide, ce qui a produit en
// déploiement réel une URL d'API RELATIVE (donc résolue vers l'origine du
// frontend lui-même) plutôt que le fallback explicite ci-dessous.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Déclenché quand le refresh échoue définitivement (refresh token absent,
// expiré ou invalide) : l'App écoute cet événement pour renvoyer
// l'utilisateur vers l'écran de connexion.
type AuthFailureListener = () => void;
let authFailureListener: AuthFailureListener | null = null;
export function onAuthFailure(listener: AuthFailureListener) {
  authFailureListener = listener;
}

// CH-011 : GET /auth/me exige un Bearer/cookie (contrairement au reste du
// module auth) — un préfixe "/auth/" générique traiterait à tort son 401
// comme un mauvais mot de passe et ne tenterait jamais de refresh. Liste
// explicite plutôt qu'un préfixe, pour ne plus jamais avoir ce même angle
// mort si une future route non publique s'ajoute sous /auth/.
const PUBLIC_AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/roles-actifs',
];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// CH-026(e) (docs/security/CH-026E_NOTE_CONCEPTION_COOKIES_HTTPONLY.md §2.2)
// — double-submit CSRF : l'en-tête X-CSRF-Token n'est requis (et n'a de
// sens) que sur les requêtes mutantes, jamais sur un GET par convention de
// ce projet (aucune route de lecture n'a d'effet de bord, cf. module
// reporting strictement read-only).
function needsCsrfHeader(method: string | undefined): boolean {
  return !SAFE_METHODS.has((method ?? 'GET').toUpperCase());
}

// Mutualise les tentatives de refresh concurrentes (plusieurs requêtes en
// 401 en même temps) pour n'appeler /auth/refresh qu'une seule fois.
let refreshPromise: Promise<boolean> | null = null;

// CH-026(e) — le refresh token part désormais via son propre cookie httpOnly
// (credentials: 'include'), plus dans le corps de la requête ; la réponse
// pose directement les nouveaux cookies (access/refresh/CSRF) via
// Set-Cookie, rien à réécrire côté client pour ceux-là — le navigateur s'en
// charge lui-même. Le cookie CSRF est en revanche régénéré à chaque refresh
// (AuthCookieService.setAuthCookies) : sa nouvelle valeur doit être captée
// depuis le corps JSON (jamais lisible via document.cookie, cross-origine —
// voir lib/token-storage.ts) et remplacer l'ancienne en mémoire, sous peine
// de renvoyer un en-tête X-CSRF-Token périmé sur la requête suivante.
async function refreshAccessToken(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: needsCsrfHeader('POST')
      ? { 'X-CSRF-Token': getCsrfToken() ?? '' }
      : {},
  });
  if (!res.ok) return false;
  const body = (await res.json().catch(() => null)) as {
    csrfToken?: string;
  } | null;
  if (body?.csrfToken) setCsrfToken(body.csrfToken);
  return true;
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

  // CH-022 : un corps FormData (upload multipart, document-ocr) ne doit
  // jamais recevoir un Content-Type imposé manuellement — fetch calcule
  // lui-même l'en-tête exact (avec la boundary) à partir du FormData. Fixer
  // 'application/json' ici casserait silencieusement tout upload de fichier.
  const isFormData = init?.body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    // CH-026(e) — les cookies d'authentification httpOnly ne partent que si
    // le navigateur y est explicitement autorisé sur une requête
    // cross-origin (frontend et backend sur des origines distinctes en dev
    // comme en prod, voir docs/operations/CH-026E_DEPLOIEMENT_DOMAINE.md).
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(needsCsrfHeader(init?.method)
        ? { 'X-CSRF-Token': getCsrfToken() ?? '' }
        : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401 && !isAuthEndpoint && !_retried) {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const refreshed = await refreshPromise;
    if (refreshed) {
      return apiRequest<T>(path, init, true);
    }
    clearLoggedInHint();
    authFailureListener?.();
    throw new Error('Session expirée, veuillez vous reconnecter.');
  }

  if (!res.ok) {
    throw await parseErrorBody(res);
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

// CH-026(f) — révoque le refresh token courant côté serveur avant que
// l'App n'efface l'indicateur de connexion local. Best-effort : une
// déconnexion doit toujours réussir côté client même si l'appel réseau
// échoue (backend indisponible, jeton déjà expiré) — AuthService.logout()
// est de toute façon idempotent. CH-026(e) : le refresh token part via son
// propre cookie httpOnly, plus par un corps de requête explicite.
export async function logoutRequest(): Promise<void> {
  try {
    await apiRequest<void>('/auth/logout', { method: 'POST' });
  } catch {
    // Ignoré volontairement — voir commentaire ci-dessus.
  }
}

// Téléchargement de fichiers non-JSON (ex. exports CSV du module reporting)
// — un simple <a href> ne peut pas porter les cookies d'authentification
// httpOnly sur une requête cross-origin sans credentials explicites, donc
// on fetch en blob et on déclenche le téléchargement navigateur nous-mêmes.
export async function apiRequestBlob(
  path: string,
  filename: string,
): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include' });

  if (!res.ok) {
    throw await parseErrorBody(res);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
