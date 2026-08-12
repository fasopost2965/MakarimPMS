import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

// B0.4B suite (Supervisor Inspection Queue Fix) — GET
// /mobile/housekeeping/tasks/to-inspect. Volontairement sans champ
// assignedUserId ni statut/active (contrairement à MobileTaskQueryDto) :
// cette file est par nature non filtrée par utilisateur — le contrôleur
// force toujours statut=TERMINEE et active=true côté serveur, jamais un
// paramètre choisi par le client (même convention anti-IDOR que
// MobileTaskQueryDto pour tasks/mine).
export class MobileInspectionQueueQueryDto {
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
