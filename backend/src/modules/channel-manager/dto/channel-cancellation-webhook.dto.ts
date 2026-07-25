import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChannelCancellationWebhookDto {
  @IsString()
  @IsNotEmpty()
  otaReservationId: string;

  // Motif libre optionnel transmis par l'OTA — toujours enrobé d'un motif
  // généré par ChannelManagerService avant d'être passé à
  // ReservationsService.remove() (≥10 caractères garantis, voir
  // CancelReservationDto), jamais utilisé tel quel.
  @IsOptional()
  @IsString()
  motif?: string;
}
