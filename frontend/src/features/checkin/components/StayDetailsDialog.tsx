import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Stay } from '../types';

interface Props {
  stay: Stay | null;
  onClose: () => void;
  onCheckout: () => void;
  checkingOut: boolean;
  error: string | null;
  soldeDu: string | null;
}

const STATUT_LABEL: Record<Stay['statut'], string> = {
  EN_COURS: 'En cours',
  CHECKOUT: 'Check-out effectué',
  ANNULE: 'Annulé',
};

export function StayDetailsDialog({
  stay,
  onClose,
  onCheckout,
  checkingOut,
  error,
  soldeDu,
}: Props) {
  return (
    <Dialog open={stay !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {stay && (
          <>
            <DialogHeader>
              <DialogTitle>
                Séjour — {stay.guest.nom} {stay.guest.prenom}
              </DialogTitle>
            </DialogHeader>

            <p className="text-muted-foreground text-sm">
              Chambre {stay.room.numero} ({stay.room.roomType.nom}) — arrivée{' '}
              {new Date(stay.dateCheckin).toLocaleString('fr-FR')}, départ prévu{' '}
              {stay.dateCheckoutPrevue.slice(0, 10)}
            </p>

            <div className="flex items-center gap-2">
              <Badge
                variant={stay.statut === 'EN_COURS' ? 'default' : 'secondary'}
              >
                {STATUT_LABEL[stay.statut]}
              </Badge>
              {stay.reservationId === null && (
                <Badge variant="outline">Walk-in</Badge>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Folio principal</p>
              {stay.folios.map((folio) => (
                <ul key={folio.id} className="flex flex-col gap-1 text-sm">
                  {folio.lignes.map((ligne) => (
                    <li key={ligne.id} className="flex justify-between">
                      <span
                        className={
                          ligne.annulee
                            ? 'text-muted-foreground line-through'
                            : ''
                        }
                      >
                        {ligne.libelle}
                      </span>
                      <span>{ligne.montant} DH</span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>

            {soldeDu !== null && (
              <p className="text-sm font-medium">
                Solde dû au check-out : {soldeDu} DH
              </p>
            )}

            {error && <p className="text-destructive text-sm">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Fermer
              </Button>
              {stay.statut === 'EN_COURS' && (
                <Button
                  type="button"
                  onClick={onCheckout}
                  disabled={checkingOut}
                >
                  {checkingOut ? 'Check-out…' : 'Check-out'}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
