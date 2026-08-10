import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listRooms } from '../../reservations/api';
import type { Room } from '../../reservations/types';

interface Props {
  onNavigate: () => void;
}

const STATUT_LABEL: Record<string, string> = {
  A_NETTOYER: 'À nettoyer',
  EN_NETTOYAGE: 'En nettoyage',
  EN_MAINTENANCE: 'Bloquée pour maintenance',
};

// CH-043 (docs/execution/PLAN_MISE_EN_PRODUCTION_BETA.md, Phase B) —
// contrairement à HousekeepingTasksWidget de MakarimPMS_v2 (4 tâches
// fictives codées en dur, référençant un client VIP imaginaire), ce widget
// n'affiche que des chambres réellement dans ces états côté backend
// (GET /rooms, déjà utilisé par HousekeepingPage) — aucune donnée inventée.
// Rôles sans housekeeping:read (Comptable, RH) : la liste échoue en 403,
// capturée silencieusement — le widget ne s'affiche simplement pas plutôt
// que de planter le reste du tableau de bord.
export function RoomsToCleanWidget({ onNavigate }: Props) {
  const [rooms, setRooms] = useState<Room[] | null>(null);

  useEffect(() => {
    listRooms()
      .then((all) =>
        setRooms(
          all.filter(
            (r) =>
              r.statut === 'A_NETTOYER' ||
              r.statut === 'EN_NETTOYAGE' ||
              r.statut === 'EN_MAINTENANCE',
          ),
        ),
      )
      .catch(() => setRooms(null));
  }, []);

  if (rooms === null) return null;

  const cleaningRooms = rooms.filter(
    (room) => room.statut === 'A_NETTOYER' || room.statut === 'EN_NETTOYAGE',
  );
  const blockedRooms = rooms.filter((room) => room.statut === 'EN_MAINTENANCE');

  return (
    <Card>
      <CardHeader>
        <CardTitle>État des chambres</CardTitle>
        <button
          type="button"
          onClick={onNavigate}
          className="text-primary focus-visible:ring-ring/50 min-h-11 rounded-md text-xs hover:underline focus-visible:ring-3 focus-visible:outline-none sm:min-h-0"
        >
          Voir le ménage →
        </button>
      </CardHeader>
      <CardContent className="gap-3 pt-2">
        {rooms.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune chambre à nettoyer ou bloquée pour maintenance.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <RoomStatusSection
              title="À nettoyer / En nettoyage"
              rooms={cleaningRooms}
              emptyLabel="Aucune chambre à traiter."
              variant="warning"
            />
            <RoomStatusSection
              title="Bloquées pour maintenance"
              rooms={blockedRooms}
              emptyLabel="Aucune chambre bloquée."
              variant="destructive"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RoomStatusSection({
  title,
  rooms,
  emptyLabel,
  variant,
}: {
  title: string;
  rooms: Room[];
  emptyLabel: string;
  variant: 'warning' | 'destructive';
}) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-muted-foreground text-xs font-semibold">{title}</h4>
      {rooms.length === 0 ? (
        <p className="text-muted-foreground text-xs">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {rooms.map((room) => (
            <li key={room.id}>
              <Badge variant={variant} className="gap-1">
                {room.numero}
                <span className="text-[10px] opacity-80">
                  {STATUT_LABEL[room.statut] ?? room.statut}
                </span>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
