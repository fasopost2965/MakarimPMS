// CH-026(e) — POST /auth/login ne renvoie plus les jetons access/refresh
// dans le corps de la réponse (posés comme cookies httpOnly par le backend,
// docs/security/CH-026E_NOTE_CONCEPTION_COOKIES_HTTPONLY.md). `csrfToken`
// reste dans le corps (jamais dans un cookie lisible en JS cross-origine,
// voir lib/token-storage.ts) : c'est l'unique canal par lequel le frontend
// obtient la valeur à renvoyer dans l'en-tête X-CSRF-Token.
export interface LoginResponse {
  ok: true;
  csrfToken: string;
}

export interface RoleActif {
  id: number;
  nom: string;
}

// CH-002 (docs/governance/REGISTRE_CHANTIERS.md) : le backend n'expose plus
// jamais le jeton de réinitialisation dans la réponse HTTP (envoyé
// uniquement par email désormais) — le contrat de réponse est strictement
// identique que le compte existe ou non.
export interface ForgotPasswordResponse {
  message: string;
}

// CH-011 — identité + permissions effectives de l'utilisateur courant
// (backend/src/modules/auth/auth.service.ts, AuthService.me()). `permissions`
// est une liste à plat de chaînes "module:action" (ex. "hr:read",
// "guests:blacklist") — jamais interprétée côté client autrement que par
// une recherche exacte dans ce tableau.
// CH-026(e) — `csrfToken` (voir LoginResponse ci-dessus) transite aussi ici :
// c'est l'appel que App.tsx déclenche déjà à chaque montage, seul moyen de
// récupérer la valeur après un rechargement de page (perdue avec le
// contexte JS précédent, voir lib/token-storage.ts).
export interface CurrentUser {
  id: number;
  email: string;
  roleId: number;
  roleName: string;
  permissions: string[];
  csrfToken: string | null;
}
