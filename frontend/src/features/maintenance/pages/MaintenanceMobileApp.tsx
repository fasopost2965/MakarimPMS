import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/features/auth/api';
import { setCsrfToken } from '@/lib/token-storage';
import { listTickets, resolveTicket } from '../api';
import type { MaintenanceTicket, PrioriteTicket } from '../types';

const PRIORITE_LABEL: Record<PrioriteTicket, string> = {
  URGENTE: 'Urgente',
  HAUTE: 'Haute',
  MOYENNE: 'Moyenne',
  BASSE: 'Basse',
};

const PRIORITE_CHIP_CLASS: Record<PrioriteTicket, string> = {
  URGENTE: 'bg-destructive/15 text-destructive',
  HAUTE: 'bg-warning/20 text-warning',
  MOYENNE: 'bg-info/15 text-info',
  BASSE: 'bg-muted text-muted-foreground',
};

// Handoff design final, lot 4 (MaintenanceMobile.dc.html) — vue terrain
// technicien. Contrairement à Housekeeping mobile (F9, jeton dédié), aucune
// infrastructure d'auth mobile n'existe pour la maintenance : réutilise donc
// la session cookie normale (login()/apiRequest, mêmes permissions
// maintenance:read/write que le desktop) plutôt que d'inventer un second
// mécanisme d'auth. Un technicien s'y connecte avec son compte habituel.
//
// Écarts assumés vis-à-vis du mockup (mêmes principes que Housekeeping
// mobile — capacités non implémentées, signalées par le README du handoff) :
// - Pas de bannière "hors ligne" (aucune file de synchronisation différée).
// - Pas de bouton "Prendre en charge" : MaintenanceTicket n'a que deux états
//   réels (ouvert / résolu via resoluAt), aucun état intermédiaire "pris en
//   charge" en base — seule l'action "Marquer résolu" (déjà existante,
//   PATCH /maintenance-tickets/:id/resoudre) est réellement câblable.
// - "Assigné à vous" du mockup devient simplement l'affichage du champ
//   `assigneA` (texte libre existant), sans lien vers l'utilisateur connecté
//   (aucune FK réelle entre MaintenanceTicket et User côté schéma).
export function MaintenanceMobileApp() {
  const [authed, setAuthed] = useState(false);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MaintenanceTicket | null>(null);
  const [filter, setFilter] = useState<'OUVERTS' | 'URGENTS' | 'RESOLUS'>(
    'OUVERTS',
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTickets(await listTickets());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [authed, refetch]);

  if (!authed) {
    return <MobileLoginScreen onLoginSuccess={() => setAuthed(true)} />;
  }

  if (selected) {
    return (
      <MobileTicketDetailScreen
        ticket={selected}
        onBack={() => setSelected(null)}
        onResolved={async () => {
          setSelected(null);
          await refetch();
        }}
      />
    );
  }

  const ouverts = tickets.filter((t) => !t.resoluAt);
  const urgents = ouverts.filter((t) => t.priorite === 'URGENTE');
  const resolus = tickets.filter((t) => t.resoluAt);
  const visible =
    filter === 'URGENTS' ? urgents : filter === 'RESOLUS' ? resolus : ouverts;

  return (
    <div className="bg-muted mx-auto flex min-h-screen max-w-md flex-col">
      <div className="bg-primary text-primary-foreground flex shrink-0 items-center justify-between px-4.5 py-4">
        <div>
          <p className="text-[15px] font-bold">Mes tickets</p>
          <p className="text-primary-foreground/65 text-[11.5px]">
            Maintenance mobile
          </p>
        </div>
      </div>

      <div className="flex shrink-0 gap-2 overflow-x-auto px-4.5 py-3">
        {(
          [
            { key: 'OUVERTS' as const, label: `Ouverts · ${ouverts.length}` },
            { key: 'URGENTS' as const, label: `Urgents · ${urgents.length}` },
            { key: 'RESOLUS' as const, label: `Résolus · ${resolus.length}` },
          ] as const
        ).map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap ${
              filter === chip.key
                ? 'bg-primary-foreground text-primary'
                : 'bg-primary-foreground/15 text-primary-foreground'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {error && (
          <div className="border-destructive/30 bg-destructive/8 text-destructive m-1.5 rounded-md border p-3 text-sm">
            {error}
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={() => void refetch()}
            >
              Réessayer
            </Button>
          </div>
        )}
        {loading && !error && (
          <p className="text-muted-foreground p-4 text-center text-sm">
            Chargement…
          </p>
        )}
        {!loading && !error && visible.length === 0 && (
          <p className="text-muted-foreground p-4 text-center text-sm">
            Aucun ticket dans cette catégorie.
          </p>
        )}
        <div className="flex flex-col gap-2 p-1.5">
          {visible.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => setSelected(ticket)}
              className={`bg-card active:bg-muted flex min-h-[64px] items-center gap-3 rounded-lg border p-3.5 text-left ${
                ticket.resoluAt ? 'opacity-70' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {ticket.room
                    ? `Chambre ${ticket.room.numero}`
                    : 'Zone commune'}
                  {' — '}
                  {ticket.typePanne}
                </p>
                <p className="text-muted-foreground text-[11.5px]">
                  {ticket.assigneA
                    ? `Assigné à ${ticket.assigneA}`
                    : 'Non assigné'}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${PRIORITE_CHIP_CLASS[ticket.priorite]}`}
              >
                {ticket.resoluAt ? 'Résolu' : PRIORITE_LABEL[ticket.priorite]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileLoginScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { csrfToken } = await login(email, motDePasse);
      setCsrfToken(csrfToken);
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-muted flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-card flex w-full max-w-sm flex-col gap-4 rounded-xl border p-6"
      >
        <div>
          <p className="text-lg font-bold">Maintenance mobile</p>
          <p className="text-muted-foreground text-sm">
            Hôtel Makarim — connexion technicien
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maint-email">Email</Label>
          <Input
            id="maint-email"
            type="email"
            autoComplete="username"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maint-password">Mot de passe</Label>
          <Input
            id="maint-password"
            type="password"
            autoComplete="current-password"
            className="h-11"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" disabled={submitting} className="h-11">
          {submitting ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
    </div>
  );
}

function MobileTicketDetailScreen({
  ticket,
  onBack,
  onResolved,
}: {
  ticket: MaintenanceTicket;
  onBack: () => void;
  onResolved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResolve() {
    setSaving(true);
    setError(null);
    try {
      await resolveTicket(ticket.id);
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-muted mx-auto flex min-h-screen max-w-md flex-col">
      <div className="bg-destructive flex shrink-0 items-center gap-2.5 px-4.5 py-4 text-white">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          className="p-1"
        >
          ←
        </button>
        <span className="rounded bg-white px-2 py-0.5 text-xs font-bold text-destructive">
          {PRIORITE_LABEL[ticket.priorite]}
        </span>
        <span className="text-[15px] font-semibold">
          {ticket.room ? `Chambre ${ticket.room.numero}` : 'Zone commune'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4.5">
        <div>
          <p className="text-[15px] font-bold">{ticket.typePanne}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Créé le{' '}
            {new Date(ticket.createdAt).toLocaleString('fr-FR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </p>
        </div>

        {ticket.photoUrl && (
          <div>
            <p className="text-muted-foreground mb-1.5 text-xs font-bold tracking-wide uppercase">
              Photo
            </p>
            <img
              src={ticket.photoUrl}
              alt="Problème signalé"
              className="w-full rounded-lg border object-contain"
            />
          </div>
        )}

        <div className="bg-card flex gap-4 rounded-lg border p-3.5 text-xs">
          <div>
            <p className="font-bold">Priorité</p>
            {PRIORITE_LABEL[ticket.priorite]}
          </div>
          <div>
            <p className="font-bold">Statut</p>
            {ticket.resoluAt ? 'Résolu' : 'Ouvert'}
          </div>
          <div>
            <p className="font-bold">Assigné</p>
            {ticket.assigneA ?? '—'}
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {!ticket.resoluAt && (
          <Button
            onClick={handleResolve}
            disabled={saving}
            className="h-[46px] text-sm font-bold"
          >
            {saving ? 'Enregistrement…' : 'Marquer résolu'}
          </Button>
        )}
        {ticket.resoluAt && (
          <p className="text-success bg-success/10 rounded-lg p-3 text-center text-sm font-semibold">
            Ticket déjà résolu
          </p>
        )}
      </div>
    </div>
  );
}
