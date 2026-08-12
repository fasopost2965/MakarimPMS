import { Sparkles, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import type { Room } from '../../reservations/types';
import type {
  MaintenanceTicket,
  PrioriteTicket,
} from '../../maintenance/types';

// DESIGN-005 (intégration Prototype D3 validée) — regroupe Ménage et
// Maintenance dans une seule zone "À traiter", triée par urgence réelle.
// REAL : `rooms` (GET /rooms) et `tickets` (GET /maintenance-tickets
// ?ouvert=true), toutes deux déjà utilisées par les anciens widgets
// RoomsToCleanWidget/OpenMaintenanceWidget qu'elle remplace sur ce
// Dashboard (fichiers conservés, simplement plus montés ici). DERIVED :
// le regroupement lui-même (tri par priorité, filtrage par statut) —
// aucune nouvelle règle métier, uniquement une présentation combinée de
// données déjà exposées.
//
// Badges Urgent/Important/Normal/Bloquant (mission §5/§7) : "Bloquant" est
// DERIVED du vrai statut Room.EN_MAINTENANCE (le signal réellement
// bloquant pour la vente, cf. CLAUDE.md — MaintenanceTicket.bloqueVente
// existe côté backend mais n'est pas exposé dans MaintenanceTicket côté
// frontend aujourd'hui, voir maintenance/types.ts), jamais déduit de la
// seule priorité d'un ticket.
const PRIORITE_BADGE: Record<
  PrioriteTicket,
  { label: string; variant: 'destructive' | 'warning' | 'outline' }
> = {
  URGENTE: { label: 'Urgent', variant: 'destructive' },
  HAUTE: { label: 'Important', variant: 'warning' },
  MOYENNE: { label: 'Normal', variant: 'outline' },
  BASSE: { label: 'Normal', variant: 'outline' },
};

export function ATraiterPanel({
  rooms,
  tickets,
}: {
  rooms: Room[] | null;
  tickets: MaintenanceTicket[] | null;
}) {
  if (rooms === null && tickets === null) return null;

  const roomsToClean =
    rooms?.filter(
      (r) => r.statut === 'A_NETTOYER' || r.statut === 'EN_NETTOYAGE',
    ) ?? [];
  const roomsBlocked =
    rooms?.filter((r) => r.statut === 'EN_MAINTENANCE') ?? [];
  const orderedTickets = tickets
    ? [
        ...tickets.filter((t) => t.priorite === 'URGENTE'),
        ...tickets.filter((t) => t.priorite !== 'URGENTE'),
      ]
    : [];

  return (
    <Card className="flex h-full flex-col gap-4 p-4">
      <CardTitle>À traiter</CardTitle>

      {rooms !== null && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="text-warning size-3.5" /> Ménage
            </p>
            <Badge variant={roomsToClean.length > 0 ? 'warning' : 'outline'}>
              {roomsToClean.length}
            </Badge>
          </div>
          {roomsToClean.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Toutes les chambres sont traitées.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {roomsToClean.map((r) => (
                <Badge key={r.id} variant="warning">
                  {r.numero}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {tickets !== null && (
        <div className={rooms !== null ? 'border-t pt-3' : undefined}>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Wrench className="size-3.5" /> Maintenance
            </p>
            {roomsBlocked.length > 0 && (
              <Badge variant="destructive">
                Bloquant · {roomsBlocked.length}
              </Badge>
            )}
          </div>
          {roomsBlocked.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {roomsBlocked.map((r) => (
                <Badge key={r.id} variant="destructive">
                  Ch. {r.numero}
                </Badge>
              ))}
            </div>
          )}
          {orderedTickets.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Aucune intervention ouverte.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {orderedTickets.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 text-[11.5px]"
                >
                  <span className="truncate">
                    {t.room ? `Ch. ${t.room.numero} — ` : ''}
                    {t.typePanne}
                  </span>
                  <Badge variant={PRIORITE_BADGE[t.priorite].variant}>
                    {PRIORITE_BADGE[t.priorite].label}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
