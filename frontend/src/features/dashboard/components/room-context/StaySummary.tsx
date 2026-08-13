import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { listStaysEnCours } from '../../../checkin/api';
import type { Stay } from '../../../checkin/types';
import type { Room } from '../../../reservations/types';
import { AccessDenied } from './AccessDenied';

interface Props {
  room: Room;
  permissions: string[] | null;
  onNavigate: () => void;
}

const FORMULE_LABEL: Record<string, string> = {
  ROOM_ONLY: 'Logement seul',
  BED_AND_BREAKFAST: 'Petit-déjeuner',
  HALF_BOARD: 'Demi-pension',
  FULL_BOARD: 'Pension complète',
};

const STATUT_LABEL: Record<Stay['statut'], string> = {
  EN_COURS: 'En cours',
  CHECKOUT: 'Check-out effectué',
};

// DESIGN-006 (mission §6) — pour OCCUPEE et DEPART_PREVU, il existe au plus
// un Stay.EN_COURS pour la chambre (contrainte RoomNight, voir Discovery
// Phase 1 §5). Pas de solde affiché ici : computeSoldeDu reste un calcul
// canonique backend (stay/utils/solde.ts), jamais dupliqué côté frontend
// (décision produit gelée §1).
export function StaySummary({ room, permissions, onNavigate }: Props) {
  const can = (permission: string) =>
    permissions?.includes(permission) ?? false;

  const [stay, setStay] = useState<Stay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const stays = await listStaysEnCours();
      if (requestId !== requestSequence.current) return;
      setStay(stays.find((s) => s.roomId === room.id) ?? null);
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

  if (!can('checkin:read')) return <AccessDenied />;

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
        title="Impossible de charger le séjour"
        description={error}
        onRetry={() => void load()}
      />
    );
  }

  if (!stay) {
    return (
      <EmptyState
        title="Cette chambre a changé d'état depuis le dernier rafraîchissement."
        description="Les informations de séjour ne sont plus à jour."
        action={{ label: 'Rafraîchir', onClick: () => void load() }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={stay.statut === 'EN_COURS' ? 'success' : 'secondary'}>
          {STATUT_LABEL[stay.statut]}
        </Badge>
        {stay.reservationId === null && (
          <Badge variant="outline">Walk-in</Badge>
        )}
      </div>
      <p className="text-sm">
        <span className="font-medium">
          {stay.guest.nom} {stay.guest.prenom}
        </span>
      </p>
      <p className="text-muted-foreground text-sm">
        Arrivée {new Date(stay.dateCheckin).toLocaleString('fr-FR')}
      </p>
      <p className="text-muted-foreground text-sm">
        Départ prévu {stay.dateCheckoutPrevue.slice(0, 10)}
      </p>
      {stay.nombreOccupants != null && (
        <p className="text-muted-foreground text-sm">
          {stay.nombreOccupants} occupant
          {stay.nombreOccupants > 1 ? 's' : ''}
        </p>
      )}
      <p className="text-muted-foreground text-sm">
        {FORMULE_LABEL[stay.formule] ?? stay.formule}
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-1 self-start"
        onClick={onNavigate}
      >
        Voir le séjour
      </Button>
    </div>
  );
}
