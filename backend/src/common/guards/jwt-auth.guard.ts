import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';

const MOBILE_SCOPE_PREFIX = '/api/mobile/housekeeping';

// Guard global (voir AppModule) : toute route est protégée par défaut, sauf
// celles marquées @Public() (login, refresh, forgot/reset-password,
// roles-actifs, self-checkin, booking). C'est le comportement "fail closed"
// attendu — un module futur qui oublie de décorer sa route explicitement
// reste protégé plutôt que de se retrouver ouvert par défaut.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const activated = await super.canActivate(context);
    if (!activated) {
      return false;
    }

    // F9 — défense en profondeur : un jeton mobile housekeeping (scope
    // réduit, TTL court, voir AuthService.loginMobile) ne doit jamais être
    // utilisable en dehors de son propre périmètre de routes, même si le
    // rôle sous-jacent aurait par ailleurs une permission plus large
    // (PermissionsGuard, exécuté après ce guard, ne fait qu'une vérification
    // RBAC — il ne sait rien de la provenance du jeton). Un appareil mobile
    // perdu/volé ne doit jamais donner accès au reste de l'API desktop.
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (
      user?.scope === 'mobile-housekeeping' &&
      !request.path.startsWith(MOBILE_SCOPE_PREFIX)
    ) {
      throw new UnauthorizedException(
        'Jeton mobile non valide en dehors de /mobile/housekeeping.',
      );
    }

    return true;
  }
}
