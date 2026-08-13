import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FORMULE_LABEL } from '../../reservations/reservation-presentation';
import type { Stay } from '../types';

function initials(nom: string, prenom: string) {
  return `${nom.charAt(0)}${prenom.charAt(0)}`.toUpperCase();
}

// Capturé une fois au chargement du module (jamais dans le corps du
// composant) — un appel direct à `Date.now()` pendant le rendu est un appel
// impur (react-hooks/purity), même précédent que PrototypeFrontDeskA.tsx.
const NOW_MS = Date.now();

interface Props {
  stays: Stay[];
  hasAnyStay: boolean;
  onSelect: (stay: Stay) => void;
}

// DESIGN-009 — grille de cartes reprise du prototype PrototypeFrontDeskA
// (vue "sejours") : nuits restantes calculées côté client (purement
// d'affichage, aucune écriture), aucun solde affiché ici (un séjour EN_COURS
// n'a pas de "solde dû au départ" avant le check-out, voir mission §10).
export function ActiveStaysView({ stays, hasAnyStay, onSelect }: Props) {
  if (stays.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        {hasAnyStay
          ? 'Aucun résultat pour cette recherche.'
          : 'Aucun séjour en cours.'}
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {stays.map((stay) => {
        const nuitsRestantes = Math.max(
          0,
          Math.round(
            (new Date(stay.dateCheckoutPrevue).getTime() - NOW_MS) / 86_400_000,
          ),
        );
        return (
          <button
            key={stay.id}
            type="button"
            onClick={() => onSelect(stay)}
            className="bg-card hover:border-primary/50 flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="bg-success/15 text-success flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  {initials(stay.guest.nom, stay.guest.prenom)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {stay.guest.nom} {stay.guest.prenom}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {FORMULE_LABEL[stay.formule]}
                  </span>
                </span>
              </span>
              <Badge variant="outline">Ch. {stay.room.numero}</Badge>
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <span>
                {nuitsRestantes} nuit{nuitsRestantes > 1 ? 's' : ''} restante
                {nuitsRestantes > 1 ? 's' : ''}
              </span>
              <span>·</span>
              <span>
                {stay.nombreOccupants ?? '—'} occupant
                {(stay.nombreOccupants ?? 0) > 1 ? 's' : ''}
              </span>
              {!stay.policeRecord && (
                <Badge variant="warning" className="ml-auto">
                  <AlertTriangle className="size-3" />
                  Fiche police manquante
                </Badge>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
