import { IsBoolean } from 'class-validator';

export class ClassifyMaintenanceTicketDto {
  @IsBoolean()
  bloqueVente: boolean;
}
