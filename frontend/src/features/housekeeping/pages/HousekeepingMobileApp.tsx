import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  listMobileRooms,
  mobileLogin,
  updateMobileRoomStatus,
  type MobileRoomSummary,
} from '../mobile-api';
import type { StatutChambre } from '../../reservations/types';

const TOKEN_KEY = 'makarim_mobile_housekeeping_token';

const STATUT_LABEL: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'Libre & propre',
  RESERVEE: 'Réservée',
  OCCUPEE: 'Occupée',
  DEPART_PREVU: 'Départ prévu',
  A_NETTOYER: 'À nettoyer',
  EN_NETTOYAGE: 'En nettoyage',
  EN_MAINTENANCE: 'Hors service (maintenance)',
};

const STATUT_CHIP_CLASS: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'bg-success/15 text-success',
  RESERVEE: 'bg-info/15 text-info',
  OCCUPEE: 'bg-destructive/15 text-destructive',
  DEPART_PREVU: 'bg-info/15 text-info',
  A_NETTOYER: 'bg-warning/20 text-warning',
  EN_NETTOYAGE: 'bg-violet/15 text-violet',
  EN_MAINTENANCE: 'bg-destructive/15 text-destructive',
};

// Handoff design final, lot 4 (HousekeepingMobile.dc.html) — vue terrain
// équipier, réutilise intégralement le backend F9 déjà implémenté
// (login/rooms/statut à portée mobile-housekeeping). Point d'entrée
// autonome (voir main.tsx, chemin /mobile/housekeeping), pas rattaché à
// AppSidebar/App.tsx : session Bearer indépendante de l'app desktop.
//
// Écarts assumés vis-à-vis du mockup (capacités backend non implémentées,
// signalées comme telles par le README du handoff, "à valider avant dev") :
// - Pas de regroupement par étage ni d'horodatage "il y a X min" par
//   chambre : MobileRoomSummary (payload volontairement allégé, F9) ne
//   renvoie que id/numero/statut/typeChambre, ni etage ni date de
//   changement.
// - Pas de bannière "mode hors-ligne" : aucune file de synchronisation
//   différée n'existe côté client, en afficher une mentirait sur une
//   capacité réelle.
// - Pas de bouton "Signaler un problème" (création de ticket maintenance) :
//   le jeton mobile-housekeeping est strictement cantonné à
//   /api/mobile/housekeeping/* (JwtAuthGuard, défense en profondeur F9) et
//   ne peut techniquement pas appeler POST /maintenance-tickets — décision
//   produit hors périmètre de ce lot (élargir le scope du jeton, ou créer
//   un endpoint de relais dédié).
export function HousekeepingMobileApp() {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(TOKEN_KEY),
  );
  const [rooms, setRooms] = useState<MobileRoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<MobileRoomSummary | null>(
    null,
  );
  const [filter, setFilter] = useState<'TOUTES' | 'A_FAIRE' | 'FAITES'>(
    'TOUTES',
  );

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setRooms([]);
    setSelectedRoom(null);
  }, []);

  const refetch = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setRooms(await listMobileRooms(token));
    } catch (err) {
      if ((err as { status?: number }).status === 401) {
        handleLogout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [token, handleLogout]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch]);

  function handleLoginSuccess(newToken: string) {
    sessionStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  if (!token) {
    return <MobileLoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (selectedRoom) {
    return (
      <MobileRoomDetailScreen
        room={selectedRoom}
        token={token}
        onBack={() => setSelectedRoom(null)}
        onSaved={async () => {
          setSelectedRoom(null);
          await refetch();
        }}
        onAuthError={handleLogout}
      />
    );
  }

  const nettoyer = rooms.filter((r) => r.statut === 'A_NETTOYER');
  const faites = rooms.filter((r) =>
    ['LIBRE_PROPRE', 'EN_NETTOYAGE'].includes(r.statut),
  );
  const visibleRooms =
    filter === 'A_FAIRE' ? nettoyer : filter === 'FAITES' ? faites : rooms;

  return (
    <div className="bg-muted mx-auto flex min-h-screen max-w-md flex-col">
      <div className="bg-primary text-primary-foreground flex shrink-0 items-center justify-between px-4.5 py-4">
        <div>
          <p className="text-[15px] font-bold">Mes chambres</p>
          <p className="text-primary-foreground/65 text-[11.5px]">
            Housekeeping mobile
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-primary-foreground/80 text-xs font-semibold underline underline-offset-2"
        >
          Déconnexion
        </button>
      </div>

      <div className="flex shrink-0 gap-2 overflow-x-auto px-4.5 py-3">
        {(
          [
            { key: 'TOUTES' as const, label: `Toutes · ${rooms.length}` },
            {
              key: 'A_FAIRE' as const,
              label: `À nettoyer · ${nettoyer.length}`,
            },
            { key: 'FAITES' as const, label: `Faites · ${faites.length}` },
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
        {!loading && !error && visibleRooms.length === 0 && (
          <p className="text-muted-foreground p-4 text-center text-sm">
            Aucune chambre dans cette catégorie.
          </p>
        )}
        <div className="flex flex-col gap-2 p-1.5">
          {visibleRooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setSelectedRoom(room)}
              className="bg-card active:bg-muted flex min-h-[64px] items-center gap-3 rounded-lg border p-3.5 text-left"
            >
              <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
                {room.numero}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {room.typeChambre}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${STATUT_CHIP_CLASS[room.statut]}`}
              >
                {STATUT_LABEL[room.statut]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileLoginScreen({
  onLoginSuccess,
}: {
  onLoginSuccess: (token: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { accessToken } = await mobileLogin(email, motDePasse);
      onLoginSuccess(accessToken);
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
          <p className="text-lg font-bold">Housekeeping mobile</p>
          <p className="text-muted-foreground text-sm">
            Hôtel Makarim — connexion équipier
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mobile-email">Email</Label>
          <Input
            id="mobile-email"
            type="email"
            autoComplete="username"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mobile-password">Mot de passe</Label>
          <Input
            id="mobile-password"
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

const MANUAL_TARGETS: StatutChambre[] = [
  'LIBRE_PROPRE',
  'A_NETTOYER',
  'EN_NETTOYAGE',
  'EN_MAINTENANCE',
];

function MobileRoomDetailScreen({
  room,
  token,
  onBack,
  onSaved,
  onAuthError,
}: {
  room: MobileRoomSummary;
  token: string;
  onBack: () => void;
  onSaved: () => void;
  onAuthError: () => void;
}) {
  const [statut, setStatut] = useState<StatutChambre>(room.statut);
  const [commentaire, setCommentaire] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleValidate() {
    setSaving(true);
    setError(null);
    try {
      await updateMobileRoomStatus(token, room.id, statut, commentaire);
      onSaved();
    } catch (err) {
      if ((err as { status?: number }).status === 401) {
        onAuthError();
        return;
      }
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-muted mx-auto flex min-h-screen max-w-md flex-col">
      <div className="bg-primary text-primary-foreground flex shrink-0 items-center gap-2.5 px-4.5 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          className="p-1"
        >
          ←
        </button>
        <span className="bg-primary-foreground text-primary rounded px-2 py-0.5 text-xs font-bold">
          {room.numero}
        </span>
        <span className="text-[15px] font-semibold">{room.typeChambre}</span>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4.5">
        <div>
          <p className="text-muted-foreground mb-1.5 text-xs font-bold tracking-wide uppercase">
            Statut de la chambre
          </p>
          <div className="bg-card flex flex-col overflow-hidden rounded-lg border">
            {MANUAL_TARGETS.map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => setStatut(target)}
                className={`flex min-h-[52px] items-center gap-2.5 border-b p-3.5 text-left text-sm last:border-b-0 ${
                  statut === target ? 'bg-primary/8 font-bold' : ''
                }`}
              >
                <span
                  className={`flex size-[19px] shrink-0 items-center justify-center rounded-[5px] border-2 ${
                    statut === target
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-input'
                  }`}
                >
                  {statut === target && '✓'}
                </span>
                {STATUT_LABEL[target]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mobile-commentaire">Note (optionnel)</Label>
          <textarea
            id="mobile-commentaire"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Ajouter une remarque pour la réception…"
            className="bg-card min-h-[56px] rounded-lg border p-3 text-sm"
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button
          onClick={handleValidate}
          disabled={saving}
          className="h-[46px] text-sm font-bold"
        >
          {saving ? 'Enregistrement…' : 'Valider le statut'}
        </Button>
      </div>
    </div>
  );
}
