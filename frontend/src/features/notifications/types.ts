export type EvenementNotification =
  | 'RESERVATION_CONFIRMEE'
  | 'RAPPEL_J_MOINS_1'
  | 'POST_SEJOUR'
  | 'SELF_CHECKIN_LIEN';

export type CanalNotification = 'EMAIL' | 'SMS' | 'WHATSAPP';

export type StatutNotification = 'EN_ATTENTE' | 'ENVOYE' | 'ECHEC' | 'IGNORE';

export interface NotificationTemplate {
  id: number;
  evenement: EvenementNotification;
  canal: CanalNotification;
  sujet: string | null;
  corps: string;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationTemplateInput {
  evenement: EvenementNotification;
  canal: CanalNotification;
  sujet?: string;
  corps: string;
  actif?: boolean;
  motif: string;
}

export interface UpdateNotificationTemplateInput {
  sujet?: string;
  corps?: string;
  actif?: boolean;
  motif: string;
}

export interface NotificationLog {
  id: number;
  guestId: number;
  reservationId: number | null;
  evenement: EvenementNotification;
  canal: CanalNotification;
  destinataire: string;
  statut: StatutNotification;
  erreur: string | null;
  envoyeAt: string | null;
  createdAt: string;
}
