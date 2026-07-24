import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'makarim_access_token';
export const REFRESH_TOKEN_COOKIE = 'makarim_refresh_token';
export const CSRF_TOKEN_COOKIE = 'makarim_csrf_token';

// CH-026(e) (docs/security/CH-026E_NOTE_CONCEPTION_COOKIES_HTTPONLY.md) —
// seul point d'écriture des cookies d'authentification (pose et effacement),
// réutilisé par AuthController.login/refresh (pose) et logout (efface) —
// même discipline "un seul chemin d'écriture par champ sensible" que
// RoomsService.transitionRoom / GuestsService.updateCategorie (CLAUDE.md).
//
// Jamais d'attribut `Domain` explicite : cookies host-only, scopés
// exactement au domaine de l'API (docs/operations/CH-026E_DEPLOIEMENT_DOMAINE.md
// §2) — SameSite=Lax suffit déjà à couvrir le flux entre deux sous-domaines
// partageant le même domaine enregistrable, élargir Domain exposerait
// inutilement le cookie à d'autres sous-domaines futurs.
//
// Corollaire découvert en vérification live navigateur (host-only + Path
// resserré, ci-dessus) : `document.cookie` est scopé par origine ET par
// chemin — le frontend (autre origine : autre port en dev, autre
// sous-domaine en prod) ne peut donc jamais lire directement le cookie CSRF
// non httpOnly posé sur l'origine de l'API, même s'il n'est pas httpOnly.
// `setAuthCookies` renvoie donc la valeur CSRF générée pour que
// AuthController la fasse transiter une fois dans le corps JSON de
// login/refresh/me (jamais dans un cookie à `Domain` élargi) — le frontend
// la garde ensuite en mémoire (lib/token-storage.ts), jamais en
// localStorage. Le cookie CSRF reste posé et non httpOnly : c'est lui que
// CsrfGuard compare à l'en-tête, la valeur transmise dans le corps JSON
// n'est qu'un canal de livraison au frontend.
@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService) {}

  private get secure(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ): string {
    const accessMaxAge = parseDurationMs(
      this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    );
    const refreshMaxAge = parseDurationMs(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );

    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/api',
      maxAge: accessMaxAge,
    });
    // Path resserré à /api/auth : ce cookie n'a besoin d'être envoyé qu'aux
    // routes qui le lisent (POST /auth/refresh, POST /auth/logout).
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: refreshMaxAge,
    });
    // Seul cookie non httpOnly des trois — double-submit CSRF (§2.2 de la
    // note de conception). Le frontend ne le lit plus via document.cookie
    // (voir commentaire de classe ci-dessus) : la même valeur lui est
    // transmise une fois dans le corps JSON par l'appelant, à renvoyer
    // ensuite dans l'en-tête X-CSRF-Token sur toute requête mutante.
    const csrfToken = randomBytes(32).toString('hex');
    res.cookie(CSRF_TOKEN_COOKIE, csrfToken, {
      httpOnly: false,
      secure: this.secure,
      sameSite: 'lax',
      path: '/api',
      maxAge: accessMaxAge,
    });
    return csrfToken;
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/api' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/auth' });
    res.clearCookie(CSRF_TOKEN_COOKIE, { path: '/api' });
  }
}

// Convertit "15m"/"7d"/"8h"/"30s" (même format que JWT_*_EXPIRES_IN) en
// millisecondes pour l'option `maxAge` de res.cookie — parseur local plutôt
// que la dépendance transitive `ms` (non déclarée dans package.json,
// fragile) : le format réellement utilisé dans ce projet est fixe et
// simple (un entier suivi d'une seule unité), pas besoin d'un parseur
// générique.
function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(
      `Durée JWT invalide : "${value}" (format attendu : <entier><s|m|h|d>, ex. "15m").`,
    );
  }
  const amount = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
    match[2] as 's' | 'm' | 'h' | 'd'
  ];
  return amount * unitMs;
}
