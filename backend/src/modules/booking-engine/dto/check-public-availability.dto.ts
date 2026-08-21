import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { FormuleHebergement } from '@prisma/client';

export class CheckPublicAvailabilityDto {
  @IsDateString()
  dateArrivee: string;

  @IsDateString()
  dateDepart: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roomTypeId?: number;
  @IsOptional()
  @IsIn(
    [
      FormuleHebergement.BED_AND_BREAKFAST,
      FormuleHebergement.HALF_BOARD,
      FormuleHebergement.FULL_BOARD,
    ],
    { message: "La formule ROOM_ONLY n'est plus autorisée." },
  )
  formule?: FormuleHebergement;

  @ValidateIf(
    (o: CheckPublicAvailabilityDto) =>
      o.nombreOccupants !== undefined ||
      (
        [
          FormuleHebergement.HALF_BOARD,
          FormuleHebergement.FULL_BOARD,
        ] as FormuleHebergement[]
      ).includes(o.formule as FormuleHebergement),
  )
  @IsNotEmpty({
    message:
      'nombreOccupants est obligatoire pour les formules HALF_BOARD et FULL_BOARD',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nombreOccupants?: number;
}
