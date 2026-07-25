import { useState } from "react";
import {
  Building2,
  Search,
  Users,
  Plus,
  Clock,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Company } from "../types";

interface Props {
  companies: Company[];
  selectedId: number | null;
  onSelect: (company: Company) => void;
  onCreateClick: () => void;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function CompanyList({
  companies,
  selectedId,
  onSelect,
  onCreateClick,
  loading,
  searchQuery,
  onSearchChange,
}: Props) {
  const [filterIce, setFilterIce] = useState<
    "ALL" | "WITH_ICE" | "WITHOUT_ICE"
  >("ALL");

  const filteredCompanies = companies.filter((c) => {
    if (filterIce === "WITH_ICE" && (!c.ice || !c.ice.trim())) return false;
    if (filterIce === "WITHOUT_ICE" && c.ice && c.ice.trim()) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden shadow-2xs">
      {/* SEARCH AND ACTION BAR */}
      <div className="p-3.5 border-b border-border bg-muted/20 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher par raison sociale, ICE…"
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>

          <Button
            size="sm"
            onClick={onCreateClick}
            className="h-8 text-xs gap-1 font-semibold shrink-0"
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">Nouvelle</span>
          </Button>
        </div>

        {/* QUICK ICE FILTER PILLS */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
          <div className="flex items-center gap-1 font-medium">
            <Filter className="size-3 text-primary" />
            <span>Filtrer:</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFilterIce("ALL")}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                filterIce === "ALL"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              Toutes ({companies.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterIce("WITH_ICE")}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                filterIce === "WITH_ICE"
                  ? "bg-emerald-600 text-white"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              Avec ICE
            </button>
            <button
              type="button"
              onClick={() => setFilterIce("WITHOUT_ICE")}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                filterIce === "WITHOUT_ICE"
                  ? "bg-amber-600 text-white"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              Sans ICE
            </button>
          </div>
        </div>
      </div>

      {/* LIST CONTENT */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Chargement de l'annuaire des entreprises…
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Building2 className="size-8 mx-auto text-muted-foreground/50" />
            <p className="text-xs font-semibold text-muted-foreground">
              {searchQuery
                ? "Aucune entreprise ne correspond à votre recherche."
                : "Aucune entreprise enregistrée."}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={onCreateClick}
              className="h-8 text-xs gap-1"
            >
              <Plus className="size-3.5" />
              <span>Créer une entreprise</span>
            </Button>
          </div>
        ) : (
          filteredCompanies.map((company) => {
            const isSelected = company.id === selectedId;
            const contactsCount = company.contacts?.length || 0;
            const creditLimitNum = company.plafondCredit
              ? parseFloat(company.plafondCredit) || 0
              : 0;

            return (
              <button
                key={company.id}
                type="button"
                onClick={() => onSelect(company)}
                className={`w-full p-3 rounded-xl text-left border transition-all flex items-center justify-between gap-3 group ${
                  isSelected
                    ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/20"
                    : "bg-card hover:bg-muted/30 border-border"
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`size-9 rounded-xl flex items-center justify-center font-bold shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                    }`}
                  >
                    <Building2 className="size-4" />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-foreground truncate">
                        {company.raisonSociale}
                      </span>
                      {company.ice && (
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                        >
                          ICE
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                      {company.ice ? (
                        <span className="font-mono text-[10px]">
                          ICE: {company.ice}
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">
                          ICE Manquant
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <Clock className="size-3 text-muted-foreground" />
                        <span>
                          {company.conditionsPaiement || "Non défini"}
                        </span>
                      </span>

                      {contactsCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="size-3 text-blue-500" />
                          <span>{contactsCount} contact(s)</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {creditLimitNum > 0 && (
                    <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      {creditLimitNum.toLocaleString("fr-FR")} MAD
                    </span>
                  )}
                  <ChevronRight
                    className={`size-4 text-muted-foreground transition-transform ${isSelected ? "translate-x-0.5 text-primary" : ""}`}
                  />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
