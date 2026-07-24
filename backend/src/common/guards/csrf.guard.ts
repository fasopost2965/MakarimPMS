import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { CSRF_TOKEN_COOKIE } from '../../modules/auth/auth-cookie.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-csrf-token';

// CH-026(e) (docs/security/CH-026E_NOTE_CONCEPTION_COOKIES_HTTPONLY.md §2.2)
// — protection CSRF par double-submit cookie. Compare l'en-tête X-CSRF-Token
// à la valeur du cookie makarim_csrf_token sur toute requête mutante.
//
// S'efface volontairement quand la requête n'est pas authentifiée par le
// cookie d'accès (aucun cookie makarim_access_token présent) : une requête
// authentifiée par Authorization: Bearer (F9 mobile, un appel curl/Postman
// avec un jeton copié manuellement) n'est pas exposée au CSRF par
// construction — un navigateur piégé ne peut jamais forger un en-tête
// Authorization, contrairement à un cookie qu'il attache automatiquement.
// Bloquer ce cas n'apporterait aucune protection réelle, juste un blocage
// gratuit de F9 et des clients API légitimes.
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method)) return true;

    const cookies = request.cookies as Record<string, string> | undefined;
    const accessCookie = cookies?.['makarim_access_token'];
    if (!accessCookie) return true;

    const csrfCookie = cookies?.[CSRF_TOKEN_COOKIE];
    const csrfHeader = request.headers[CSRF_HEADER];

    if (!csrfCookie || typeof csrfHeader !== 'string') return false;

    // CH-026(b) — même discipline de comparaison à temps constant déjà
    // appliquée à CHANNEL_WEBHOOK_SECRET : un jeton CSRF comparé avec `===`
    // fuiterait sa valeur octet par octet via une attaque temporelle.
    const a = Buffer.from(csrfCookie);
    const b = Buffer.from(csrfHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
