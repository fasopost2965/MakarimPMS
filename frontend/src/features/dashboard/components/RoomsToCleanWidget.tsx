import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
    <div className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">État des chambres</h3>
        <button
          type="button"
          onClick={onNavigate}
          className="text-primary text-xs hover:underline"
        >
          Voir le ménage →
        </button>
      </div>
      {rooms.length === 0 ? (
        <p className="text-muted-foreground text-xs">
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
    </div>
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
