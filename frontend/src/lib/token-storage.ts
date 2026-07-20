const ACCESS_TOKEN_KEY = "makarim_access_token";
const REFRESH_TOKEN_KEY = "makarim_refresh_token";

// Stockage simple (localStorage) pour cette itération — suffisant pour un
// flux d'auth basique (module core 5.1/5.2). Une évolution vers des cookies
// httpOnly pourra être envisagée plus tard sans changer l'API de ce module.
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
