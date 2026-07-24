import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from '../auth-cookie.service';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';

// CH-026(e) — double extracteur : le cookie httpOnly reste le chemin
// desktop nominal, mais Authorization: Bearer cohabite volontairement (pas
// un remplacement) pour F9 (AuthService.loginMobile(), client mobile natif
// sans pot de cookies partagé avec l'origine du site) — voir
// docs/security/CH-026E_NOTE_CONCEPTION_COOKIES_HTTPONLY.md §4.
function extractFromCookie(req: Request): string | null {
  return (req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ?? null;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return payload;
  }
}
