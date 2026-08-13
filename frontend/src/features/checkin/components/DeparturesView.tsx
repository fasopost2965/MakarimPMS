import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Stay } from '../types';
import { computeSoldeDuClient } from '../utils/solde';

function initials(nom: string, prenom: string) {
  return `${nom.charAt(0)}${prenom.charAt(0)}`.toUpperCase();
}

interface Props {
  stays: Stay[];
  hasAnyStay: boolean;
  todayISO: string;
  onSelect: (stay: Stay) => void;
}

// DESIGN-009 — grille de cartes reprise du prototype PrototypeFrontDeskA
// (vue "departs"). Solde affiché uniquement ici, calculé côté client par
// computeSoldeDuClient (réplique documentée de computeSoldeDu côté serveur,
// voir features/checkin/utils/solde.ts) à partir des lignes de folio
// réellement incluses dans GET /stays/departs-du-jour — jamais une valeur
// "reste à payer" inventée. Le solde réellement bloquant reste vérifié par
// le serveur au moment du check-out (StayService.checkout).
export function DeparturesView({
  stays,
  hasAnyStay,
  todayISO,
  onSelect,
}: Props) {
  if (stays.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        {hasAnyStay
          ? 'Aucun résultat pour cette recherche.'
          : "Aucun départ prévu aujourd'hui."}
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {stays.map((stay) => {
        const solde = computeSoldeDuClient(stay);
        return (
          <button
            key={stay.id}
            type="button"
            onClick={() => onSelect(stay)}
            className="bg-card hover:border-primary/50 flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="bg-warning/20 text-warning flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  {initials(stay.guest.nom, stay.guest.prenom)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {stay.guest.nom} {stay.guest.prenom}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Départ prévu {todayISO}
                  </span>
                </span>
              </span>
              <Badge variant="outline">Ch. {stay.room.numero}</Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'text-xs font-semibold',
                  solde > 0 ? 'text-destructive' : 'text-success',
                )}
              >
                Solde : {solde.toFixed(2)} MAD
              </span>
              {!stay.policeRecord && (
                <Badge variant="warning">
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
