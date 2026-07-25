import { Building2, CreditCard, FileCheck, Users } from "lucide-react";
import type { Company } from "../types";

interface Props {
  companies: Company[];
}

export function CompanyKPIs({ companies }: Props) {
  const totalCompanies = companies.length;
  const withIce = companies.filter((c) => c.ice && c.ice.trim() !== "").length;
  const totalCreditLimit = companies.reduce(
    (acc, c) => acc + (c.plafondCredit ? parseFloat(c.plafondCredit) || 0 : 0),
    0,
  );
  const totalContacts = companies.reduce(
    (acc, c) => acc + (c.contacts ? c.contacts.length : 0),
    0,
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-xl border border-border/80 bg-gradient-to-br from-card to-muted/30 p-3.5 flex items-center justify-between shadow-xs">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Total Entreprises
          </p>
          <p className="text-xl font-extrabold tracking-tight mt-0.5">
            {totalCompanies}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Comptes City Ledger enregistrés
          </p>
        </div>
        <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Building2 className="size-4" />
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-gradient-to-br from-card to-muted/30 p-3.5 flex items-center justify-between shadow-xs">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Entreprises avec ICE
          </p>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
            {withIce}
            <span className="text-xs text-muted-foreground font-normal ml-1">
              / {totalCompanies}
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Conformité fiscale DGI
          </p>
        </div>
        <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <FileCheck className="size-4" />
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-gradient-to-br from-card to-muted/30 p-3.5 flex items-center justify-between shadow-xs">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Plafond Crédit Global
          </p>
          <p className="text-xl font-extrabold tracking-tight mt-0.5 font-mono text-amber-600 dark:text-amber-400">
            {totalCreditLimit.toLocaleString("fr-FR")} MAD
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Autorisations d'encours
          </p>
        </div>
        <div className="size-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <CreditCard className="size-4" />
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-gradient-to-br from-card to-muted/30 p-3.5 flex items-center justify-between shadow-xs">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Contacts Référents
          </p>
          <p className="text-xl font-extrabold tracking-tight mt-0.5">
            {totalContacts}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Interlocuteurs de réservation
          </p>
        </div>
        <div className="size-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <Users className="size-4" />
        </div>
      </div>
    </div>
  );
}
