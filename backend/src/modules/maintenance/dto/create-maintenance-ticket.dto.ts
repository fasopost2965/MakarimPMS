import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { PrioriteTicket } from '@prisma/client';

export class CreateMaintenanceTicketDto {
  @IsOptional()
  @IsInt()
  roomId?: number;

  @IsString()
  @IsNotEmpty()
  typePanne: string;

  @IsOptional()
  @IsEnum(PrioriteTicket)
  priorite?: PrioriteTicket;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  assigneA?: string;
}
