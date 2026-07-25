import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Fiche client minimale saisie au moment de la réservation, pour un client
// qui n'existe pas encore (voir CreateReservationDto/WalkinDto :
// guestId réutilise un client existant à la place — module CRM 5.7).
export class GuestInputDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  prenom: string;

  @IsOptional()
  @IsString()
  pieceIdentite?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
