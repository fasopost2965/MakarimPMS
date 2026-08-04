import { ApiProperty } from '@nestjs/swagger';

export class AssignableUserResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Jean Dupont' })
  nom: string;

  @ApiProperty({ example: true })
  actif: boolean;
}
