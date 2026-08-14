import { IsInt, IsPositive } from 'class-validator';

// DESIGN-009B — POST /stays/:id/change-room/preview.
export class PreviewChangeRoomDto {
  @IsInt()
  @IsPositive()
  newRoomId: number;
}
