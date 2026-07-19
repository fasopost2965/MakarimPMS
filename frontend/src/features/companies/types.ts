export interface CompanyContact {
  id: number;
  companyId: number;
  nom: string;
  role: string | null;
  telephone: string | null;
  email: string | null;
}

export interface Company {
  id: number;
  raisonSociale: string;
  ice: string | null;
  conditionsPaiement: string | null;
  plafondCredit: string | null;
  contacts: CompanyContact[];
  createdAt: string;
}

export interface CreateCompanyInput {
  raisonSociale: string;
  ice?: string;
  conditionsPaiement?: string;
  plafondCredit?: number;
}

export type UpdateCompanyInput = Partial<CreateCompanyInput>;

export interface CreateCompanyContactInput {
  nom: string;
  role?: string;
  telephone?: string;
  email?: string;
}
