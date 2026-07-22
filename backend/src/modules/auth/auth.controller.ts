import { Body, Controller, Ip, Post, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

// Toutes les routes sont @Public() (aucune n'exige de Bearer) — pas
// d'@ApiBearerAuth() ici, contrairement aux autres controllers.
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
}
