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
import { Input } from '@/components/ui/input';
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
  // DESIGN-009 — solde estimé avant tout appel réel à checkout() (vue
  // Départs), calculé côté client par computeSoldeDuClient (réplique
  // documentée de computeSoldeDu serveur, voir
  // features/checkin/utils/solde.ts) à partir des lignes de folio déjà
  // chargées. N'est jamais affiché une fois `soldeDu` connu (réponse réelle
  // du serveur, toujours prioritaire) — purement indicatif entre-temps,
  // jamais utilisé pour décider quoi que ce soit côté client (le blocage
  // réel reste vérifié par StayService.checkout).
  estimatedSoldeDu?: number | null;
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
  // DESIGN-009 — check-out forcé (CH-005, BR-SEJ-004/INV-SEJ-002) :
  // StayService.checkout bloque un solde impayé/note restaurant non
  // acquittée sauf `force:true` + motif ≥ 10 caractères, réservé à la
  // permission dédiée checkin:force-checkout (vérification dynamique
  // serveur, jamais exprimable par @RequirePermission — même pattern que
  // guests:blacklist). N'apparaît qu'après l'échec d'un check-out normal
  // (`error` déjà présent) : jamais affiché en avance, un check-out normal
  // reste toujours tenté en premier.
  canForceCheckout?: boolean;
  onForceCheckout?: (motif: string) => void;
  forcingCheckout?: boolean;
  // DESIGN-009 QA — « Voir la chambre » manquait pour les vues Séjours/
  // Départs (seule ArrivalContextPanel l'avait), alors que le RoomContextModal
  // réel (DESIGN-006) doit être accessible depuis n'importe quel panneau
  // contextuel touchant une chambre (mission §7/§13). Optionnel pour ne
  // jamais casser un appelant qui ne le fournirait pas.
  onViewRoom?: (stay: Stay) => void;
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
  estimatedSoldeDu = null,
  onPoliceRecordSaved,
  permissions,
  onExtendClick,
  onChangeRoomClick,
  canForceCheckout = false,
  onForceCheckout,
  forcingCheckout = false,
  onViewRoom,
}: Props) {
  const [activeTab, setActiveTab] = useState('details');
  const [forceMotif, setForceMotif] = useState('');
  // Le motif de check-out forcé ne doit jamais survivre à la fermeture du
  // dialogue ni à l'ouverture d'un autre séjour (sinon un motif saisi pour
  // un client resterait pré-rempli pour le suivant). « Ajustement de state
  // pendant le rendu » (React : https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // plutôt qu'un `useEffect` — évite un rendu en cascade inutile.
  const [prevStayId, setPrevStayId] = useState<number | null>(stay?.id ?? null);
  if ((stay?.id ?? null) !== prevStayId) {
    setPrevStayId(stay?.id ?? null);
    setForceMotif('');
  }
  const canExtend = permissions?.includes('stay:extend') ?? false;
  const canChangeRoom = permissions?.includes('stay:change-room') ?? false;
  const showForceCheckout =
    stay?.statut === 'EN_COURS' &&
    error !== null &&
    canForceCheckout &&
    onForceCheckout !== undefined;

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
                {soldeDu === null && estimatedSoldeDu !== null && (
                  <p className="text-muted-foreground text-sm font-medium">
                    Solde estimé (avant check-out, lignes de folio actuellement
                    chargées) :{' '}
                    <span className="font-mono">
                      {estimatedSoldeDu.toFixed(2)} MAD
                    </span>
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

            {showForceCheckout && (
              <div className="border-destructive/30 bg-destructive/8 flex flex-col gap-2 rounded-md border p-3">
                <p className="text-destructive text-sm font-medium">
                  Check-out forcé malgré le blocage ci-dessus (motif ≥ 10
                  caractères, action journalisée).
                </p>
                <Input
                  value={forceMotif}
                  onChange={(e) => setForceMotif(e.target.value)}
                  placeholder="Motif du check-out forcé"
                  disabled={forcingCheckout}
                />
                <Button
                  type="button"
                  variant="destructive"
                  disabled={forceMotif.trim().length < 10 || forcingCheckout}
                  onClick={() => onForceCheckout?.(forceMotif)}
                >
                  {forcingCheckout ? 'Check-out forcé…' : 'Forcer le check-out'}
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Fermer
              </Button>
              {onViewRoom && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onViewRoom(stay)}
                >
                  Voir la chambre
                </Button>
              )}
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
