import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createGuest,
  getGuestFactures,
  getGuestHistorique,
  searchGuests,
  updateGuestCategorie,
} from '../api';
import type {
  CategorieClient,
  CreateGuestInput,
  Guest,
  GuestInvoice,
  GuestStayHistorique,
} from '../types';

const CATEGORIES: CategorieClient[] = [
  'STANDARD',
  'VIP',
  'ENTREPRISE',
  'AGENCE',
  'BLACKLIST',
];

const CATEGORIE_LABEL: Record<CategorieClient, string> = {
  STANDARD: 'Standard',
  VIP: 'VIP',
  ENTREPRISE: 'Entreprise',
  AGENCE: 'Agence',
  BLACKLIST: 'Liste noire',
};

const CATEGORIE_BADGE_VARIANT: Record<
  CategorieClient,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  STANDARD: 'outline',
  VIP: 'default',
  ENTREPRISE: 'secondary',
  AGENCE: 'secondary',
  BLACKLIST: 'destructive',
};

// Écran CRM (cahier des charges §5.7, Phase 2) : recherche/liste des clients,
// fiche client (historique des séjours, factures) et changement de catégorie
// avec motif obligatoire (trace d'audit dédiée GuestCategoryLog côté
// backend — CLAUDE.md règle 4). BLACKLIST est la seule catégorie à effet
// bloquant réel, appliqué au moment de la réservation/du check-in via
// GuestPicker, pas ici.
export function GuestsPage() {
  const [query, setQuery] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Guest | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const refetch = useCallback(async (q: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      setGuests(await searchGuests(q || undefined));
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

  async function handleCreate(input: CreateGuestInput) {
    setCreateError(null);
    setCreating(true);
    try {
      await createGuest(input);
      setCreateOpen(false);
      await refetch(query);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setCreating(false);
    }
  }

  function handleGuestUpdated(updated: Guest) {
    setSelected(updated);
    setGuests((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Nouveau client
        </Button>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un client (nom, téléphone, pièce d'identité…)"
        className="max-w-sm"
      />

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      <div className="grid flex-1 grid-cols-2 gap-4 overflow-hidden">
        <div className="flex flex-col gap-2 overflow-auto">
          {loading ? (
            <p className="text-muted-foreground text-sm">Chargement…</p>
          ) : guests.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun client.</p>
          ) : (
            guests.map((guest) => (
              <button
                key={guest.id}
                type="button"
                onClick={() => setSelected(guest)}
                className={`hover:bg-muted flex items-center justify-between gap-2 rounded-md border p-3 text-left ${
                  selected?.id === guest.id ? 'border-primary' : ''
                }`}
              >
                <div>
                  <p className="text-sm font-medium">
                    {guest.nom} {guest.prenom}
                  </p>
                  {guest.telephone && (
                    <p className="text-muted-foreground text-xs">
                      {guest.telephone}
                    </p>
                  )}
                </div>
                <Badge variant={CATEGORIE_BADGE_VARIANT[guest.categorie]}>
                  {CATEGORIE_LABEL[guest.categorie]}
                </Badge>
              </button>
            ))
          )}
        </div>

        <div className="overflow-auto">
          {selected && (
            <GuestDetail
              key={selected.id}
              guest={selected}
              onCategorieChanged={handleGuestUpdated}
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
            <CreateGuestForm
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

interface GuestDetailProps {
  guest: Guest;
  onCategorieChanged: (guest: Guest) => void;
}

function GuestDetail({ guest, onCategorieChanged }: GuestDetailProps) {
  const [historique, setHistorique] = useState<GuestStayHistorique[]>([]);
  const [factures, setFactures] = useState<GuestInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [categorie, setCategorie] = useState<CategorieClient>(guest.categorie);
  const [motif, setMotif] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([getGuestHistorique(guest.id), getGuestFactures(guest.id)])
      .then(([h, f]) => {
        if (!cancelled) {
          setHistorique(h);
          setFactures(f);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [guest.id]);

  async function handleSaveCategorie(e: FormEvent) {
    e.preventDefault();
    if (!motif.trim()) return;
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await updateGuestCategorie(guest.id, {
        categorie,
        motif: motif.trim(),
      });
      onCategorieChanged(updated);
      setMotif('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border p-4">
      <div>
        <h2 className="text-lg font-medium">
          {guest.nom} {guest.prenom}
        </h2>
        <p className="text-muted-foreground text-sm">
          {[guest.telephone, guest.email, guest.pieceIdentite]
            .filter(Boolean)
            .join(' · ') || 'Aucune coordonnée renseignée'}
        </p>
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => void handleSaveCategorie(e)}
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="categorie">Catégorie</Label>
          <Select
            value={categorie}
            onValueChange={(v) => v && setCategorie(v as CategorieClient)}
            items={CATEGORIES.map((c) => ({
              value: c,
              label: CATEGORIE_LABEL[c],
            }))}
          >
            <SelectTrigger id="categorie" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORIE_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="motif">Motif</Label>
          <Input
            id="motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Obligatoire"
          />
        </div>
        <Button
          type="submit"
          disabled={saving || !motif.trim() || categorie === guest.categorie}
        >
          {saving ? 'Enregistrement…' : 'Changer'}
        </Button>
      </form>
      {saveError && <p className="text-destructive text-sm">{saveError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <>
          <div>
            <h3 className="mb-1 text-sm font-medium">Historique des séjours</h3>
            {historique.length === 0 ? (
              <p className="text-muted-foreground text-xs">Aucun séjour.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {historique.map((stay) => (
                  <li key={stay.id} className="text-xs">
                    Chambre {stay.room.numero} — du{' '}
                    {stay.dateCheckin.slice(0, 10)} au{' '}
                    {(stay.dateCheckoutReelle ?? stay.dateCheckoutPrevue).slice(
                      0,
                      10,
                    )}{' '}
                    ({stay.statut})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-1 text-sm font-medium">Factures</h3>
            {factures.length === 0 ? (
              <p className="text-muted-foreground text-xs">Aucune facture.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {factures.map((invoice) => (
                  <li key={invoice.id} className="text-xs">
                    {invoice.numero} — {invoice.montantTotal} MAD (
                    {invoice.statut})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface CreateGuestFormProps {
  onClose: () => void;
  onConfirm: (input: CreateGuestInput) => void;
  submitting: boolean;
  error: string | null;
}

function CreateGuestForm({
  onClose,
  onConfirm,
  submitting,
  error,
}: CreateGuestFormProps) {
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [pieceIdentite, setPieceIdentite] = useState('');
  const [nationalite, setNationalite] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [preferences, setPreferences] = useState('');

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouveau client</DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nom || !prenom) return;
          onConfirm({
            nom,
            prenom,
            pieceIdentite: pieceIdentite || undefined,
            nationalite: nationalite || undefined,
            telephone: telephone || undefined,
            email: email || undefined,
            preferences: preferences || undefined,
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nom">Nom</Label>
          <Input
            id="nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prenom">Prénom</Label>
          <Input
            id="prenom"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pieceIdentite">Pièce d'identité</Label>
          <Input
            id="pieceIdentite"
            value={pieceIdentite}
            onChange={(e) => setPieceIdentite(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nationalite">Nationalité</Label>
          <Input
            id="nationalite"
            value={nationalite}
            onChange={(e) => setNationalite(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telephone">Téléphone</Label>
          <Input
            id="telephone"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="preferences">Préférences</Label>
          <Input
            id="preferences"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
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
          <Button type="submit" disabled={submitting || !nom || !prenom}>
            {submitting ? 'Création…' : 'Créer le client'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
