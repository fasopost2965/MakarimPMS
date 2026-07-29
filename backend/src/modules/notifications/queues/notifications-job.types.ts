// Un seul point de vérité pour le nom de la file et les jobs qu'elle
// accepte — même convention que reporting/queues/reporting-job.types.ts.
export const NOTIFICATIONS_QUEUE = 'notifications';

export const NOTIFICATIONS_JOB = {
  SEND_EMAIL: 'send-email',
  SEND_SMS: 'send-sms',
  SEND_WHATSAPP: 'send-whatsapp',
} as const;

// Le contenu déjà rendu (sujet/corps) voyage avec le job — NotificationLog
// ne stocke pas le texte envoyé (seulement les métadonnées : destinataire,
// statut, erreur), donc le worker ne peut pas le reconstituer depuis la
// base. `notificationLogId` sert uniquement à réécrire le statut final
// (ENVOYE/ECHEC) sur la ligne déjà créée par NotificationsService.notify().
// CH-050 suite — pièce jointe optionnelle (facture PDF uniquement à ce
// stade). Base64 plutôt qu'un Buffer brut : les jobs BullMQ sont
// sérialisés en JSON, un Buffer ne survivrait pas la sérialisation tel
// quel. Une facture PDF pèse quelques Ko (voir invoice.pdf.spec.ts) — sans
// commune mesure avec les limites de taille de payload Redis/BullMQ.
export interface EmailAttachment {
  filename: string;
  contentBase64: string;
}

export interface SendEmailJobData {
  notificationLogId: number;
  destinataire: string;
  sujet: string;
  corps: string;
  attachment?: EmailAttachment;
}

// SMS : pas de sujet, canal texte brut uniquement (pas de média — jamais
// utilisé pour les factures, contrairement à EMAIL/WHATSAPP).
export interface SendSmsJobData {
  notificationLogId: number;
  destinataire: string;
  corps: string;
}

// CH-050 suite — mediaUrl optionnel (lien public InvoiceDownloadToken) :
// Twilio le récupère lui-même côté serveur, jamais transmis en pièce jointe
// binaire ici (contrairement à EMAIL) — voir TwilioService.sendWhatsapp.
export interface SendWhatsappJobData {
  notificationLogId: number;
  destinataire: string;
  corps: string;
  mediaUrl?: string;
}
