import { IsOptional, IsString } from 'class-validator';

export class GenerateInvoiceDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
