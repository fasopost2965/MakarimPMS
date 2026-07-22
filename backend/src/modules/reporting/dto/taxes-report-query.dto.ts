import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import { FinancialSummaryQueryDto } from './financial-summary-query.dto';

export class TaxesReportQueryDto extends FinancialSummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taxeId?: number;

  // Query string toujours une chaîne ("true"/"false") — conversion explicite
  // avant validation (ValidationPipe global transform:true ne suffit pas
  // pour un booléen depuis une query string brute).
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  tresorOnly?: boolean;
}
