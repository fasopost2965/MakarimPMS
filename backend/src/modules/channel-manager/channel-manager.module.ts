import { Module } from '@nestjs/common';
import { ChannelManagerController } from './channel-manager.controller';
import { ChannelManagerService } from './channel-manager.service';
import { ChannelWebhookGuard } from './guards/channel-webhook.guard';
import { ChannelAdapterRegistry } from './adapters/channel-adapter.registry';
import { BookingComAdapter } from './adapters/booking-com.adapter';
import { ExpediaAdapter } from './adapters/expedia.adapter';
import { AirbnbAdapter } from './adapters/airbnb.adapter';
import { ReservationsModule } from '../reservations/reservations.module';
import { AuditModule } from '../audit/audit.module';

// F10 — n'importe que ReservationsModule (façade ReservationsService) et
// AuditModule (traçabilité des mappings, ADR-005), aucune dépendance
// sortante vers rooms/guests/parameters en Prisma direct
// (docs/DEPENDENCY_GRAPH.md — les modules futurs se branchent sur les
// services métier existants, jamais en contournement).
@Module({
  imports: [ReservationsModule, AuditModule],
  controllers: [ChannelManagerController],
  providers: [
    ChannelManagerService,
    ChannelWebhookGuard,
    ChannelAdapterRegistry,
    BookingComAdapter,
    ExpediaAdapter,
    AirbnbAdapter,
  ],
})
export class ChannelManagerModule {}
