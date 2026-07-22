import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { ParametersModule } from './modules/parameters/parameters.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { StayModule } from './modules/stay/stay.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { BillingModule } from './modules/billing/billing.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { GuestsModule } from './modules/guests/guests.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { HrModule } from './modules/hr/hr.module';
import { StockModule } from './modules/stock/stock.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    // Logs structurés (remplace le logger console par défaut de Nest) :
    // JSON brut en production (ingestion par un collecteur de logs), format
    // lisible (pino-pretty) en développement. pino-http journalise chaque
    // requête HTTP entrante (method, path, statusCode, durée) automatiquement.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        // Le mot de passe et les tokens ne doivent jamais atterrir dans les
        // logs, même en clair dans le corps d'une requête /auth/login.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.body.motDePasse',
            'req.body.nouveauMotDePasse',
            'req.body.refreshToken',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    // Limite globale par défaut (100 req/min/IP). AuthController surcharge
    // ce même throttler 'default' avec une limite bien plus stricte sur
    // /login et /refresh via @Throttle — la force brute sur ces deux routes
    // reste le principal vecteur d'attaque non couvert par le RBAC.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    // File d'attente (Redis) pour les traitements lourds hors thread
    // principal — voir modules/reporting/queues/reporting.queue.ts. Connexion
    // partagée par toute future queue (billing y compris) sans dupliquer la
    // configuration Redis module par module.
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    PrismaModule,
    AuthModule,
    RoomsModule,
    ParametersModule,
    ReservationsModule,
    StayModule,
    HousekeepingModule,
    BillingModule,
    PaymentsModule,
    DashboardModule,
    MaintenanceModule,
    GuestsModule,
    AuditModule,
    HrModule,
    StockModule,
    ReportingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Ordre significatif — Nest exécute les APP_GUARD dans l'ordre
    // d'enregistrement : ThrottlerGuard limite le débit avant même de savoir
    // si la requête est authentifiée (protège aussi les routes @Public()
    // comme /auth/login), puis JwtAuthGuard authentifie (peuple req.user ou
    // laisse passer les routes @Public()), puis PermissionsGuard vérifie
    // l'autorisation.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
