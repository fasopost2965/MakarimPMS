import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Get,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuthService } from './auth.service';
import {
  AuthCookieService,
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './auth-cookie.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

// Toutes les routes sont @Public() (aucune n'exige de Bearer), à
// l'exception de GET /me (CH-011) — seule route de ce controller à exiger
// un token, @ApiBearerAuth() posée sur cette route précisément plutôt qu'au
// niveau de la classe.
//
// CH-026(e) (docs/security/CH-026E_NOTE_CONCEPTION_COOKIES_HTTPONLY.md) —
// login/refresh posent les cookies d'authentification via AuthCookieService
// (seul point d'écriture) et ne renvoient plus les jetons dans le corps de
// la réponse ; refresh/logout lisent le refresh token depuis le cookie
// httpOnly plutôt qu'un corps de requête (RefreshDto retiré, devenu
// obsolète pour ces deux routes).
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  // Limite resserrée (5/min/IP, contre 100/min par défaut ailleurs) : ces
  // deux routes sont la cible directe d'une attaque par force brute sur mot
  // de passe / token, ce que le RBAC ne couvre pas.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Connexion (email + mot de passe) — pose les cookies access/refresh/CSRF',
  })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto, ip);
    const csrfToken = this.authCookieService.setAuthCookies(res, tokens);
    return { ok: true, csrfToken };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      "Renouvelle l'access token à partir du refresh token porté par cookie",
  })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_TOKEN_COOKIE
    ];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }
    const tokens = await this.authService.refresh(refreshToken);
    const csrfToken = this.authCookieService.setAuthCookies(res, tokens);
    return { ok: true, csrfToken };
  }

  // CH-026(f) — révoque le refresh token présenté (rotation/révocation) ;
  // idempotent et volontairement tolérant à un jeton déjà invalide/expiré/
  // absent (voir AuthService.logout) : une déconnexion doit toujours
  // réussir côté client. Pas de Bearer requis : symétrique avec /refresh,
  // qui authentifie déjà par la possession du refresh token lui-même,
  // jamais par un access token en parallèle.
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Révoque le refresh token courant et efface les cookies',
  })
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_TOKEN_COOKIE
    ];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    this.authCookieService.clearAuthCookies(res);
  }

  @Public()
  @ApiOperation({
    summary: 'Déclenche un email de réinitialisation de mot de passe',
  })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @ApiOperation({
    summary: 'Réinitialise le mot de passe à partir du token reçu par email',
  })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.nouveauMotDePasse);
  }

  @Public()
  @ApiOperation({
    summary:
      "Liste les rôles actifs (peuple le sélecteur de l'écran de connexion)",
  })
  @Get('roles-actifs')
  rolesActifs() {
    return this.authService.rolesActifs();
  }

  // CH-011 — pas de @RequirePermission ici : tout utilisateur authentifié
  // peut consulter sa propre identité/ses propres permissions, quel que
  // soit son rôle (nécessaire pour que le frontend puisse se gater
  // lui-même dès la connexion).
  //
  // CH-026(e) — profite de cet appel (déjà déclenché par App.tsx à chaque
  // montage) pour faire aussi transiter la valeur courante du cookie CSRF
  // dans le corps JSON : après un rechargement de page, le frontend n'a
  // plus la valeur en mémoire (perdue avec le contexte JS précédent) mais
  // la session cookie httpOnly, elle, a survécu — sans ce canal de
  // récupération, la première requête mutante après un F5 échouerait à
  // tort en 403 CSRF. Simple lecture de `req.cookies` (déjà non httpOnly,
  // aucune élévation de confidentialité), jamais une réémission/rotation.
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Identité et permissions effectives de l'utilisateur courant (alimente le gating RBAC frontend)",
  })
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const me = await this.authService.me(user);
    const csrfToken =
      (req.cookies as Record<string, string> | undefined)?.[
        CSRF_TOKEN_COOKIE
      ] ?? null;
    return { ...me, csrfToken };
  }
}
