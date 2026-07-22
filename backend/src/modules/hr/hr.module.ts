import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  // ScheduleModule.forRoot() enregistre le SchedulerRegistry global requis
  // par @Cron (AttendanceService.clorerShiftsOrphelins, ADR-007 §6.3) — hr
  // est le seul module à utiliser des tâches planifiées pour l'instant,
  // d'où l'enregistrement ici plutôt que dans AppModule.
  imports: [ScheduleModule.forRoot(), AuditModule],
  controllers: [EmployeesController, AttendanceController, PayrollController],
  providers: [EmployeesService, AttendanceService, PayrollService],
})
export class HrModule {}
