// Un seul point de vérité pour le nom de la file et les jobs qu'elle
// accepte — même convention que reporting/queues/reporting-job.types.ts.
export const NOTIFICATIONS_QUEUE = 'notifications';

export const NOTIFICATIONS_JOB = {
  SEND_EMAIL: 'send-email',
} as const;

// Le contenu déjà rendu (sujet/corps) voyage avec le job — NotificationLog
// ne stocke pas le texte envoyé (seulement les métadonnées : destinataire,
// statut, erreur), donc le worker ne peut pas le reconstituer depuis la
// base. `notificationLogId` sert uniquement à réécrire le statut final
// (ENVOYE/ECHEC) sur la ligne déjà créée par NotificationsService.notify().
export interface SendEmailJobData {
  notificationLogId: number;
  destinataire: string;
  sujet: string;
  corps: string;
}
