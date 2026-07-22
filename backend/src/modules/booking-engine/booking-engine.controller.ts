import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { BookingEngineService } from './booking-engine.service';
import { CheckPublicAvailabilityDto } from './dto/check-public-availability.dto';
import { CreatePublicReservationDto } from './dto/create-public-reservation.dto';

// BR-RES-004 : surface publique découplée, throttling strict (scraping/DDoS)
// — carve-out CORS dédié dans main.ts (PUBLIC_CORS_PREFIXES).
@ApiTags('booking-engine')
@Controller('booking')
export class BookingEngineController {
  constructor(private readonly bookingEngineService: BookingEngineService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Disponibilité publique par type de chambre, avec prix indicatif (sans authentification)',
  })
  @Get('availability')
  checkAvailability(@Query() dto: CheckPublicAvailabilityDto) {
    return this.bookingEngineService.checkAvailability(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Crée une réservation directe (canal DIRECT, sans commission, sans authentification)',
  })
  @Post('reservations')
  createReservation(@Body() dto: CreatePublicReservationDto) {
    return this.bookingEngineService.createReservation(dto);
  }
}
