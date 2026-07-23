import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Get,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

// Toutes les routes sont @Public() (aucune n'exige de Bearer), à
// l'exception de GET /me (CH-011) — seule route de ce controller à exiger
// un token, @ApiBearerAuth() posée sur cette route précisément plutôt qu'au
// niveau de la classe.
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Limite resserrée (5/min/IP, contre 100/min par défaut ailleurs) : ces
  // deux routes sont la cible directe d'une attaque par force brute sur mot
  // de passe / token, ce que le RBAC ne couvre pas.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Connexion (email + mot de passe) — émet un access/refresh token',
  })
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: "Renouvelle l'access token à partir d'un refresh token valide",
  })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // CH-026(f) — révoque le refresh token présenté (rotation/révocation) ;
  // idempotent et volontairement tolérant à un jeton déjà invalide/expiré
  // (voir AuthService.logout), pas de Bearer requis : symétrique avec
  // /refresh, qui authentifie déjà par la possession du refresh token lui-
  // même, jamais par un access token en parallèle.
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Révoque le refresh token présenté (déconnexion)',
  })
  @Post('logout')
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
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
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Identité et permissions effectives de l'utilisateur courant (alimente le gating RBAC frontend)",
  })
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }
}
