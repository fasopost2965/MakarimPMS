import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { EvenementNotification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationsService } from '../reservations/reservations.service';
import { GuestsService } from '../guests/guests.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitSelfCheckinDto } from './dto/submit-self-checkin.dto';

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// F6 — lien de self check-in pré-arrivée. Façades reservations/guests
// (jamais de lecture/écriture Prisma directe de Reservation/Guest hors de
// leurs modules) + notifications (réutilise le canal email de F7, aucun
// nouveau code d'envoi).
@Injectable()
export class SelfCheckinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationsService: ReservationsService,
    private readonly guestsService: GuestsService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // Génère (ou régénère) le lien pour une réservation — un seul actif à la
  // fois (@unique reservationId, voir schema.prisma). Expire à la fin de
  // la journée d'arrivée : passé ce délai, le self check-in n'a plus de
  // sens, la réception prend le relais en personne. Pas d'AuditLog ici
  // (contrairement aux mutations métier sensibles, ADR-005) : envoyer un
  // lien n'est pas une opération financière/légale, NotificationLog en
  // trace déjà l'envoi.
  async generateLink(reservationId: number) {
    const reservation = await this.reservationsService.findOne(reservationId);

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(reservation.dateArrivee);
    expiresAt.setUTCHours(23, 59, 59, 999);

    const record = await this.prisma.selfCheckinToken.upsert({
      where: { reservationId },
      create: { reservationId, token, expiresAt },
      update: {
        token,
        expiresAt,
        usedAt: null,
        numeroPiece: null,
        typePiece: null,
        dateNaissance: null,
        paysProvenance: null,
        villeProvenance: null,
        paysDestination: null,
        villeDestination: null,
      },
    });

    const baseUrl = this.config.get<string>('FRONTEND_URL') ?? '';
    const url = `${baseUrl}/self-checkin/${token}`;

    await this.notificationsService.notify(
      EvenementNotification.SELF_CHECKIN_LIEN,
      reservation.guestId,
      reservation.id,
      {
        nom: reservation.guest.nom,
        prenom: reservation.guest.prenom,
        chambre: `${reservation.room.numero} (${reservation.room.roomType.nom})`,
        dateArrivee: formatDate(reservation.dateArrivee),
        lien: url,
      },
    );

    return { token: record.token, url, expiresAt: record.expiresAt };
  }

  private async findValidToken(token: string) {
    const record = await this.prisma.selfCheckinToken.findUnique({
      where: { token },
    });
    if (!record) {
      throw new NotFoundException('Lien de self check-in introuvable.');
    }
    if (record.expiresAt < new Date()) {
      throw new ConflictException('Ce lien de self check-in a expiré.');
    }
    return record;
  }

  // Résumé public — volontairement minimal (pas d'id interne exposé au-delà
  // du nécessaire, pas de données sur d'autres clients).
  async getPublicSummary(token: string) {
    const record = await this.findValidToken(token);
    const reservation = await this.reservationsService.findOne(
      record.reservationId,
    );

    return {
      dejaSoumis: record.usedAt !== null,
      dateArrivee: reservation.dateArrivee,
      dateDepart: reservation.dateDepart,
      chambre: reservation.room.roomType.nom,
      nom: reservation.guest.nom,
      prenom: reservation.guest.prenom,
    };
  }

  async submit(token: string, dto: SubmitSelfCheckinDto) {
    const record = await this.findValidToken(token);
    if (record.usedAt) {
      throw new ConflictException(
        'Ce lien de self check-in a déjà été utilisé.',
      );
    }
    const reservation = await this.reservationsService.findOne(
      record.reservationId,
    );

    // Façade guests — jamais de lecture/écriture Prisma directe de Guest
    // hors de son module. pieceIdentite (déjà un champ Guest générique) est
    // aligné sur numeroPiece pour que la fiche client soit immédiatement à
    // jour, avant même que PoliceRecord n'existe.
    await this.guestsService.update(reservation.guestId, {
      nom: dto.nom,
      prenom: dto.prenom,
      telephone: dto.telephone,
      email: dto.email,
      nationalite: dto.nationalite,
      pieceIdentite: dto.numeroPiece,
    });

    return this.prisma.selfCheckinToken.update({
      where: { token },
      data: {
        usedAt: new Date(),
        numeroPiece: dto.numeroPiece,
        typePiece: dto.typePiece,
        dateNaissance: new Date(dto.dateNaissance),
        paysProvenance: dto.paysProvenance,
        villeProvenance: dto.villeProvenance,
        paysDestination: dto.paysDestination,
        villeDestination: dto.villeDestination,
      },
    });
  }

  // Lecture réservée à la réception (staff, authentifié) — pré-remplissage
  // de POST /police/:stayId au moment du check-in réel. Jamais consommé
  // automatiquement par StayService (pas de dépendance stay → self-checkin,
  // pour ne pas introduire un couplage supplémentaire sur le chemin
  // critique du check-in) — c'est un geste explicite de la réception.
  async findPending(reservationId: number) {
    const record = await this.prisma.selfCheckinToken.findUnique({
      where: { reservationId },
    });
    if (!record || !record.usedAt) {
      return null;
    }
    return record;
  }
}
