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
import { useDuplicateWarning } from '../useDuplicateWarning';

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

// Batch 3 (docs/design/design_handoff_batch3/Clients.dc.html) — pastilles
// colorées par catégorie CRM, alignées sur les tokens sémantiques existants
// (warning=or pour VIP, info=bleu-violet pour Agence, destructive=rouge pour
// Liste noire) plutôt que d'introduire de nouvelles couleurs par écran.
const CATEGORIE_BADGE_VARIANT: Record<
  CategorieClient,
  'outline' | 'warning' | 'brand' | 'info' | 'destructive'
> = {
  STANDARD: 'outline',
  VIP: 'warning',
  ENTREPRISE: 'brand',
  AGENCE: 'info',
  BLACKLIST: 'destructive',
};

function formatClientDepuis(createdAt: string) {
  return new Date(createdAt).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
}

// Écran CRM (cahier des charges §5.7, Phase 2 ; refonte visuelle batch 3
// design handoff, Clients.dc.html) : recherche/liste des clients, fiche
// client (historique des séjours, factures) et changement de catégorie avec
// motif obligatoire (trace d'audit dédiée GuestCategoryLog côté backend —
// CLAUDE.md règle 4). BLACKLIST est la seule catégorie à effet bloquant réel,
// appliqué au moment de la réservation/du check-in via GuestPicker, pas ici.
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
    <div className="flex h-full flex-col gap-5 overflow-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un client (nom, téléphone, pièce d'identité…)"
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Nouveau client
        </Button>
      </div>

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}

      <div className="grid grid-cols-[340px_1fr] items-start gap-4">
        <div className="flex flex-col gap-2">
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
                className={`bg-card flex items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors hover:shadow-sm ${
                  selected?.id === guest.id
                    ? 'border-primary ring-primary/20 ring-1'
                    : 'hover:border-muted-foreground/30'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {guest.nom} {guest.prenom}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {guest.telephone ?? 'Aucun téléphone renseigné'}
                  </p>
                </div>
                <Badge
                  variant={CATEGORIE_BADGE_VARIANT[guest.categorie]}
                  className="shrink-0"
                >
                  {CATEGORIE_LABEL[guest.categorie]}
                </Badge>
              </button>
            ))
          )}
        </div>

        {selected ? (
          <GuestDetail
            key={selected.id}
            guest={selected}
            onCategorieChanged={handleGuestUpdated}
          />
        ) : (
          <div className="bg-card text-muted-foreground rounded-lg border p-8 text-center text-sm">
            Sélectionnez un client dans la liste pour voir sa fiche.
          </div>
        )}
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
    <div className="bg-card flex flex-col gap-4 rounded-lg border p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold">
              {guest.nom} {guest.prenom}
            </h2>
            <Badge variant={CATEGORIE_BADGE_VARIANT[guest.categorie]}>
              {CATEGORIE_LABEL[guest.categorie]}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {[
              guest.telephone,
              guest.email,
              guest.pieceIdentite,
              guest.nationalite,
            ]
              .filter(Boolean)
              .join(' · ') || 'Aucune coordonnée renseignée'}
          </p>
        </div>
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          Client depuis {formatClientDepuis(guest.createdAt)}
        </span>
      </div>

      <form
        className="bg-muted/40 flex flex-col gap-3 rounded-md border p-3.5"
        onSubmit={(e) => void handleSaveCategorie(e)}
      >
        <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
          Changer la catégorie CRM
        </span>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategorie(c)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                categorie === c
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'bg-card hover:bg-muted text-muted-foreground'
              }`}
            >
              {CATEGORIE_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <Label htmlFor="motif" className="text-xs font-normal">
              Motif (obligatoire, tracé dans l'audit)
            </Label>
            <Input
              id="motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex. Séjours répétés, incident réglé…"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={saving || !motif.trim() || categorie === guest.categorie}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
        <p className="text-muted-foreground text-[11px]">
          Basculer vers/depuis <strong>Liste noire</strong> requiert le rôle
          Administrateur — consigné automatiquement dans le journal d'audit.
        </p>
      </form>
      {saveError && <p className="text-destructive text-sm">{saveError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
              Historique des séjours
            </span>
            <div className="overflow-hidden rounded-md border">
              <div className="bg-muted/60 text-muted-foreground grid grid-cols-[80px_1fr_1fr_100px] gap-2 px-3.5 py-2 text-[11px] font-bold">
                <span>Chambre</span>
                <span>Arrivée</span>
                <span>Départ</span>
                <span>Statut</span>
              </div>
              {historique.length === 0 ? (
                <p className="text-muted-foreground border-t px-3.5 py-3 text-xs">
                  Aucun séjour.
                </p>
              ) : (
                historique.map((stay) => (
                  <div
                    key={stay.id}
                    className="grid grid-cols-[80px_1fr_1fr_100px] items-center gap-2 border-t px-3.5 py-2 text-xs"
                  >
                    <span className="font-medium">{stay.room.numero}</span>
                    <span>{stay.dateCheckin.slice(0, 10)}</span>
                    <span>
                      {(
                        stay.dateCheckoutReelle ?? stay.dateCheckoutPrevue
                      ).slice(0, 10)}
                    </span>
                    <Badge
                      variant={
                        stay.statut === 'EN_COURS' ? 'success' : 'outline'
                      }
                      className="w-fit"
                    >
                      {stay.statut === 'EN_COURS' ? 'En cours' : 'Terminé'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
              Factures
            </span>
            <div className="overflow-hidden rounded-md border">
              <div className="bg-muted/60 text-muted-foreground grid grid-cols-[1fr_120px_110px] gap-2 px-3.5 py-2 text-[11px] font-bold">
                <span>Numéro</span>
                <span>Montant</span>
                <span>Statut</span>
              </div>
              {factures.length === 0 ? (
                <p className="text-muted-foreground border-t px-3.5 py-3 text-xs">
                  Aucune facture.
                </p>
              ) : (
                factures.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="grid grid-cols-[1fr_120px_110px] items-center gap-2 border-t px-3.5 py-2 text-xs"
                  >
                    <span>{invoice.numero}</span>
                    <span>{invoice.montantTotal} MAD</span>
                    <Badge
                      variant={
                        invoice.statut === 'EMISE' ? 'success' : 'destructive'
                      }
                      className="w-fit"
                    >
                      {invoice.statut === 'EMISE' ? 'Émise' : 'Avoir émis'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
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
  const duplicates = useDuplicateWarning(email, telephone);

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
        <div className="grid grid-cols-2 gap-3">
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
              placeholder="CNIE ou Passeport"
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
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="preferences">Préférences</Label>
          <Input
            id="preferences"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder="Ex. étage élevé, oreiller ferme…"
          />
        </div>

        {duplicates.length > 0 && (
          <div className="border-warning/50 bg-warning/10 text-warning rounded-md border p-2 text-xs">
            <p className="font-medium">
              Client(s) potentiellement déjà en base (email/téléphone similaire)
              :
            </p>
            <ul className="mt-1 list-inside list-disc">
              {duplicates.map((d) => (
                <li key={d.id}>
                  {d.nom} {d.prenom}
                  {d.telephone ? ` — ${d.telephone}` : ''}
                  {d.email ? ` — ${d.email}` : ''}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-1">
              Vérification informative — la création reste possible.
            </p>
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        <p className="text-muted-foreground text-xs">
          Nationalité obligatoire (fiche de police) — la pièce d'identité (CNIE
          ou Passeport) reste requise avant tout check-in, même si absente ici.
        </p>

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
