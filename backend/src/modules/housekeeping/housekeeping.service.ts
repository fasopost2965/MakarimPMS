import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatutChambre } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HousekeepingService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllRooms() {
    return this.prisma.room.findMany({
      include: { roomType: true },
      orderBy: { numero: 'asc' },
    });
  }

  // Point de vigilance non négociable : une chambre OCCUPEE ne doit jamais
  // pouvoir être "libérée" par un changement manuel de statut — seul le
  // check-out (module checkin, CheckinService.checkout) est autorisé à en
  // sortir, car c'est lui qui libère aussi le verrou RoomNight sous-jacent.
  // Sans ce contrôle croisé, l'affichage housekeeping pourrait annoncer une
  // chambre libre alors qu'un séjour y est toujours en cours.
  async updateStatus(id: number, statut: StatutChambre) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) {
      throw new NotFoundException(`Chambre ${id} introuvable.`);
    }

    if (room.statut === StatutChambre.OCCUPEE) {
      throw new ConflictException(
        'Chambre occupée : le statut ne peut être changé que via le check-out (module checkin).',
      );
    }

    return this.prisma.room.update({
      where: { id },
      data: { statut },
      include: { roomType: true },
    });
  }
}
