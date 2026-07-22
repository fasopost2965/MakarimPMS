import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Module({
  imports: [ConfigModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy],
  // F9 — AuthService.loginMobile() réutilisé par
  // MobileHousekeepingController (module housekeeping) pour émettre le
  // jeton mobile à portée réduite via le même chemin d'authentification
  // que le login desktop, jamais dupliqué.
  exports: [AuthService],
})
export class AuthModule {}
