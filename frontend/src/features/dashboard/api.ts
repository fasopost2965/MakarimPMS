import { apiRequest } from '@/lib/api-client';
import type { DashboardResume } from './types';

export function getDashboardResume() {
  return apiRequest<DashboardResume>('/dashboard/resume');
}
