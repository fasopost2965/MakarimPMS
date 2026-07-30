import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addCompanyContact,
  createCompany,
  getCompany,
  removeCompanyContact,
  searchCompanies,
  updateCompany,
} from '../api';
import type {
  Company,
  CreateCompanyContactInput,
  CreateCompanyInput,
} from '../types';

function formatPartenaireDepuis(createdAt: string) {
  return new Date(createdAt).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
}

// Écran Comptes entreprise / City Ledger (cahier des charges §5.7, "Comptes
// entreprise" ; refonte visuelle batch 3 design handoff, Entreprises.dc.html).
// Annuaire autonome : aucune donnée de compte courant réelle n'existe encore
// (aucun séjour/facture n'est rattaché à une société dans cette itération,
// voir le commentaire sur le modèle Company côté backend) — le bloc "compte
// courant" affiche donc un texte statique honnête plutôt qu'un chiffre
// calculé à partir de rien.
export function CompaniesPage() {
  const [query, setQuery] = useState('');
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
      setLoadError(err instanceof Error ? err.message : 'Erreur de chargement');
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
      setCreateError(err instanceof Error ? err.message : 'Erreur');
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

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une entreprise (raison sociale, ICE…)"
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Nouvelle entreprise
        </Button>
      </div>

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-none basis-[280px] flex-col gap-2">
          {loading ? (
            <p className="text-muted-foreground text-sm">Chargement…</p>
          ) : companies.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune entreprise.</p>
          ) : (
            companies.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => setSelected(company)}
                className={`bg-card flex items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors hover:shadow-sm ${
                  selected?.id === company.id
                    ? 'border-primary ring-primary/20 ring-1'
                    : 'hover:border-muted-foreground/30'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {company.raisonSociale}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {company.ice ? `ICE ${company.ice}` : 'Aucune fiche ICE'}
                  </p>
                </div>
                <Badge
                  variant={company.ice ? 'success' : 'warning'}
                  className="shrink-0"
                >
                  {company.ice ? 'ICE renseigné' : 'ICE manquant'}
                </Badge>
              </button>
            ))
          )}
        </div>

        <div className="min-w-0 flex-1">
          {selected ? (
            <CompanyDetail
              key={selected.id}
              company={selected}
              onCompanyUpdated={handleCompanyUpdated}
            />
          ) : (
            <div className="bg-card text-muted-foreground rounded-lg border p-8 text-center text-sm">
              Sélectionnez une entreprise dans la liste pour voir sa fiche.
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="bg-muted/40 rounded-lg border p-4">
          <p className="text-sm font-semibold">Compte courant</p>
          <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
            0,00 MAD — aucun mouvement enregistré. Le rattachement des séjours
            et factures aux comptes entreprise arrive dans une itération future.
          </p>
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(next) => !next && setCreateOpen(false)}
      >
        <DialogContent>
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
    company.conditionsPaiement ?? '',
  );
  const [plafondCredit, setPlafondCredit] = useState(
    company.plafondCredit ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [contactNom, setContactNom] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactTelephone, setContactTelephone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
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
      setSaveError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddContact(input: CreateCompanyContactInput) {
    setContactError(null);
    setAddingContact(true);
    try {
      await addCompanyContact(company.id, input);
      setContactNom('');
      setContactRole('');
      setContactTelephone('');
      setContactEmail('');
      onCompanyUpdated(await getCompany(company.id));
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'Erreur');
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
      setContactError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setRemovingContactId(null);
    }
  }

  return (
    <div className="bg-card flex flex-col gap-4 rounded-lg border p-5">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold">{company.raisonSociale}</h2>
          <Badge variant={company.ice ? 'success' : 'warning'}>
            {company.ice ? 'ICE renseigné' : 'ICE manquant'}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {company.ice ? `ICE ${company.ice} · ` : ''}Entreprise partenaire
          depuis {formatPartenaireDepuis(company.createdAt)}
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => void handleSave(e)}
      >
        <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
          <Label htmlFor="conditionsPaiement">Conditions de paiement</Label>
          <Input
            id="conditionsPaiement"
            value={conditionsPaiement}
            onChange={(e) => setConditionsPaiement(e.target.value)}
            placeholder="Ex. 30 jours"
          />
        </div>
        <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
          <Label htmlFor="plafondCredit">Limite de crédit (MAD)</Label>
          <Input
            id="plafondCredit"
            type="number"
            min="0"
            step="0.01"
            value={plafondCredit}
            onChange={(e) => setPlafondCredit(e.target.value)}
            placeholder="Non définie"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={saving}
          className="shrink-0"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>
      {saveError && <p className="text-destructive text-sm">{saveError}</p>}

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
          Contacts
        </span>
        {company.contacts.length === 0 ? (
          <p className="text-muted-foreground text-xs">Aucun contact.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {company.contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
              >
                <span>
                  {contact.nom}
                  {contact.role ? ` (${contact.role})` : ''}
                  {contact.telephone ? ` — ${contact.telephone}` : ''}
                  {contact.email ? ` — ${contact.email}` : ''}
                </span>
                <button
                  type="button"
                  className="text-destructive shrink-0 font-semibold hover:underline disabled:opacity-50"
                  disabled={removingContactId === contact.id}
                  onClick={() => void handleRemoveContact(contact.id)}
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          className="mt-1 flex flex-wrap items-end gap-2"
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
          <Input
            value={contactNom}
            onChange={(e) => setContactNom(e.target.value)}
            placeholder="Nom"
            className="w-32"
          />
          <Input
            value={contactRole}
            onChange={(e) => setContactRole(e.target.value)}
            placeholder="Rôle"
            className="w-28"
          />
          <Input
            value={contactTelephone}
            onChange={(e) => setContactTelephone(e.target.value)}
            placeholder="Téléphone"
            className="w-32"
          />
          <Input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Email"
            className="w-40"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={addingContact || !contactNom}
            className="shrink-0"
          >
            {addingContact ? 'Ajout…' : '+ Contact'}
          </Button>
        </form>
        {contactError && (
          <p className="text-destructive mt-1 text-sm">{contactError}</p>
        )}
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
  const [raisonSociale, setRaisonSociale] = useState('');
  const [ice, setIce] = useState('');
  const [conditionsPaiement, setConditionsPaiement] = useState('');
  const [plafondCredit, setPlafondCredit] = useState('');

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouvelle entreprise</DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3"
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="raisonSociale">Raison sociale</Label>
          <Input
            id="raisonSociale"
            value={raisonSociale}
            onChange={(e) => setRaisonSociale(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ice">ICE</Label>
          <Input
            id="ice"
            value={ice}
            onChange={(e) => setIce(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="conditionsPaiement">Conditions de paiement</Label>
          <Input
            id="conditionsPaiement"
            value={conditionsPaiement}
            onChange={(e) => setConditionsPaiement(e.target.value)}
            placeholder="Ex. 30 jours"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plafondCredit">Limite de crédit (MAD)</Label>
          <Input
            id="plafondCredit"
            type="number"
            min="0"
            step="0.01"
            value={plafondCredit}
            onChange={(e) => setPlafondCredit(e.target.value)}
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={submitting || !raisonSociale}>
            {submitting ? 'Création…' : "Créer l'entreprise"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
