import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
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

  // FIN-102 (composition du tarif public TTC) — optionnelle : quand elle est
  // connue à la réservation, reprise telle quelle par
  // StayService.checkinFromReservation pour matérialiser TAXE_SEJOUR dès le
  // check-in (backend/src/modules/stay/dto/checkin-from-reservation.dto.ts
  // reste le point de secours si absente ici). Borne haute vérifiée par le
  // service (capacité réelle de la chambre attribuée), non exprimable en DTO
  // statique. Jamais rendue obligatoire ici : le Booking Engine public (F4)
  // et l'import Channel Manager (F10) restent hors périmètre de cette
  // mission, non modifiés.
  @ValidateIf(
    (o: CreateReservationDto) =>
      o.nombreOccupants !== undefined ||
      ([FormuleHebergement.HALF_BOARD, FormuleHebergement.FULL_BOARD] as FormuleHebergement[]).includes(
        o.formule as FormuleHebergement,
      ),
  )
  @IsNotEmpty({
    message:
      'nombreOccupants est obligatoire pour les formules HALF_BOARD et FULL_BOARD',
  })
  @IsInt()
  @Min(1)
  nombreOccupants?: number;

  @IsOptional()
  @IsInt()
  guestId?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuestInputDto)
  guest?: GuestInputDto;
}
