import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  CanalReservation,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReservationsService } from '../reservations/reservations.service';
import { getNightsBetween } from '../reservations/utils/nights';
import { ChannelReservationWebhookDto } from './dto/channel-reservation-webhook.dto';
import { ChannelCancellationWebhookDto } from './dto/channel-cancellation-webhook.dto';
import { CreateChannelRoomTypeMappingDto } from './dto/create-channel-room-type-mapping.dto';
import { DeleteChannelRoomTypeMappingDto } from './dto/delete-channel-room-type-mapping.dto';
import { ChannelAdapterRegistry } from './adapters/channel-adapter.registry';
import { ChannelAvailabilityUpdate } from './channel-adapter.interface';

// F10 — Channel Manager / synchronisation OTA. N'importe que la façade
// ReservationsService (jamais Prisma direct sur Reservation/RoomNight) :
// import/annulation réutilisent exactement le même chemin d'écriture que
// la réception (create()/remove()), aucune logique de réservation dupliquée
// (CLAUDE.md — "les modules futurs se branchent sur les services métier
// existants, jamais en contournement").
@Injectable()
export class ChannelManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly reservationsService: ReservationsService,
    private readonly channelAdapterRegistry: ChannelAdapterRegistry,
  ) {}

  // --- Mapping type de chambre externe → RoomType interne -----------------
  // Permission réutilisée : parameters:write (même logique que companies
  // réutilise guests:*, police réutilise checkin:* — configuration
  // exceptionnelle, pas d'opération métier quotidienne, cohérent avec
  // SeasonRate/TaxRateConfig déjà sous parameters:write).

  async findMappings(canal?: CanalReservation) {
    return this.prisma.channelRoomTypeMapping.findMany({
      where: canal ? { canal } : undefined,
      include: { roomType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMapping(dto: CreateChannelRoomTypeMappingDto, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.channelRoomTypeMapping.create({
        data: {
          canal: dto.canal,
          externalRoomTypeId: dto.externalRoomTypeId,
          roomTypeId: dto.roomTypeId,
        },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CREATE_CHANNEL_ROOM_TYPE_MAPPING,
        targetEntity: AuditEntity.ChannelRoomTypeMapping,
        targetId: created.id,
        newValue: {
          canal: dto.canal,
          externalRoomTypeId: dto.externalRoomTypeId,
          roomTypeId: dto.roomTypeId,
        },
        motif: dto.motif,
      });

      return created;
    });
  }

  async removeMapping(
    id: number,
    dto: DeleteChannelRoomTypeMappingDto,
    userId?: number,
  ) {
    const existing = await this.prisma.channelRoomTypeMapping.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Mapping ${id} introuvable.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.channelRoomTypeMapping.delete({ where: { id } });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.DELETE_CHANNEL_ROOM_TYPE_MAPPING,
        targetEntity: AuditEntity.ChannelRoomTypeMapping,
        targetId: id,
        oldValue: {
          canal: existing.canal,
          externalRoomTypeId: existing.externalRoomTypeId,
          roomTypeId: existing.roomTypeId,
        },
        motif: dto.motif,
      });
    });
  }

  // --- Webhooks entrants (import / annulation) -----------------------------

  private async findImport(canal: CanalReservation, otaReservationId: string) {
    return this.prisma.channelReservationImport.findUnique({
      where: { canal_otaReservationId: { canal, otaReservationId } },
    });
  }

  // Idempotent : une nouvelle livraison webhook pour un otaReservationId déjà
  // importé renvoie la réservation existante sans en recréer une deuxième
  // (même garantie que Payment.idempotencyKey, adaptée en check-then-act
  // puisque ReservationsService.create() gère sa propre transaction interne
  // et n'accepte pas de tx externe — voir commentaire de course résiduelle
  // ci-dessous).
  async importReservation(
    canal: CanalReservation,
    dto: ChannelReservationWebhookDto,
    userId?: number,
  ) {
    const existingImport = await this.findImport(canal, dto.otaReservationId);
    if (existingImport) {
      return this.reservationsService.findOne(existingImport.reservationId);
    }

    const mapping = await this.prisma.channelRoomTypeMapping.findUnique({
      where: {
        canal_externalRoomTypeId: {
          canal,
          externalRoomTypeId: dto.externalRoomTypeId,
        },
      },
    });
    if (!mapping) {
      throw new NotFoundException(
        `Aucun mapping configuré pour ${canal}/${dto.externalRoomTypeId} — ` +
          'configurer via POST /channel-manager/mappings avant import.',
      );
    }

    const availableRooms = await this.reservationsService.checkAvailability({
      dateDebut: dto.dateArrivee,
      dateFin: dto.dateDepart,
      roomTypeId: mapping.roomTypeId,
    });
    if (availableRooms.length === 0) {
      throw new ConflictException(
        `Aucune chambre disponible pour ce type de chambre sur cette période ` +
          `(import ${canal}/${dto.otaReservationId}).`,
      );
    }

    const reservation = await this.reservationsService.create({
      canal,
      roomId: availableRooms[0].id,
      dateArrivee: dto.dateArrivee,
      dateDepart: dto.dateDepart,
      guest: dto.guest,
    });

    try {
      await this.prisma.channelReservationImport.create({
        data: {
          canal,
          otaReservationId: dto.otaReservationId,
          reservationId: reservation.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Course résiduelle : deux livraisons webhook quasi simultanées pour
        // le même otaReservationId ont toutes deux dépassé la vérification
        // d'idempotence ci-dessus avant qu'aucune n'ait committé. Contrairement
        // à la course déjà documentée sur F4 (RoomNight rejette silencieusement
        // le perdant), ici les deux réservations peuvent avoir réellement
        // réussi (plusieurs chambres du même type libres) : on annule
        // explicitement celle créée par cet appel perdant (soft, ADR-005 —
        // jamais de suppression physique) pour ne jamais laisser deux
        // réservations vivantes associées au même otaReservationId, puis on
        // renvoie la réservation gagnante — l'appelant obtient une vraie
        // garantie d'idempotence, pas seulement l'absence d'erreur.
        await this.reservationsService.remove(
          reservation.id,
          {
            motif: `Import en double détecté (idempotence webhook ${canal}).`,
          },
          userId,
        );
        const winner = await this.findImport(canal, dto.otaReservationId);
        if (!winner) {
          throw error;
        }
        return this.reservationsService.findOne(winner.reservationId);
      }
      throw error;
    }

    return reservation;
  }

  async cancelReservation(
    canal: CanalReservation,
    dto: ChannelCancellationWebhookDto,
    userId?: number,
  ) {
    const existingImport = await this.findImport(canal, dto.otaReservationId);
    if (!existingImport) {
      throw new NotFoundException(
        `Aucune réservation importée pour ${canal}/${dto.otaReservationId}.`,
      );
    }

    const motif = dto.motif
      ? `Annulation transmise par le canal ${canal} (otaReservationId=${dto.otaReservationId}) : ${dto.motif}`
      : `Annulation transmise par le canal ${canal} (otaReservationId=${dto.otaReservationId}).`;

    return this.reservationsService.remove(
      existingImport.reservationId,
      { motif },
      userId,
    );
  }

  // --- Synchronisation sortante (disponibilité) ----------------------------
  // Calcule notre disponibilité réelle (via ReservationsService.
  // checkAvailability, jamais de lecture RoomNight directe) pour chaque
  // mapping configuré du canal, puis délègue l'envoi à l'adaptateur — la
  // seule partie simulée/journalisée de cette méthode (voir
  // channel-adapter.interface.ts), le calcul de disponibilité lui-même est
  // réel.
  async syncAvailability(
    canal: CanalReservation,
    dateDebut: string,
    dateFin: string,
  ) {
    const adapter = this.channelAdapterRegistry.resolve(canal);
    const mappings = await this.findMappings(canal);
    const nights = getNightsBetween(dateDebut, dateFin);

    const updates: ChannelAvailabilityUpdate[] = [];
    for (const mapping of mappings) {
      for (const night of nights) {
        const nightIso = night.toISOString().slice(0, 10);
        const lendemainIso = new Date(night.getTime() + 86_400_000)
          .toISOString()
          .slice(0, 10);
        const availableRooms = await this.reservationsService.checkAvailability(
          {
            dateDebut: nightIso,
            dateFin: lendemainIso,
            roomTypeId: mapping.roomTypeId,
          },
        );
        updates.push({
          externalRoomTypeId: mapping.externalRoomTypeId,
          date: nightIso,
          disponible: availableRooms.length > 0,
        });
      }
    }

    await adapter.pushAvailability(updates);
    return {
      canal,
      mappingsSynchronises: mappings.length,
      nuitsSynchronisees: nights.length,
      miseAJourEnvoyees: updates.length,
    };
  }
}
