import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
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
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Ordre significatif : JwtAuthGuard authentifie (peuple req.user ou
    // laisse passer les routes @Public()) avant que PermissionsGuard ne
    // vérifie l'autorisation — Nest exécute les APP_GUARD dans l'ordre
    // d'enregistrement.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
