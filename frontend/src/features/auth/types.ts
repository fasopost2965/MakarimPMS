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
