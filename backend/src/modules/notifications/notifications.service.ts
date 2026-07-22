import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  CanalNotification,
  EvenementNotification,
  StatutNotification,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GuestsService } from '../guests/guests.service';
import { NotificationsQueue } from './queues/notifications.queue';
import { renderTemplate } from './utils/template-render';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';

// F7 — CRM & Marketing (canal email v1). Point d'entrée unique pour
// déclencher une notification (appelé par les listeners d'évènements et le
// cron J-1) — jamais d'envoi direct ailleurs, toujours via notify() pour
// garantir que consentement/journalisation sont systématiquement respectés.
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly guestsService: GuestsService,
    private readonly notificationsQueue: NotificationsQueue,
  ) {}

  // --- Déclenchement ------------------------------------------------------

  async notify(
    evenement: EvenementNotification,
    guestId: number,
    reservationId: number | null,
    variables: Record<string, string>,
  ) {
    // Façade guests (jamais de lecture Prisma directe de Guest hors de son
    // module) — c'est aussi la seule source du consentement/email figés au
    // moment de l'envoi.
    const guest = await this.guestsService.findOne(guestId);

    const template = await this.prisma.notificationTemplate.findUnique({
      where: {
        evenement_canal: {
          evenement,
          canal: CanalNotification.EMAIL,
        },
      },
    });

    // Pas de template actif, pas d'email, ou opt-out client : on journalise
    // quand même (IGNORE, jamais un échec silencieux invisible) mais on ne
    // met rien en file.
    if (
      !template ||
      !template.actif ||
      !guest.email ||
      !guest.consentementNotifications
    ) {
      return this.prisma.notificationLog.create({
        data: {
          guestId,
          reservationId: reservationId ?? undefined,
          evenement,
          canal: CanalNotification.EMAIL,
          destinataire: guest.email ?? '',
          statut: StatutNotification.IGNORE,
          erreur: !template
            ? 'Aucun template actif pour cet évènement'
            : !guest.email
              ? 'Client sans adresse email'
              : 'Client non consentant (consentementNotifications=false)',
        },
      });
    }

    const corps = renderTemplate(template.corps, variables);
    const sujet = template.sujet
      ? renderTemplate(template.sujet, variables)
      : null;

    const log = await this.prisma.notificationLog.create({
      data: {
        guestId,
        reservationId: reservationId ?? undefined,
        evenement,
        canal: CanalNotification.EMAIL,
        destinataire: guest.email,
        statut: StatutNotification.EN_ATTENTE,
      },
    });

    // Contenu rendu passé directement au job (évite de re-rendre le
    // template côté worker, où le guest/variables d'origine ne seraient
    // plus disponibles) — seul le statut final est réécrit sur ce log.
    await this.notificationsQueue.enqueueSendEmail({
      notificationLogId: log.id,
      destinataire: guest.email,
      sujet: sujet ?? '(sans objet)',
      corps,
    });

    return log;
  }

  // --- Templates (CRUD audité) ---------------------------------------------

  findTemplates() {
    return this.prisma.notificationTemplate.findMany({
      orderBy: [{ evenement: 'asc' }, { canal: 'asc' }],
    });
  }

  async createTemplate(dto: CreateNotificationTemplateDto, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.notificationTemplate.create({
        data: {
          evenement: dto.evenement,
          canal: dto.canal,
          sujet: dto.sujet,
          corps: dto.corps,
          actif: dto.actif ?? true,
        },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CREATE_NOTIFICATION_TEMPLATE,
        targetEntity: AuditEntity.NotificationTemplate,
        targetId: created.id,
        newValue: {
          evenement: dto.evenement,
          canal: dto.canal,
          sujet: dto.sujet ?? null,
        },
        motif: dto.motif,
      });

      return created;
    });
  }

  async updateTemplate(
    id: number,
    dto: UpdateNotificationTemplateDto,
    userId?: number,
  ) {
    const existing = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(
        `Template de notification ${id} introuvable.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.notificationTemplate.update({
        where: { id },
        data: {
          sujet: dto.sujet,
          corps: dto.corps,
          actif: dto.actif,
        },
      });

      const oldValue: Record<string, string | boolean | null> = {};
      const newValue: Record<string, string | boolean | null> = {};
      if (dto.sujet !== undefined) {
        oldValue.sujet = existing.sujet;
        newValue.sujet = dto.sujet;
      }
      if (dto.corps !== undefined) {
        oldValue.corps = existing.corps;
        newValue.corps = dto.corps;
      }
      if (dto.actif !== undefined) {
        oldValue.actif = existing.actif;
        newValue.actif = dto.actif;
      }

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.UPDATE_NOTIFICATION_TEMPLATE,
        targetEntity: AuditEntity.NotificationTemplate,
        targetId: id,
        oldValue,
        newValue,
        motif: dto.motif,
      });

      return updated;
    });
  }

  // --- Journal (lecture) ----------------------------------------------------

  findLogs(params?: { guestId?: number; reservationId?: number }) {
    return this.prisma.notificationLog.findMany({
      where: {
        guestId: params?.guestId,
        reservationId: params?.reservationId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
