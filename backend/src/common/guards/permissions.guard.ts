import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PERMISSION_KEY,
  RequiredPermission,
} from '../decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';

// Vérifie la permission déclarée par @RequirePermission(module, action)
// contre les RolePermission actuelles du rôle de l'utilisateur — une requête
// fraîche à chaque appel (pas de cache, pas de valeur figée dans le JWT),
// pour que retirer une permission à un rôle prenne effet immédiatement sans
// attendre l'expiration du token. S'exécute après JwtAuthGuard (ordre des
// providers APP_GUARD dans AppModule) : req.user est déjà peuplé.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<
      RequiredPermission | undefined
    >(PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!required) {
      // Pas de @RequirePermission sur cette route : JwtAuthGuard a déjà
      // exigé un token valide, ce qui suffit (ex. routes du module auth
      // elles-mêmes qui ne sont pas publiques mais n'ont pas de permission
      // dédiée).
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    const grant = await this.prisma.permission.findFirst({
      where: {
        module: required.module,
        action: required.action,
        roles: { some: { roleId: user.roleId } },
      },
    });

    if (!grant) {
      throw new ForbiddenException(
        `Permission requise : ${required.module}:${required.action}.`,
      );
    }

    return true;
  }
}
