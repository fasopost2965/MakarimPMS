import { Module } from '@nestjs/common';
import { PoliceController } from './police.controller';
import { PoliceService } from './police.service';
import { AuditModule } from '../audit/audit.module';
import { StayModule } from '../stay/stay.module';

@Module({
  imports: [AuditModule, StayModule],
  controllers: [PoliceController],
  providers: [PoliceService],
  exports: [PoliceService],
})
export class PoliceModule {}
