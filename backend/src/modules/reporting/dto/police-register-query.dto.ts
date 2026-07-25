import { IsIn, IsOptional } from 'class-validator';
import { FinancialSummaryQueryDto } from './financial-summary-query.dto';

export class PoliceRegisterQueryDto extends FinancialSummaryQueryDto {
  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';
}
