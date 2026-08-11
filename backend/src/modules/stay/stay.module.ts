import { Module } from '@nestjs/common';
import { StayController } from './stay.controller';
import { StayService } from './stay.service';
import { RoomsModule } from '../rooms/rooms.module';
import { GuestsModule } from '../guests/guests.module';
import { BillingModule } from '../billing/billing.module';
import { AuditModule } from '../audit/audit.module';
import { ParametersModule } from '../parameters/parameters.module';
import { PaymentsModule } from '../payments/payments.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';

// BillingModule : imputation des acomptes (ReservationDeposit) au folio
// principal via BillingService.creditFolioLine au check-in — dépendance
// sanctionnée par docs/DEPENDENCY_GRAPH.md (arête M6 stay → M7 billing).
//
// Pas d'import de HousekeepingModule ici, volontairement : HousekeepingModule
// importe déjà StayModule (façades de lecture seule préexistantes, ex.
// reconcileDailyStatuses). Un aller-retour StayModule <-> HousekeepingModule
// au niveau des fichiers de module casse le chargement CommonJS au
// démarrage (constaté en le testant : NotificationsModule reçoit
// StayModule=undefined dans son tableau imports, forwardRef() au niveau du
// tableau imports ne suffit pas à corriger un cycle réel entre deux
// fichiers .module.ts). GL-002 (StayService.changeRoom) obtient
// HousekeepingTaskService via ModuleRef#get(token, { strict: false })
// (résolution globale à l'exécution, après le bootstrap complet de
// l'application) plutôt que par injection de constructeur — voir
// housekeeping-task-writer.token.ts.
// ParametersModule (GL-003) : StayService.extendStay lit la grille tarifaire
// saisonnière via ParametersService.getSeasonRatesForRoomType — module
// feuille, aucun risque de cycle (parameters.module.ts n'importe que
// AuditModule).
// PaymentsModule (GL-003B) : StayService.createExtensionDeposit délègue
// l'écriture Payment/FolioLine de l'avance bornée de prolongation à
// PaymentsService.createExtensionDeposit, jamais un tx.payment.create
// dupliqué localement. Vérifié sans risque de cycle (payments.module.ts
// n'importe que BillingModule/AuditModule, jamais StayModule) — extendStay
// lui-même reste inchangé et continue de n'utiliser que les FolioLine déjà
// chargées (computeSoldeDu), jamais PaymentsService/la table Payment.
@Module({
  imports: [
    RoomsModule,
    GuestsModule,
    BillingModule,
    AuditModule,
    ParametersModule,
    PaymentsModule,
    MaintenanceModule,
  ],
  controllers: [StayController],
  providers: [StayService],
  exports: [StayService],
})
export class StayModule {}
