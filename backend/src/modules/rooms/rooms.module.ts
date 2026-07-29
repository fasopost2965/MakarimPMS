import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { AuditModule } from '../audit/audit.module';

// CH-038 (RD-024) — module désormais avec un controller propre pour les
// routes de CONFIGURATION uniquement (rooms:read/rooms:write). Reste un
// module feuille (docs/modules/rooms.md §10) : la seule dépendance ajoutée
// est AuditModule (motif + trace obligatoires sur toute mutation, même
// rigueur que parameters:write) — jamais stay/reservations/billing.
// GET /rooms et PATCH /rooms/:id/statut restent sur HousekeepingController
// (écart RBAC résiduel assumé, voir rooms.md §16).
@Module({
  imports: [AuditModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
