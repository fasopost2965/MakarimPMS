import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';

// Module feuille (docs/modules/rooms.md §10) : aucune dépendance vers
// d'autres modules métier. Pas de controller dans cette itération — les
// routes HTTP existantes (GET /rooms, PATCH /rooms/:id/statut) restent
// portées par HousekeepingController (voir CLAUDE.md).
@Module({
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
