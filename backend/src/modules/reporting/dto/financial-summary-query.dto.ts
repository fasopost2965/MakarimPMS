import { IsDateString } from 'class-validator';

export class FinancialSummaryQueryDto {
  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;
}
