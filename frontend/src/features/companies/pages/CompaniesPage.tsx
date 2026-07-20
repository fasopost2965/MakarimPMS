import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Search,
  Plus,
  CreditCard,
  Phone,
  Mail,
  User,
  Trash2,
  Building,
  ChevronRight,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import {
  addCompanyContact,
  createCompany,
  getCompany,
  removeCompanyContact,
  searchCompanies,
  updateCompany,
} from "../api";
import type {
  Company,
  CreateCompanyContactInput,
  CreateCompanyInput,
} from "../types";

export function CompaniesPage() {
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Company | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const refetch = useCallback(async (q: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      setCompanies(await searchCompanies(q || undefined));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refetch(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, refetch]);

  async function handleCreate(input: CreateCompanyInput) {
    setCreateError(null);
    setCreating(true);
    try {
      await createCompany(input);
      setCreateOpen(false);
      await refetch(query);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erreur de création");
    } finally {
      setCreating(false);
    }
  }

  function handleCompanyUpdated(updated: Company) {
    setSelected(updated);
    setCompanies((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c)),
    );
  }

  // Pre-select first company when loaded
  useEffect(() => {
    if (companies.length > 0 && !selected) {
      setSelected(companies[0]);
    }
  }, [companies, selected]);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-serif font-bold text-foreground">
              Comptes Entreprises & Ledger
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Suivez les conditions de facturation, les plafonds de crédit et les contacts officiels de vos entreprises partenaires.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gap-2 self-start sm:self-auto shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Nouvelle entreprise
        </Button>
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive text-sm">
          {loadError}
        </div>
      )}

      {/* Grid structure: directory left, detail right */}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden min-h-0">
        {/* Left pane: search and selection list */}
        <div className="lg:col-span-5 flex flex-col gap-3 h-full min-h-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une entreprise (raison sociale, ICE...)"
              className="pl-9 h-9.5 text-xs bg-card"
            />
          </div>

          <div className="flex-1 overflow-auto pr-1 flex flex-col gap-2">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-16 justify-center">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Chargement...
              </div>
            ) : companies.length === 0 ? (
              <div className="rounded-xl border border-dashed py-16 text-center bg-card">
                <Building className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold text-muted-foreground">Aucune entreprise trouvée</p>
                <p className="text-xs text-muted-foreground mt-0.5">Vérifiez les critères ou ajoutez un compte.</p>
              </div>
            ) : (
              companies.map((company) => {
                const isSelected = selected?.id === company.id;
                const companyInitials = company.raisonSociale.slice(0, 2).toUpperCase();

                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => setSelected(company)}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all hover:bg-muted ${
                      isSelected
                        ? "border-primary bg-primary/[0.02] ring-1 ring-primary/30"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Logo avatar */}
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                      }`}>
                        {companyInitials}
                      </div>

                      <div className="text-left leading-tight">
                        <p className="font-semibold text-sm text-foreground">
                          {company.raisonSociale}
                        </p>
                        {company.ice ? (
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            ICE : {company.ice}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/60 italic mt-0.5">Sans N° ICE</p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {company.plafondCredit && Number(company.plafondCredit) > 0 ? (
                        <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 font-mono">
                          {company.plafondCredit} MAD
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/60">Pas de limite</span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right pane: full corporate ledger details */}
        <div className="lg:col-span-7 h-full overflow-hidden flex flex-col">
          {selected ? (
            <CompanyDetail
              key={selected.id}
              company={selected}
              onCompanyUpdated={handleCompanyUpdated}
            />
          ) : (
            <div className="flex-1 rounded-2xl border border-dashed flex flex-col items-center justify-center p-8 bg-card">
              <Building2 className="h-12 w-12 text-muted-foreground opacity-30 mb-3 animate-pulse" />
              <h3 className="font-serif text-lg font-bold text-foreground">Sélectionnez une entreprise</h3>
              <p className="text-xs text-muted-foreground text-center max-w-sm mt-1">
                Choisissez une entreprise dans la liste de gauche pour configurer son City Ledger, ses plafonds de crédit, et suivre les contacts associés.
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(next) => !next && setCreateOpen(false)}
      >
        <DialogContent className="sm:max-w-[480px]">
          {createOpen && (
            <CreateCompanyForm
              onClose={() => setCreateOpen(false)}
              onConfirm={handleCreate}
              submitting={creating}
              error={createError}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CompanyDetailProps {
  company: Company;
  onCompanyUpdated: (company: Company) => void;
}

function CompanyDetail({ company, onCompanyUpdated }: CompanyDetailProps) {
  const [conditionsPaiement, setConditionsPaiement] = useState(
    company.conditionsPaiement ?? "",
  );
  const [plafondCredit, setPlafondCredit] = useState(
    company.plafondCredit ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [contactNom, setContactNom] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactTelephone, setContactTelephone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [addingContact, setAddingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [removingContactId, setRemovingContactId] = useState<number | null>(
    null,
  );

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await updateCompany(company.id, {
        conditionsPaiement: conditionsPaiement || undefined,
        plafondCredit: plafondCredit ? Number(plafondCredit) : undefined,
      });
      onCompanyUpdated(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddContact(input: CreateCompanyContactInput) {
    setContactError(null);
    setAddingContact(true);
    try {
      await addCompanyContact(company.id, input);
      setContactNom("");
      setContactRole("");
      setContactTelephone("");
      setContactEmail("");
      onCompanyUpdated(await getCompany(company.id));
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Erreur d'ajout");
    } finally {
      setAddingContact(false);
    }
  }

  async function handleRemoveContact(contactId: number) {
    setContactError(null);
    setRemovingContactId(contactId);
    try {
      await removeCompanyContact(company.id, contactId);
      onCompanyUpdated({
        ...company,
        contacts: company.contacts.filter((c) => c.id !== contactId),
      });
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setRemovingContactId(null);
    }
  }

  const initials = company.raisonSociale.slice(0, 2).toUpperCase();

  return (
    <div className="flex-1 overflow-auto rounded-2xl border bg-card p-5.5 shadow-sm flex flex-col gap-5 text-left h-full">
      {/* Banner Card */}
      <div className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-secondary/20 border-border/80">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary font-serif text-base font-bold text-primary-foreground shadow-sm">
            {initials}
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-foreground">
              {company.raisonSociale}
            </h2>
            {company.ice && (
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                ICE : {company.ice}
              </p>
            )}
          </div>
        </div>

        <Badge variant="outline" className="font-semibold text-xs border-primary/20 bg-primary/[0.03] text-primary self-start sm:self-auto">
          Partenaire Commercial
        </Badge>
      </div>

      {/* Main split: Ledger conditions config & account ledger */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Conditions Payment Form */}
        <div className="rounded-xl border p-4.5 bg-background shadow-xs flex flex-col gap-4.5">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
            <Briefcase className="h-4 w-4 text-primary" />
            Conditions & Crédit
          </h3>

          <form
            className="flex flex-col gap-3.5"
            onSubmit={(e) => void handleSave(e)}
          >
            <div className="flex flex-col gap-1.5 text-left">
              <Label htmlFor="conditionsPaiement" className="text-xs font-semibold text-muted-foreground uppercase">
                Conditions de règlement
              </Label>
              <Input
                id="conditionsPaiement"
                value={conditionsPaiement}
                onChange={(e) => setConditionsPaiement(e.target.value)}
                placeholder="Ex: Facture à 30 jours fin de mois..."
                className="h-9 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5 text-left">
              <Label htmlFor="plafondCredit" className="text-xs font-semibold text-muted-foreground uppercase">
                Limite de crédit (City Ledger)
              </Label>
              <div className="relative">
                <Input
                  id="plafondCredit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={plafondCredit}
                  onChange={(e) => setPlafondCredit(e.target.value)}
                  placeholder="Aucune limite"
                  className="h-9 text-xs pr-12 font-mono"
                />
                <span className="absolute right-3 top-2.5 text-[10px] font-bold text-muted-foreground">MAD</span>
              </div>
            </div>

            {saveError && <p className="text-destructive text-xs font-semibold">{saveError}</p>}

            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="font-bold text-xs self-start px-4 h-8.5 shadow-2xs"
            >
              {saving ? "Enregistrement..." : "Appliquer"}
            </Button>
          </form>
        </div>

        {/* Current Ledger account status */}
        <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.01] p-4.5 shadow-xs flex flex-col gap-3.5 justify-between">
          <div>
            <h3 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
              <CreditCard className="h-4 w-4" />
              Compte Courant & City Ledger
            </h3>

            <div className="mt-3.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider block">Solde Actuel</span>
              <span className="text-2xl font-mono font-bold text-amber-700 dark:text-amber-500">0,00 MAD</span>
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.03] p-3 text-[10px] text-amber-800/80 dark:text-amber-400/80 leading-relaxed font-medium">
            <AlertCircle className="h-4 w-4 inline mr-1 text-amber-600 dark:text-amber-500 shrink-0 mb-0.5" />
            <span>Aucun mouvement en cours. Le rattachement des factures d'hébergement au compte entreprise différé sera ajouté dans les prochaines intégrations de facturation groupée.</span>
          </div>
        </div>
      </div>

      {/* CRM Contacts Segment */}
      <div className="rounded-xl border p-4.5 bg-background shadow-xs flex flex-col gap-4">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
          <User className="h-4 w-4 text-primary" />
          Contacts Officiels ({company.contacts.length})
        </h3>

        {company.contacts.length === 0 ? (
          <p className="text-muted-foreground text-xs italic py-2">Aucun contact enregistré pour cette société.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 max-h-[160px] overflow-auto pr-1">
            {company.contacts.map((contact) => (
              <li
                key={contact.id}
                className="rounded-lg border p-3 flex flex-col gap-1.5 relative group bg-card hover:border-primary/20 transition-all text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{contact.nom}</span>
                  {contact.role && (
                    <Badge variant="secondary" className="text-[9px] uppercase px-1.5 py-0 h-4 font-semibold">
                      {contact.role}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-0.5 text-muted-foreground text-[10px]">
                  {contact.telephone && (
                    <span className="font-mono flex items-center gap-1">
                      <Phone className="h-3 w-3 inline text-muted-foreground/60" />
                      {contact.telephone}
                    </span>
                  )}
                  {contact.email && (
                    <span className="flex items-center gap-1 truncate max-w-[190px]">
                      <Mail className="h-3 w-3 inline text-muted-foreground/60" />
                      {contact.email}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={removingContactId === contact.id}
                  onClick={() => void handleRemoveContact(contact.id)}
                  className="absolute right-2.5 bottom-2.5 text-rose-500 opacity-0 group-hover:opacity-100 disabled:opacity-50 transition-opacity hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 p-1 rounded-md"
                  title="Retirer le contact"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Form to add a Contact */}
        <div className="mt-2.5 pt-3 border-t">
          <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-2.5">
            Ajouter un nouveau contact commercial
          </span>

          <form
            className="grid gap-3 grid-cols-2 sm:grid-cols-4 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!contactNom) return;
              void handleAddContact({
                nom: contactNom,
                role: contactRole || undefined,
                telephone: contactTelephone || undefined,
                email: contactEmail || undefined,
              });
            }}
          >
            <div className="flex flex-col gap-1 text-left">
              <Label className="text-[9px] font-bold text-muted-foreground uppercase">Nom complet</Label>
              <Input
                value={contactNom}
                onChange={(e) => setContactNom(e.target.value)}
                placeholder="Ex: Benjelloun"
                required
                className="h-8 text-xs bg-card"
              />
            </div>

            <div className="flex flex-col gap-1 text-left">
              <Label className="text-[9px] font-bold text-muted-foreground uppercase">Rôle / Poste</Label>
              <Input
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value)}
                placeholder="Ex: DG, DAF..."
                className="h-8 text-xs bg-card"
              />
            </div>

            <div className="flex flex-col gap-1 text-left">
              <Label className="text-[9px] font-bold text-muted-foreground uppercase">Téléphone</Label>
              <Input
                value={contactTelephone}
                onChange={(e) => setContactTelephone(e.target.value)}
                placeholder="Ex: +212..."
                className="h-8 text-xs bg-card"
              />
            </div>

            <div className="flex flex-col gap-1 text-left">
              <Label className="text-[9px] font-bold text-muted-foreground uppercase">Adresse Email</Label>
              <Input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Ex: d@corp.com"
                className="h-8 text-xs bg-card"
              />
            </div>

            <div className="col-span-2 sm:col-span-4 mt-2 flex justify-end">
              <Button
                type="submit"
                size="sm"
                className="h-8 font-bold text-xs gap-1 shadow-xs"
                disabled={addingContact || !contactNom}
              >
                {addingContact ? "Ajout..." : "+ Enregistrer contact"}
              </Button>
            </div>
          </form>
          {contactError && (
            <p className="text-destructive mt-1.5 text-xs font-semibold">{contactError}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface CreateCompanyFormProps {
  onClose: () => void;
  onConfirm: (input: CreateCompanyInput) => void;
  submitting: boolean;
  error: string | null;
}

function CreateCompanyForm({
  onClose,
  onConfirm,
  submitting,
  error,
}: CreateCompanyFormProps) {
  const [raisonSociale, setRaisonSociale] = useState("");
  const [ice, setIce] = useState("");
  const [conditionsPaiement, setConditionsPaiement] = useState("");
  const [plafondCredit, setPlafondCredit] = useState("");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-xl font-bold tracking-tight text-foreground">
          Nouvelle Fiche Entreprise
        </DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3.5 mt-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!raisonSociale) return;
          onConfirm({
            raisonSociale,
            ice: ice || undefined,
            conditionsPaiement: conditionsPaiement || undefined,
            plafondCredit: plafondCredit ? Number(plafondCredit) : undefined,
          });
        }}
      >
        <div className="flex flex-col gap-1 text-left">
          <Label htmlFor="raisonSociale" className="text-xs font-semibold text-muted-foreground uppercase">
            Raison sociale / Nom complet
          </Label>
          <Input
            id="raisonSociale"
            value={raisonSociale}
            onChange={(e) => setRaisonSociale(e.target.value)}
            placeholder="Ex: Makarim SARL"
            required
            className="h-9.5 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1 text-left">
          <Label htmlFor="ice" className="text-xs font-semibold text-muted-foreground uppercase">
            N° ICE (Identifiant Commun de l'Entreprise)
          </Label>
          <Input
            id="ice"
            value={ice}
            onChange={(e) => setIce(e.target.value)}
            placeholder="Ex: 00158490300..."
            className="h-9.5 text-xs font-mono"
          />
        </div>

        <div className="flex flex-col gap-1 text-left">
          <Label htmlFor="conditionsPaiement" className="text-xs font-semibold text-muted-foreground uppercase">
            Conditions de règlement
          </Label>
          <Input
            id="conditionsPaiement"
            value={conditionsPaiement}
            onChange={(e) => setConditionsPaiement(e.target.value)}
            placeholder="Ex: 30 jours fin de mois, Virement..."
            className="h-9.5 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1 text-left">
          <Label htmlFor="plafondCredit" className="text-xs font-semibold text-muted-foreground uppercase">
            Limite de crédit (MAD)
          </Label>
          <div className="relative">
            <Input
              id="plafondCredit"
              type="number"
              min="0"
              step="0.01"
              value={plafondCredit}
              onChange={(e) => setPlafondCredit(e.target.value)}
              placeholder="Sans limite"
              className="h-9.5 text-xs pr-12 font-mono"
            />
            <span className="absolute right-3 top-2.5 text-xs font-bold text-muted-foreground">MAD</span>
          </div>
        </div>

        {error && <p className="text-destructive text-xs text-center font-semibold mt-1">{error}</p>}

        <DialogFooter className="gap-2 sm:gap-0 mt-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="h-9.5 text-xs font-semibold"
          >
            Annuler
          </Button>
          <Button type="submit" disabled={submitting || !raisonSociale} className="h-9.5 text-xs font-bold">
            {submitting ? (
              <>
                <span className="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Création...
              </>
            ) : (
              "Créer l'entreprise"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
