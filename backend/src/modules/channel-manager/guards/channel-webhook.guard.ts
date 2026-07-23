import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const WEBHOOK_SECRET_HEADER = 'x-channel-webhook-secret';

// CH-026(b) — comparaison à temps constant : `!==` sur deux chaînes court-
// circuite au premier caractère différent, ce qui fuit la longueur du
// préfixe correct via le temps de réponse (attaque par canal auxiliaire
// classique sur un secret partagé statique). Les tailles diffèrent presque
// toujours en pratique (l'attaquant ne connaît pas la longueur exacte du
// secret) — ce cas se résout en O(1) avant toute comparaison temporelle,
// sans fuite additionnelle exploitable au-delà de la longueur elle-même.
function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Routes webhook (@Public(), donc JwtAuthGuard/PermissionsGuard ne les
// protègent pas — un OTA n'a pas de compte utilisateur PMS) : la seule
// authentification est un secret partagé statique, comme n'importe quelle
// intégration webhook serveur-à-serveur. CHANNEL_WEBHOOK_SECRET absent =
// on refuse tout appel plutôt que d'ouvrir la route sans protection
// (fail closed, cohérent avec JwtAuthGuard — jamais de dégradation
// gracieuse pour une frontière d'authentification, contrairement à
// SMTP/Twilio qui ne sont que des envois sortants best-effort).
@Injectable()
export class ChannelWebhookGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('CHANNEL_WEBHOOK_SECRET');
    if (!expected) {
      throw new UnauthorizedException(
        'CHANNEL_WEBHOOK_SECRET non configuré côté serveur — webhooks channel-manager désactivés.',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[WEBHOOK_SECRET_HEADER];
    if (
      typeof provided !== 'string' ||
      !timingSafeEqualStrings(provided, expected)
    ) {
      throw new UnauthorizedException(
        'Secret webhook channel-manager invalide.',
      );
    }

    return true;
  }
}
