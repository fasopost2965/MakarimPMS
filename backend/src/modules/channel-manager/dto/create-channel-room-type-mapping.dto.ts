import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { CanalReservation } from '@prisma/client';

export class CreateChannelRoomTypeMappingDto {
  @IsEnum(CanalReservation)
  canal: CanalReservation;

  @IsString()
  @IsNotEmpty()
  externalRoomTypeId: string;

  @IsInt()
  roomTypeId: number;

  // ADR-005 §6.1 — opération sensible auditée (CREATE_CHANNEL_ROOM_TYPE_MAPPING).
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
