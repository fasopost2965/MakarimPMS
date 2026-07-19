import { apiRequest } from '@/lib/api-client';
import type {
  Company,
  CreateCompanyContactInput,
  CreateCompanyInput,
  UpdateCompanyInput,
} from './types';

export function searchCompanies(q?: string) {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  const qs = query.toString();
  return apiRequest<Company[]>(`/companies${qs ? `?${qs}` : ''}`);
}

export function getCompany(id: number) {
  return apiRequest<Company>(`/companies/${id}`);
}

export function createCompany(input: CreateCompanyInput) {
  return apiRequest<Company>('/companies', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCompany(id: number, input: UpdateCompanyInput) {
  return apiRequest<Company>(`/companies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function addCompanyContact(
  companyId: number,
  input: CreateCompanyContactInput,
) {
  return apiRequest<Company['contacts'][number]>(
    `/companies/${companyId}/contacts`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function removeCompanyContact(companyId: number, contactId: number) {
  return apiRequest<void>(`/companies/${companyId}/contacts/${contactId}`, {
    method: 'DELETE',
  });
}
