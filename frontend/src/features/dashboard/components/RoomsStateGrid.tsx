import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Room, StatutChambre } from '../../reservations/types';

// DESIGN-005 (intégration Prototype D3 validée) — grille compacte de l'état
// des chambres, REAL (GET /rooms, même source que l'ancien
// RoomsToCleanWidget qu'elle remplace sur ce Dashboard — le fichier reste
// en place, simplement plus monté ici, voir rapport de livraison).
//
// Couleurs : mapping propre à ce composant (pas de duplication de la
// logique métier de statut, seulement une présentation), aligné sur le
// langage validé en prototype (vert=prêt, bleu=occupée, ambre=attention,
// violet=nettoyage en cours — même teinte que HousekeepingPage.tsx pour
// EN_NETTOYAGE, cohérence conservée sur ce point précis — rouge=bloquant).
// RESERVEE/DEPART_PREVU (2 statuts absents des prototypes A-D3, dont le
// modèle réel de chambre dispose) rejoignent "info" — aucun statut n'est
// laissé sans couleur.
const STATUT_DOT: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'bg-success',
  RESERVEE: 'bg-info',
  OCCUPEE: 'bg-primary',
  DEPART_PREVU: 'bg-info',
  A_NETTOYER: 'bg-warning',
  EN_NETTOYAGE: 'bg-violet',
  EN_MAINTENANCE: 'bg-destructive',
};
const STATUT_LABEL: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'Libre / propre',
  RESERVEE: 'Réservée',
  OCCUPEE: 'Occupée',
  DEPART_PREVU: 'Départ prévu',
  A_NETTOYER: 'À nettoyer',
  EN_NETTOYAGE: 'En nettoyage',
  EN_MAINTENANCE: 'Maintenance',
};
const LEGEND_ORDER: StatutChambre[] = [
  'LIBRE_PROPRE',
  'OCCUPEE',
  'RESERVEE',
  'DEPART_PREVU',
  'A_NETTOYER',
  'EN_NETTOYAGE',
  'EN_MAINTENANCE',
];

export function RoomsStateGrid({
  rooms,
  onNavigate,
}: {
  rooms: Room[] | null;
  onNavigate: () => void;
}) {
  if (rooms === null) return null;

  return (
    <Card className="flex h-full flex-col">
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
      <CardContent className="flex-1 pt-2">
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
          {rooms.map((room) => (
            <div
              key={room.id}
              title={`Ch. ${room.numero}${room.etage != null ? ` (étage ${room.etage})` : ''} — ${STATUT_LABEL[room.statut]}`}
              className="bg-surface-2 hover:ring-ring/40 group flex aspect-square min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md transition-[box-shadow] hover:ring-2"
            >
              <span
                className={`size-2 shrink-0 rounded-full ${STATUT_DOT[room.statut]}`}
              />
              <span className="text-muted-foreground group-hover:text-foreground w-full truncate px-0.5 text-center text-[9px] tabular-nums">
                {room.numero}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-3 text-[11px]">
          {LEGEND_ORDER.map((statut) => (
            <span
              key={statut}
              className="text-muted-foreground flex items-center gap-1.5"
            >
              <span className={`size-2 rounded-full ${STATUT_DOT[statut]}`} />{' '}
              {STATUT_LABEL[statut]}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
