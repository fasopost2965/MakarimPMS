import { apiRequest } from '@/lib/api-client';
import type {
  CreateNotificationTemplateInput,
  NotificationLog,
  NotificationTemplate,
  UpdateNotificationTemplateInput,
} from './types';

export function listTemplates() {
  return apiRequest<NotificationTemplate[]>('/notifications/templates');
}

export function createTemplate(input: CreateNotificationTemplateInput) {
  return apiRequest<NotificationTemplate>('/notifications/templates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTemplate(
  id: number,
  input: UpdateNotificationTemplateInput,
) {
  return apiRequest<NotificationTemplate>(`/notifications/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listLogs() {
  return apiRequest<NotificationLog[]>('/notifications/logs');
}
