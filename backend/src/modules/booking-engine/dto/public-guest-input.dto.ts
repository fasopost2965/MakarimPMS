import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Comme reservations/dto/guest-input.dto.ts, mais `email` obligatoire — un
// client du Booking Engine doit pouvoir être recontacté (confirmation,
// rappel J-1, F7) ; ce n'est pas exigé côté réception (walk-in/téléphone).
export class PublicGuestInputDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  prenom: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  telephone?: string;
}
