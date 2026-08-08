import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsPanel, TabsTrigger } from '@/components/ui/tabs';
import { BillingTabContent } from '@/features/billing/components/BillingTabContent';
import { PoliceRecordForm } from '@/features/police/components/PoliceRecordForm';
import type { Stay } from '../types';

interface Props {
  stay: Stay | null;
  onClose: () => void;
  onCheckout: () => void;
  checkingOut: boolean;
  error: string | null;
  soldeDu: string | null;
  onPoliceRecordSaved?: () => void;
  // GL-003 (MX-002A) — même granularité de masquage que le reste de l'app
  // (bouton entier absent, pas grisé) : voir CLAUDE.md, `stay:extend`
  // réservé Administrateur + Réception. Jamais de vérification par nom de
  // rôle ici, uniquement la permission effective transmise par App.tsx.
  permissions?: string[] | null;
  onExtendClick?: () => void;
  // GL-002 (MX-002C) — même granularité de masquage, même prop
  // `permissions` déjà branchée depuis MX-002A, `stay:change-room` réservé
  // Administrateur + Réception (CLAUDE.md).
  onChangeRoomClick?: () => void;
}

const STATUT_LABEL: Record<Stay['statut'], string> = {
  EN_COURS: 'En cours',
  CHECKOUT: 'Check-out effectué',
};

export function StayDetailsDialog({
  stay,
  onClose,
  onCheckout,
  checkingOut,
  error,
  soldeDu,
  onPoliceRecordSaved,
  permissions,
  onExtendClick,
  onChangeRoomClick,
}: Props) {
  const [activeTab, setActiveTab] = useState('details');
  const canExtend = permissions?.includes('stay:extend') ?? false;
  const canChangeRoom = permissions?.includes('stay:change-room') ?? false;

  return (
    <Dialog open={stay !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        {stay && (
          <>
            <DialogHeader>
              <DialogTitle>
                Séjour — {stay.guest.nom} {stay.guest.prenom}
              </DialogTitle>
            </DialogHeader>

            <div className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={stay.statut === 'EN_COURS' ? 'success' : 'secondary'}
                >
                  {STATUT_LABEL[stay.statut]}
                </Badge>
                {stay.reservationId === null && (
                  <Badge variant="outline">Walk-in</Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                Chambre{' '}
                <span className="text-foreground font-medium">
                  {stay.room.numero}
                </span>{' '}
                ({stay.room.roomType.nom}) — arrivée{' '}
                {new Date(stay.dateCheckin).toLocaleString('fr-FR')}, départ
                prévu {stay.dateCheckoutPrevue.slice(0, 10)}
              </p>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) => value && setActiveTab(value)}
            >
              <TabsList>
                <TabsTrigger value="details">Détails</TabsTrigger>
                <TabsTrigger value="facturation">Facturation</TabsTrigger>
                <TabsTrigger
                  value="police"
                  title={
                    !stay.policeRecord
                      ? 'Fiche de police (registre légal DGSN) non renseignée'
                      : undefined
                  }
                >
                  Police
                  {!stay.policeRecord && (
                    <AlertTriangle className="text-warning size-3.5" />
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsPanel value="details" className="flex flex-col gap-2 pt-3">
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
                        <span className="font-mono">{ligne.montant} MAD</span>
                      </li>
                    ))}
                  </ul>
                ))}

                {soldeDu !== null && (
                  <p className="text-sm font-medium">
                    Solde dû au check-out :{' '}
                    <span className="font-mono">{soldeDu} MAD</span>
                  </p>
                )}
              </TabsPanel>

              <TabsPanel value="facturation" className="pt-3">
                <BillingTabContent
                  stayId={stay.id}
                  guest={stay.guest}
                  room={stay.room}
                />
              </TabsPanel>

              <TabsPanel value="police" className="pt-3">
                <PoliceRecordForm
                  stayId={stay.id}
                  reservationId={stay.reservationId}
                  onSaved={onPoliceRecordSaved}
                />
              </TabsPanel>
            </Tabs>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Fermer
              </Button>
              {stay.statut === 'EN_COURS' &&
                canChangeRoom &&
                onChangeRoomClick && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onChangeRoomClick}
                  >
                    Changer de chambre
                  </Button>
                )}
              {stay.statut === 'EN_COURS' && canExtend && onExtendClick && (
                <Button type="button" variant="outline" onClick={onExtendClick}>
                  Prolonger
                </Button>
              )}
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
