import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { StatutTacheHousekeeping } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

// B0.4A — GET /mobile/housekeeping/tasks/mine. Volontairement sans champ
// assignedUserId (contrairement à HousekeepingTaskQueryDto) : le
// ValidationPipe global (whitelist + forbidNonWhitelisted, voir main.ts)
// rejette en 400 toute tentative du client d'injecter ce filtre — le
// contrôleur force toujours assignedUserId au user courant (anti-IDOR, même
// convention que CreatePublicReservationDto pour guestId, F4).
export class MobileTaskQueryDto {
  @ApiPropertyOptional({ enum: StatutTacheHousekeeping })
  @IsOptional()
  @IsEnum(StatutTacheHousekeeping)
  statut?: StatutTacheHousekeeping;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true || value === 1 || value === '1')
      return true;
    if (value === 'false' || value === false || value === 0 || value === '0')
      return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}
