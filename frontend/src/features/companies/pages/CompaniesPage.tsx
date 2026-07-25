import { useCallback, useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyKPIs } from "../components/CompanyKPIs";
import { CompanyList } from "../components/CompanyList";
import { CompanyDetailView } from "../components/CompanyDetailView";
import { CreateCompanyDialog } from "../components/CreateCompanyDialog";
import { EditCompanyDialog } from "../components/EditCompanyDialog";
import {
  addCompanyContact,
  createCompany,
  getCompany,
  searchCompanies,
  updateCompany,
} from "../api";
import type {
  Company,
  CreateCompanyContactInput,
  CreateCompanyInput,
  UpdateCompanyInput,
} from "../types";

export function CompaniesPage() {
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Company | null>(null);

  // Dialog States
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const refetch = useCallback(
    async (q: string) => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await searchCompanies(q || undefined);
        setCompanies(data);
        if (data.length > 0 && !selected) {
          setSelected(data[0]);
        } else if (data.length > 0 && selected) {
          // preserve or refresh selected company
          const refreshedSelected = data.find((c) => c.id === selected.id);
          if (refreshedSelected) setSelected(refreshedSelected);
        }
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? err.message
            : "Erreur de chargement des entreprises",
        );
      } finally {
        setLoading(false);
      }
    },
    [selected],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void refetch(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, refetch]);

  // Handle Create Company with optional Initial Contact
  async function handleCreateCompany(
    input: CreateCompanyInput,
    initialContact?: CreateCompanyContactInput,
  ) {
    setCreateError(null);
    setCreating(true);
    try {
      const created = await createCompany(input);
      if (initialContact && initialContact.nom) {
        await addCompanyContact(created.id, initialContact);
      }
      setCreateOpen(false);
      const updatedList = await searchCompanies(query);
      setCompanies(updatedList);
      const fullCreated =
        updatedList.find((c) => c.id === created.id) || created;
      setSelected(fullCreated);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Erreur lors de la création",
      );
    } finally {
      setCreating(false);
    }
  }

  // Handle Edit Company
  async function handleUpdateCompany(id: number, input: UpdateCompanyInput) {
    setEditError(null);
    setEditing(true);
    try {
      const updated = await updateCompany(id, input);
      setEditOpen(false);
      const fullUpdated = await getCompany(updated.id);
      setSelected(fullUpdated);
      setCompanies((prev) =>
        prev.map((c) => (c.id === fullUpdated.id ? fullUpdated : c)),
      );
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Erreur lors de la mise à jour",
      );
    } finally {
      setEditing(false);
    }
  }

  function handleCompanyUpdated(updated: Company) {
    setSelected(updated);
    setCompanies((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c)),
    );
  }

  return (
    <div className="flex h-full flex-col gap-5 p-6 bg-background overflow-hidden">
      {/* MODULE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Building2 className="size-4" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              Comptes Entreprises & City Ledger
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gestion des comptes sociétés, conventions tarifaires, interlocuteurs
            et clients rattachés
          </p>
        </div>

        <Button
          onClick={() => setCreateOpen(true)}
          className="h-9 px-4 text-xs font-bold gap-1.5 shrink-0 shadow-xs"
        >
          <Plus className="size-4" />
          <span>+ Nouvelle entreprise</span>
        </Button>
      </div>

      {/* TOP SUMMARY KPIS */}
      <CompanyKPIs companies={companies} />

      {loadError && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
          {loadError}
        </div>
      )}

      {/* SPLIT SCREEN MASTER-DETAIL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: COMPANY LIST */}
        <div className="lg:col-span-5 h-full min-h-0 overflow-hidden">
          <CompanyList
            companies={companies}
            selectedId={selected?.id || null}
            onSelect={(c) => setSelected(c)}
            onCreateClick={() => setCreateOpen(true)}
            loading={loading}
            searchQuery={query}
            onSearchChange={setQuery}
          />
        </div>

        {/* RIGHT COLUMN: DETAIL VIEW */}
        <div className="lg:col-span-7 h-full min-h-0 overflow-hidden">
          {selected ? (
            <CompanyDetailView
              key={selected.id}
              company={selected}
              onCompanyUpdated={handleCompanyUpdated}
              onEditCompanyClick={() => setEditOpen(true)}
            />
          ) : (
            <div className="h-full rounded-xl border border-dashed border-border bg-card/50 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <Building2 className="size-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  Sélectionnez une entreprise
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Choisissez une entreprise dans la liste de gauche pour
                  consulter ses informations, interlocuteurs, et clients
                  rattachés.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="h-8 text-xs font-semibold gap-1.5 mt-2"
              >
                <Plus className="size-3.5" />
                <span>Nouvelle entreprise</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* DIALOGS */}
      <CreateCompanyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onConfirm={handleCreateCompany}
        submitting={creating}
        error={createError}
      />

      <EditCompanyDialog
        open={editOpen}
        company={selected}
        onClose={() => setEditOpen(false)}
        onConfirm={handleUpdateCompany}
        submitting={editing}
        error={editError}
      />
    </div>
  );
}
