import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  CanalNotification,
  EvenementNotification,
  Guest,
  NotificationLog,
  StatutNotification,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GuestsService } from '../guests/guests.service';
import { NotificationsQueue } from './queues/notifications.queue';
import { renderTemplate } from './utils/template-render';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';

// F7 — CRM & Marketing (email v1, SMS/WhatsApp en suite). Point d'entrée
// unique pour déclencher une notification (appelé par les listeners
// d'évènements et le cron J-1) — jamais d'envoi direct ailleurs, toujours
// via notify() pour garantir que consentement/journalisation sont
// systématiquement respectés, quel que soit le canal.
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly guestsService: GuestsService,
    private readonly notificationsQueue: NotificationsQueue,
  ) {}

  // --- Déclenchement ------------------------------------------------------

  // Adresse/numéro de destination par canal — email pour EMAIL, téléphone
  // partagé pour SMS/WHATSAPP (un seul champ Guest.telephone, pas de
  // distinction de numéro par canal en v1).
  private resolveDestinataire(
    canal: CanalNotification,
    guest: Pick<Guest, 'email' | 'telephone'>,
  ): string | null {
    return canal === CanalNotification.EMAIL ? guest.email : guest.telephone;
  }

  private destinataireManquantMessage(canal: CanalNotification): string {
    return canal === CanalNotification.EMAIL
      ? 'Client sans adresse email'
      : 'Client sans numéro de téléphone';
  }

  async notify(
    evenement: EvenementNotification,
    guestId: number,
    reservationId: number | null,
    variables: Record<string, string>,
  ) {
    // Façade guests (jamais de lecture Prisma directe de Guest hors de son
    // module) — c'est aussi la seule source du consentement/email/téléphone
    // figés au moment de l'envoi.
    const guest = await this.guestsService.findOne(guestId);

    // Un template par canal configuré pour cet évènement (0 à 3 lignes,
    // EMAIL/SMS/WHATSAPP) — le nombre de canaux réellement tentés dépend
    // uniquement de ce qui existe en base, jamais d'une liste de canaux
    // codée en dur ici.
    const templates = await this.prisma.notificationTemplate.findMany({
      where: { evenement },
    });

    // Aucun canal configuré du tout pour cet évènement : cas dégénéré
    // (l'évènement n'a jamais eu de template créé, même pas EMAIL) — un
    // seul log IGNORE explicite plutôt qu'un échec silencieux invisible.
    if (templates.length === 0) {
      return [
        await this.prisma.notificationLog.create({
          data: {
            guestId,
            reservationId: reservationId ?? undefined,
            evenement,
            canal: CanalNotification.EMAIL,
            destinataire: guest.email ?? '',
            statut: StatutNotification.IGNORE,
            erreur: 'Aucun template configuré pour cet évènement (tous canaux)',
          },
        }),
      ];
    }

    const logs: NotificationLog[] = [];
    for (const template of templates) {
      const destinataire = this.resolveDestinataire(template.canal, guest);

      // Template inactif, pas de destinataire, ou opt-out client : on
      // journalise quand même (IGNORE, jamais un échec silencieux
      // invisible) mais on ne met rien en file pour ce canal.
      if (
        !template.actif ||
        !destinataire ||
        !guest.consentementNotifications
      ) {
        logs.push(
          await this.prisma.notificationLog.create({
            data: {
              guestId,
              reservationId: reservationId ?? undefined,
              evenement,
              canal: template.canal,
              destinataire: destinataire ?? '',
              statut: StatutNotification.IGNORE,
              erreur: !template.actif
                ? 'Template inactif pour cet évènement/ce canal'
                : !destinataire
                  ? this.destinataireManquantMessage(template.canal)
                  : 'Client non consentant (consentementNotifications=false)',
            },
          }),
        );
        continue;
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
          canal: template.canal,
          destinataire,
          statut: StatutNotification.EN_ATTENTE,
        },
      });
      logs.push(log);

      // Contenu rendu passé directement au job (évite de re-rendre le
      // template côté worker, où le guest/variables d'origine ne seraient
      // plus disponibles) — seul le statut final est réécrit sur ce log.
      switch (template.canal) {
        case CanalNotification.EMAIL:
          await this.notificationsQueue.enqueueSendEmail({
            notificationLogId: log.id,
            destinataire,
            sujet: sujet ?? '(sans objet)',
            corps,
          });
          break;
        case CanalNotification.SMS:
          await this.notificationsQueue.enqueueSendSms({
            notificationLogId: log.id,
            destinataire,
            corps,
          });
          break;
        case CanalNotification.WHATSAPP:
          await this.notificationsQueue.enqueueSendWhatsapp({
            notificationLogId: log.id,
            destinataire,
            corps,
          });
          break;
      }
    }

    return logs;
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
