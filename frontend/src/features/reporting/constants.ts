export interface DepartmentOption {
  id: string;
  label: string;
}

export const DEPARTMENTS: DepartmentOption[] = [
  { id: "housekeeping", label: "Gouvernance & Lingerie" },
  { id: "maintenance", label: "Maintenance & Technique" },
  { id: "reception", label: "Réception & Hébergement" },
  { id: "hr", label: "Ressources Humaines" },
  { id: "restauration", label: "Restauration & Bar" },
  { id: "police", label: "Sécurité & Fiches Police" },
  { id: "finance", label: "Finance & Comptabilité" },
];
