import { Module } from '@nestjs/common';
import { HousekeepingController } from './housekeeping.controller';
import { MobileHousekeepingController } from './mobile-housekeeping.controller';
import { HousekeepingTaskController } from './housekeeping-task.controller';
import { HousekeepingService } from './housekeeping.service';
import { HousekeepingTaskService } from './housekeeping-task.service';
import { CheckoutEffectueListener } from './listeners/checkout-effectue.listener';
import { HOUSEKEEPING_TASK_WRITER } from './housekeeping-task-writer.token';
import { RoomsModule } from '../rooms/rooms.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { StayModule } from '../stay/stay.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

// F9 — AuthModule importé uniquement pour AuthService.loginMobile()
// (façade, jamais de logique d'authentification dupliquée ici).
//
// GL-002 — RoomChangedListener/RoomChangedEvent ont été supprimés (devenus
// inutiles) : StayService.changeRoom crée désormais la tâche housekeeping
// de l'ancienne chambre dans sa propre transaction, sans listener
// post-commit. HOUSEKEEPING_TASK_WRITER expose HousekeepingTaskService
// sous un jeton, résolu par StayService via ModuleRef#get(token,
// { strict: false }) — pas d'import de StayModule -> HousekeepingModule
// en retour (voir stay.module.ts : un aller-retour entre fichiers .module.ts
// casse le chargement CommonJS au démarrage). StayModule reste donc
// importé ici dans un seul sens, comme avant GL-002.
@Module({
  imports: [
    RoomsModule,
    ReservationsModule,
    StayModule,
    AuthModule,
    AuditModule,
  ],
  controllers: [
    HousekeepingController,
    MobileHousekeepingController,
    HousekeepingTaskController,
  ],
  providers: [
    HousekeepingService,
    HousekeepingTaskService,
    CheckoutEffectueListener,
    { provide: HOUSEKEEPING_TASK_WRITER, useExisting: HousekeepingTaskService },
  ],
  exports: [HousekeepingService, HousekeepingTaskService, HOUSEKEEPING_TASK_WRITER],
})
export class HousekeepingModule {}
