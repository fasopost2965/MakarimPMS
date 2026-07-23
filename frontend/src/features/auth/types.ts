export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
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
export interface CurrentUser {
  id: number;
  email: string;
  roleId: number;
  roleName: string;
  permissions: string[];
}
