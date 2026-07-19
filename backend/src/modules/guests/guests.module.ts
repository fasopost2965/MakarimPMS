import { Module } from '@nestjs/common';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [GuestsController, CompaniesController],
  providers: [GuestsService, CompaniesService],
  exports: [GuestsService],
})
export class GuestsModule {}
