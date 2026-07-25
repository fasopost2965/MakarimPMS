import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CanalNotification, EvenementNotification } from '@prisma/client';

export class CreateNotificationTemplateDto {
  @IsEnum(EvenementNotification)
  evenement: EvenementNotification;

  @IsEnum(CanalNotification)
  canal: CanalNotification;

  @IsOptional()
  @IsString()
  sujet?: string;

  // Placeholders {{cle}} substitués par NotificationsService.notify() —
  // clés disponibles documentées par évènement dans
  // notifications/notifications.module.ts.
  @IsString()
  @IsNotEmpty()
  corps: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motif: string;
}
