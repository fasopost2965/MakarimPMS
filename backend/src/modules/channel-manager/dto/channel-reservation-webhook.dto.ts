import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { GuestInputDto } from '../../reservations/dto/guest-input.dto';

// Schéma générique unique, partagé par les 3 canaux OTA (voir
// channel-adapter.interface.ts pour la justification : aucune spec réelle
// par OTA n'est disponible, inventer 3 formats de payload serait fictif).
export class ChannelReservationWebhookDto {
  @IsString()
  @IsNotEmpty()
  otaReservationId: string;

  // Identifiant de type de chambre côté OTA — traduit en RoomType interne
  // via ChannelRoomTypeMapping (jamais deviné).
  @IsString()
  @IsNotEmpty()
  externalRoomTypeId: string;

  @IsDateString()
  dateArrivee: string;

  @IsDateString()
  dateDepart: string;

  @ValidateNested()
  @Type(() => GuestInputDto)
  guest: GuestInputDto;
}
