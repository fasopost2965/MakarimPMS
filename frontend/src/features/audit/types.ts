// CH-015 — le backend (GET /audit-logs) existait déjà, mais aucun type
// frontend n'avait jamais été écrit pour le consommer.

export type AuditEntity =
  | 'Guest'
  | 'Reservation'
  | 'Stay'
  | 'Room'
  | 'Payment'
  | 'Invoice'
  | 'HotelConfig'
  | 'TaxRateConfig'
  | 'SeasonRate'
  | 'TimeShift'
  | 'PaySlip'
  | 'POLICE_RECORD'
  | 'RESERVATION_DEPOSIT'
  | 'Folio'
  | 'CancellationPolicy'
  | 'RateRestriction'
  | 'NotificationTemplate'
  | 'ChannelRoomTypeMapping';

export type AuditAction =
  | 'CHANGE_CATEGORY'
  | 'BLACKLIST_CLIENT'
  | 'UPDATE_PRICE'
  | 'CANCEL_RESERVATION'
  | 'UPDATE_HOTEL_CONFIG'
  | 'UPDATE_TAX_RATE'
  | 'CREATE_TAX_RATE'
  | 'CREATE_SEASON_RATE'
  | 'UPDATE_SEASON_RATE'
  | 'DELETE_SEASON_RATE'
  | 'ADJUST_TIME_SHIFT'
  | 'INVALIDATE_TIME_SHIFT'
  | 'AUTO_CLOSE_TIME_SHIFT'
  | 'VALIDATE_PAYSLIP'
  | 'CREATE_POLICE_RECORD'
  | 'CREATE_DEPOSIT'
  | 'IMPUTE_DEPOSIT'
  | 'REFUND_DEPOSIT'
  | 'EXCLUDE_FOLIO_TAX'
  | 'CREATE_CANCELLATION_POLICY'
  | 'UPDATE_CANCELLATION_POLICY'
  | 'MARK_NO_SHOW'
  | 'CREATE_RATE_RESTRICTION'
  | 'UPDATE_RATE_RESTRICTION'
  | 'DELETE_RATE_RESTRICTION'
  | 'CREATE_NOTIFICATION_TEMPLATE'
  | 'UPDATE_NOTIFICATION_TEMPLATE'
  | 'CREATE_CHANNEL_ROOM_TYPE_MAPPING'
  | 'DELETE_CHANNEL_ROOM_TYPE_MAPPING'
  | 'CREATE_CREDIT_NOTE'
  | 'FORCE_CHECKOUT';

export interface AuditLogEntry {
  id: string;
  userId: number | null;
  action: AuditAction;
  targetEntity: AuditEntity;
  targetId: number;
  oldValue: unknown;
  newValue: unknown;
  motif: string;
  createdAt: string;
}

export interface AuditLogFilters {
  entite?: AuditEntity;
  userId?: number;
  action?: AuditAction;
  du?: string;
  au?: string;
}
