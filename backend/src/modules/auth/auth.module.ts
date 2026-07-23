import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  // NotificationsModule : façade MailerService uniquement (CH-002,
  // docs/governance/REGISTRE_CHANTIERS.md) — envoi de l'email de
  // réinitialisation de mot de passe. NotificationsModule n'importe jamais
  // AuthModule en retour (vérifié dans notifications.module.ts), donc pas de
  // dépendance circulaire.
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({}),
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy],
  // F9 — AuthService.loginMobile() réutilisé par
  // MobileHousekeepingController (module housekeeping) pour émettre le
  // jeton mobile à portée réduite via le même chemin d'authentification
  // que le login desktop, jamais dupliqué.
  exports: [AuthService],
})
export class AuthModule {}
