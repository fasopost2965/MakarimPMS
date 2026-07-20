import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
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

// Écran Comptes entreprise / City Ledger (cahier des charges §5.7, "Comptes
// entreprise"). Annuaire autonome : aucune donnée de compte courant réelle
// n'existe encore (aucun séjour/facture n'est rattaché à une société dans
// cette itération, voir le commentaire sur le modèle Company côté backend)
// — le bloc "compte courant" affiche donc un texte statique honnête plutôt
// qu'un chiffre calculé à partir de rien.
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
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium">Entreprises</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Nouvelle entreprise
        </Button>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher une entreprise (raison sociale, ICE…)"
        className="max-w-sm"
      />

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      <div className="grid flex-1 grid-cols-2 gap-4 overflow-hidden">
        <div className="flex flex-col gap-2 overflow-auto">
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
                className={`hover:bg-muted flex flex-col items-start gap-0.5 rounded-md border p-3 text-left ${
                  selected?.id === company.id ? 'border-primary' : ''
                }`}
              >
                <p className="text-sm font-medium">{company.raisonSociale}</p>
                {company.ice && (
                  <p className="text-muted-foreground text-xs">
                    ICE {company.ice}
                  </p>
                )}
              </button>
            ))
          )}
        </div>

        <div className="overflow-auto">
          {selected && (
            <CompanyDetail
              key={selected.id}
              company={selected}
              onCompanyUpdated={handleCompanyUpdated}
            />
          )}
        </div>
      </div>

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
    <div className="flex flex-col gap-4 rounded-md border p-4">
      <div>
        <h2 className="text-lg font-medium">{company.raisonSociale}</h2>
        {company.ice && (
          <p className="text-muted-foreground text-sm">ICE {company.ice}</p>
        )}
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => void handleSave(e)}
      >
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
            placeholder="Non définie"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Compte courant</Label>
          <p className="text-muted-foreground text-sm">
            0,00 MAD — aucun mouvement enregistré. Le rattachement des séjours
            et factures aux comptes entreprise sera ajouté dans un module futur.
          </p>
        </div>

        {saveError && <p className="text-destructive text-sm">{saveError}</p>}

        <Button
          type="submit"
          size="sm"
          disabled={saving}
          className="self-start"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-medium">Contacts</h3>
        {company.contacts.length === 0 ? (
          <p className="text-muted-foreground text-xs">Aucun contact.</p>
        ) : (
          <ul className="mb-2 flex flex-col gap-1">
            {company.contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span>
                  {contact.nom}
                  {contact.role ? ` (${contact.role})` : ''}
                  {contact.telephone ? ` — ${contact.telephone}` : ''}
                  {contact.email ? ` — ${contact.email}` : ''}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={removingContactId === contact.id}
                  onClick={() => void handleRemoveContact(contact.id)}
                >
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex flex-wrap items-end gap-2"
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
            disabled={addingContact || !contactNom}
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
