import { Module } from '@nestjs/common';
import { ParametersController } from './parameters.controller';
import { ParametersService } from './parameters.service';
import { AuditModule } from '../audit/audit.module';

// Module feuille (docs/modules/parameters.md §10) : dépend uniquement de
// audit pour la traçabilité des modifications de taux/config.
@Module({
  imports: [AuditModule],
  controllers: [ParametersController],
  providers: [ParametersService],
  exports: [ParametersService],
})
export class ParametersModule {}
