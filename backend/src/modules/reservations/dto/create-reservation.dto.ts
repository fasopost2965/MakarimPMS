import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CanalReservation, FormuleHebergement } from '@prisma/client';
import { GuestInputDto } from './guest-input.dto';

// L'un des deux champs client est requis (validé au niveau service, pas ici
// — un message d'erreur clair y est plus facile à produire qu'avec des
// décorateurs croisés) : `guestId` pour réutiliser un client existant
// (recherche CRM, active le contrôle blacklist), `guest` pour en saisir un
// nouveau à la volée comme avant le module 5.7.
export class CreateReservationDto {
  @IsOptional()
  @IsEnum(CanalReservation)
  canal?: CanalReservation;

  @IsInt()
  roomId: number;

  @IsDateString()
  dateArrivee: string;

  @IsDateString()
  dateDepart: string;

  @IsOptional()
  @IsString()
  sourceBrute?: string;

  // Défaut BED_AND_BREAKFAST (même défaut que le schéma) si omis — l'hôtel
  // vend systématiquement en B&B minimum (docs métier Priorité 3).
  @IsOptional()
  @IsEnum(FormuleHebergement)
  formule?: FormuleHebergement;

  // BR-RES-006 — optionnelle : une réservation sans politique rattachée
  // n'est jamais pénalisée en cas d'annulation/no-show.
  @IsOptional()
  @IsInt()
  cancellationPolicyId?: number;

  @IsOptional()
  @IsInt()
  guestId?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuestInputDto)
  guest?: GuestInputDto;
}
