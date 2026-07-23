import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { searchGuests } from '../api';
import type { CreateGuestInput, Guest } from '../types';
import { useDuplicateWarning } from '../useDuplicateWarning';

export type GuestSelection = { guestId: number } | { guest: CreateGuestInput };

interface GuestPickerProps {
  onChange: (selection: GuestSelection | null) => void;
}

const CATEGORIE_LABEL: Record<Guest['categorie'], string> = {
  STANDARD: 'Standard',
  VIP: 'VIP',
  ENTREPRISE: 'Entreprise',
  AGENCE: 'Agence',
  BLACKLIST: 'Liste noire',
};

// Composant partagé (réservation + check-in walk-in, module CRM 5.7) :
// rechercher/réutiliser un client existant (guestId, active le contrôle
// blacklist côté serveur) ou saisir un nouveau client à la volée (guest).
// Rapporte la sélection via onChange à chaque changement, plutôt que de la
// posséder — le parent décide quand elle est utilisable (bouton "Créer"
// désactivé tant que onChange(null) est le dernier appel).
export function GuestPicker({ onChange }: GuestPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Guest[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Guest | null>(null);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const duplicates = useDuplicateWarning(email, telephone);

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchGuests(query.trim())
        .then((data) => {
          if (!cancelled) setResults(data);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selected]);

  function selectGuest(guest: Guest) {
    setSelected(guest);
    setQuery('');
    setResults([]);
    onChange({ guestId: guest.id });
  }

  function clearSelection() {
    setSelected(null);
    reportManual({ nom, prenom, telephone, email });
  }

  function reportManual(next: {
    nom: string;
    prenom: string;
    telephone: string;
    email: string;
  }) {
    onChange(
      next.nom && next.prenom
        ? {
            guest: {
              nom: next.nom,
              prenom: next.prenom,
              telephone: next.telephone || undefined,
              email: next.email || undefined,
            },
          }
        : null,
    );
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>Client</Label>
        <div className="flex items-center justify-between gap-2 rounded-md border p-2">
          <div>
            <p className="text-sm font-medium">
              {selected.nom} {selected.prenom}
            </p>
            {selected.telephone && (
              <p className="text-muted-foreground text-xs">
                {selected.telephone}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                selected.categorie === 'BLACKLIST' ? 'destructive' : 'outline'
              }
            >
              {CATEGORIE_LABEL[selected.categorie]}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={clearSelection}
            >
              Changer
            </Button>
          </div>
        </div>
        {selected.categorie === 'BLACKLIST' && (
          <p className="text-destructive text-xs">
            Ce client est en liste noire — l'opération sera refusée.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="guest-search">Rechercher un client existant</Label>
        <Input
          id="guest-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nom, téléphone, pièce d'identité…"
        />
        {searching && (
          <p className="text-muted-foreground text-xs">Recherche…</p>
        )}
        {results.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md border p-1">
            {results.map((guest) => (
              <button
                key={guest.id}
                type="button"
                className="hover:bg-muted flex items-center justify-between rounded px-2 py-1 text-left text-sm"
                onClick={() => selectGuest(guest)}
              >
                <span>
                  {guest.nom} {guest.prenom}
                  {guest.telephone ? ` — ${guest.telephone}` : ''}
                </span>
                {guest.categorie !== 'STANDARD' && (
                  <Badge
                    variant={
                      guest.categorie === 'BLACKLIST'
                        ? 'destructive'
                        : 'outline'
                    }
                  >
                    {CATEGORIE_LABEL[guest.categorie]}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        Ou saisir un nouveau client :
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="guest-nom">Nom</Label>
        <Input
          id="guest-nom"
          value={nom}
          onChange={(e) => {
            setNom(e.target.value);
            reportManual({
              nom: e.target.value,
              prenom,
              telephone,
              email,
            });
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="guest-prenom">Prénom</Label>
        <Input
          id="guest-prenom"
          value={prenom}
          onChange={(e) => {
            setPrenom(e.target.value);
            reportManual({
              nom,
              prenom: e.target.value,
              telephone,
              email,
            });
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="guest-telephone">Téléphone</Label>
        <Input
          id="guest-telephone"
          value={telephone}
          onChange={(e) => {
            setTelephone(e.target.value);
            reportManual({
              nom,
              prenom,
              telephone: e.target.value,
              email,
            });
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="guest-email">Email</Label>
        <Input
          id="guest-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            reportManual({
              nom,
              prenom,
              telephone,
              email: e.target.value,
            });
          }}
        />
      </div>
      {duplicates.length > 0 && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
          <p className="font-medium">
            Client(s) potentiellement déjà en base (email/téléphone similaire) :
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
    </div>
  );
}
