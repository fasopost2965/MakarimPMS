import { Module } from '@nestjs/common';
import { BookingEngineController } from './booking-engine.controller';
import { BookingEngineService } from './booking-engine.service';
import { ReservationsModule } from '../reservations/reservations.module';

// Façade pure de ReservationsModule (create()/checkAvailability()/
// estimatePrixTotal()) — aucune logique de réservation dupliquée, aucune
// dépendance directe à parameters/rooms/guests (déjà couvertes en interne
// par ReservationsService). La confirmation email (F7) part automatiquement
// : ReservationsService.create() émet reservation.confirmee quel que soit
// l'appelant, ce module n'a rien à câbler pour ça.
@Module({
  imports: [ReservationsModule],
  controllers: [BookingEngineController],
  providers: [BookingEngineService],
})
export class BookingEngineModule {}
