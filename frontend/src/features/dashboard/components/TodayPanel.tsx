import { useEffect, useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { arrivalsToday } from '../../reservations/api';
import { listDepartsDuJour } from '../../checkin/api';
import type { Reservation } from '../../reservations/types';
import type { Stay } from '../../checkin/types';

// DESIGN-005 (intégration Prototype D3 validée) — liste nominative REAL des
// arrivées/départs du jour. Contrairement au prototype (qui la marquait
// "aperçu — non branché", faute d'endpoint mocké), cette version de
// production branche réellement GET /reservations/arrivees-du-jour
// (`arrivalsToday`, déjà utilisée par CheckinPage) et
// GET /stays/departs-du-jour (`listDepartsDuJour`, idem) — aucun nouvel
// endpoint, mission §8. Chaque liste échoue silencieusement si la
// permission `checkin:read` manque (même convention que RoomsToCleanWidget/
// OpenMaintenanceWidget) : le panneau entier reste alors non affiché.
export function TodayPanel({
  canRead,
  onNavigate,
}: {
  canRead: boolean;
  onNavigate: () => void;
}) {
  const [arrivals, setArrivals] = useState<Reservation[] | null>(null);
  const [departures, setDepartures] = useState<Stay[] | null>(null);

  useEffect(() => {
    if (!canRead) return;
    arrivalsToday()
      .then(setArrivals)
      .catch(() => setArrivals(null));
    listDepartsDuJour()
      .then(setDepartures)
      .catch(() => setDepartures(null));
  }, [canRead]);

  if (!canRead || (arrivals === null && departures === null)) return null;

  return (
    <Card className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <CardTitle>Aujourd'hui</CardTitle>
        <button
          type="button"
          onClick={onNavigate}
          className="text-primary focus-visible:ring-ring/50 min-h-11 rounded-md text-xs hover:underline focus-visible:ring-3 focus-visible:outline-none sm:min-h-0"
        >
          Voir →
        </button>
      </div>

      {arrivals !== null && (
        <div>
          <p className="text-success mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
            <LogIn className="size-3.5" /> Arrivées ({arrivals.length})
          </p>
          {arrivals.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Aucune arrivée attendue.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {arrivals.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between text-[11.5px]"
                >
                  <span className="truncate">
                    {r.guest.prenom} {r.guest.nom}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    Ch. {r.room.numero}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {departures !== null && (
        <div className={arrivals !== null ? 'border-t pt-3' : undefined}>
          <p className="text-warning mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
            <LogOut className="size-3.5" /> Départs ({departures.length})
          </p>
          {departures.length === 0 ? (
            <p className="text-muted-foreground text-xs">Aucun départ prévu.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {departures.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-[11.5px]"
                >
                  <span className="truncate">
                    {s.guest.prenom} {s.guest.nom}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    Ch. {s.room.numero}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
