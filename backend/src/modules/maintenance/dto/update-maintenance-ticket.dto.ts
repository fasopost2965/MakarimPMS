import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { PrioriteTicket } from '@prisma/client';

export class UpdateMaintenanceTicketDto {
  @IsOptional()
  @IsInt()
  roomId?: number | null;

  @IsOptional()
  @IsString()
  typePanne?: string;

  @IsOptional()
  @IsEnum(PrioriteTicket)
  priorite?: PrioriteTicket;

  @IsOptional()
  @IsString()
  photoUrl?: string | null;

  @IsOptional()
  @IsString()
  assigneA?: string | null;
}
