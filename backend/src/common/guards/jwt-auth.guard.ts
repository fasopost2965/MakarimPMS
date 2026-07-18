import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// Guard global (voir AppModule) : toute route est protégée par défaut, sauf
// celles marquées @Public() (login, refresh, forgot/reset-password,
// roles-actifs). C'est le comportement "fail closed" attendu — un module
// futur qui oublie de décorer sa route explicitement reste protégé plutôt
// que de se retrouver ouvert par défaut.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
