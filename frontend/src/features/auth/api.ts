import { apiRequest } from '@/lib/api-client';
import type { ForgotPasswordResponse, LoginResponse, RoleActif } from './types';

export function login(email: string, motDePasse: string) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, motDePasse }),
  });
}

export function rolesActifs() {
  return apiRequest<RoleActif[]>('/auth/roles-actifs');
}

export function forgotPassword(email: string) {
  return apiRequest<ForgotPasswordResponse>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, nouveauMotDePasse: string) {
  return apiRequest<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, nouveauMotDePasse }),
  });
}
