import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { MoneyDisplay } from '@/components/ui/money-display';
import { Skeleton } from '@/components/ui/skeleton';
import { arrivalsToday } from '../../../reservations/api';
import type { Reservation, Room } from '../../../reservations/types';
import { AccessDenied } from './AccessDenied';

interface Props {
  room: Room;
  permissions: string[] | null;
  onNavigate: () => void;
}

// DESIGN-006 (mission §5) — la réservation pertinente pour une chambre
// RESERVEE est, par construction du statut lui-même (housekeeping.service.ts
// reconcileDailyStatuses/findConfirmedArrivingToday), l'unique réservation
// CONFIRMEE de cette chambre dont l'arrivée tombe aujourd'hui. On réutilise
// GET /reservations/arrivees-du-jour (déjà consommé par TodayPanel) plutôt
// que d'inventer un filtre serveur par chambre qui n'existe pas — DERIVED
// par simple filtrage client, aucune nouvelle règle métier.
export function ReservationSummary({ room, permissions, onNavigate }: Props) {
  const can = (permission: string) =>
    permissions?.includes(permission) ?? false;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const arrivals = await arrivalsToday();
      if (requestId !== requestSequence.current) return;
      setReservation(
        arrivals.find(
          (r) => r.roomId === room.id && r.statut === 'CONFIRMEE',
        ) ?? null,
      );
    } catch (err) {
      if (requestId === requestSequence.current) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [room.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      requestSequence.current += 1;
    };
  }, [load]);

  if (!can('reservations:read')) return <AccessDenied />;

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Impossible de charger la réservation"
        description={error}
        onRetry={() => void load()}
      />
    );
  }

  if (!reservation) {
    return (
      <EmptyState
        title="Cette chambre a changé d'état depuis le dernier rafraîchissement."
        description="Les informations de réservation ne sont plus à jour."
        action={{ label: 'Rafraîchir', onClick: () => void load() }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">Réservée</Badge>
      </div>
      <p className="text-sm">
        <span className="font-medium">
          {reservation.guest.nom} {reservation.guest.prenom}
        </span>
      </p>
      <p className="text-muted-foreground text-sm">
        Arrivée {reservation.dateArrivee.slice(0, 10)} — départ{' '}
        {reservation.dateDepart.slice(0, 10)}
      </p>
      <p className="text-muted-foreground text-sm">
        {room.roomType.nom} — chambre {room.numero}
      </p>
      <p className="text-sm">
        <MoneyDisplay value={reservation.prixTotalFinal} />
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-1 self-start"
        onClick={onNavigate}
      >
        Voir la réservation
      </Button>
    </div>
  );
}
