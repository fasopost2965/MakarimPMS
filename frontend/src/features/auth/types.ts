export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RoleActif {
  id: number;
  nom: string;
}

export interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
  expiresAt?: string;
}
