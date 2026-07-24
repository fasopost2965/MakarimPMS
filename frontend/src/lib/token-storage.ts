// CH-026(e) (docs/security/CH-026E_NOTE_CONCEPTION_COOKIES_HTTPONLY.md) —
// les jetons JWT (access + refresh) ne transitent plus jamais par ce
// module : ils vivent exclusivement dans des cookies httpOnly posés par le
// backend, invisibles et inaccessibles au JavaScript de la page (protection
// contre le vol par XSS, motivation d'origine de ce chantier). Ce module ne
// gère plus que deux choses, ni l'une ni l'autre sensible :
//
// 1. Le jeton CSRF, gardé en mémoire (jamais en localStorage/sessionStorage
//    ni relu depuis le cookie). Corollaire découvert en vérification live
//    navigateur (voir commentaire de classe d'AuthCookieService, backend) :
//    frontend et backend vivent sur des origines distinctes (port différent
//    en dev, sous-domaine différent en prod), donc `document.cookie` sur la
//    page frontend ne peut structurellement jamais voir un cookie posé par
//    l'origine de l'API, même non httpOnly — le double-submit cookie
//    "classique" (lu directement depuis document.cookie) ne fonctionne
//    qu'en same-origin strict, pas ici. La valeur transite donc une fois
//    dans le corps JSON de login/refresh/me (voir lib/api-client.ts) et
//    n'est conservée qu'en mémoire JS (perdue — volontairement — à chaque
//    rechargement de page ; App.tsx la re-récupère alors via son appel
//    existant à GET /auth/me).
// 2. Un indicateur non sensible d'authentification optimiste — jamais
//    utilisé pour une décision de sécurité, seulement pour éviter un flash
//    de l'écran de connexion avant que App.tsx ait confirmé l'état réel via
//    GET /auth/me (déjà appelé au premier rendu pour les permissions
//    CH-011).

const LOGGED_IN_HINT_KEY = 'makarim_logged_in_hint';

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function setLoggedInHint(): void {
  localStorage.setItem(LOGGED_IN_HINT_KEY, '1');
}

export function clearLoggedInHint(): void {
  localStorage.removeItem(LOGGED_IN_HINT_KEY);
}

export function hasLoggedInHint(): boolean {
  return localStorage.getItem(LOGGED_IN_HINT_KEY) === '1';
}
