import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsPanel, TabsTrigger } from '@/components/ui/tabs';
import type { Room } from '../../reservations/types';
import type { DashboardTarget } from '../pages/DashboardPage';
import {
  deriveRoomContextMode,
  STATUT_CHAMBRE_LABEL,
} from './room-context/mode';
import { ReserverPanel } from './room-context/ReserverPanel';
import { ReservationSummary } from './room-context/ReservationSummary';
import { StaySummary } from './room-context/StaySummary';
import { HousekeepingSummary } from './room-context/HousekeepingSummary';
import { MaintenanceSummary } from './room-context/MaintenanceSummary';
import { RoomHistoryPanel } from './room-context/RoomHistoryPanel';

const STATUT_BADGE_VARIANT: Record<
  Room['statut'],
  'success' | 'info' | 'default' | 'warning' | 'violet' | 'destructive'
> = {
  LIBRE_PROPRE: 'success',
  RESERVEE: 'info',
  OCCUPEE: 'default',
  DEPART_PREVU: 'info',
  A_NETTOYER: 'warning',
  EN_NETTOYAGE: 'violet',
  EN_MAINTENANCE: 'destructive',
};

interface Props {
  room: Room | null;
  rooms: Room[];
  permissions: string[] | null;
  onClose: () => void;
  onNavigate: (target: DashboardTarget) => void;
  onRoomsChanged?: () => void;
}

// DESIGN-006 — shell léger : chrome commun (header, onglets, responsive,
// fermeture), aucune logique métier propre. Chaque panneau ci-dessous fait
// son propre fetch contextuel + gère son propre loading/erreur/vide/RBAC —
// ce composant se contente de choisir lequel monter selon
// `deriveRoomContextMode(room.statut)` (fonction pure, Discovery Phase 1
// §10 challengée : pas de switch monolithique, un sous-composant par
// statut).
export function RoomContextModal({
  room,
  rooms,
  permissions,
  onClose,
  onNavigate,
  onRoomsChanged,
}: Props) {
  const [activeTab, setActiveTab] = useState('details');

  function handleOpenChange(next: boolean) {
    if (!next) {
      setActiveTab('details');
      onClose();
    }
  }

  function handleNavigate(target: DashboardTarget) {
    onClose();
    onNavigate(target);
  }

  return (
    <Dialog open={room !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col overflow-y-auto sm:max-w-xl">
        {room && (
          <>
            <DialogHeader>
              <DialogTitle>Chambre {room.numero}</DialogTitle>
            </DialogHeader>

            {/* Header commun — uniquement des informations réellement
                présentes (mission §3) : jamais de surface, photo de chambre
                ou équipement non modélisé. */}
            <div className="bg-muted/30 flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUT_BADGE_VARIANT[room.statut]}>
                  {STATUT_CHAMBRE_LABEL[room.statut]}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {room.roomType.nom}
                {room.etage != null ? ` — étage ${room.etage}` : ''}
                {' — capacité '}
                {room.roomType.capacite}
              </p>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) => value && setActiveTab(value)}
            >
              <TabsList>
                <TabsTrigger value="details">Détails</TabsTrigger>
                <TabsTrigger value="historique">Historique</TabsTrigger>
              </TabsList>

              <TabsPanel value="details" className="pt-3">
                {deriveRoomContextMode(room.statut) === 'LIBRE_PROPRE' && (
                  <ReserverPanel
                    room={room}
                    rooms={rooms}
                    permissions={permissions}
                    onReserved={() => {
                      onRoomsChanged?.();
                      onClose();
                    }}
                  />
                )}
                {deriveRoomContextMode(room.statut) === 'RESERVEE' && (
                  <ReservationSummary
                    room={room}
                    permissions={permissions}
                    onNavigate={() => handleNavigate('reservations')}
                  />
                )}
                {deriveRoomContextMode(room.statut) === 'SEJOUR' && (
                  <StaySummary
                    room={room}
                    permissions={permissions}
                    onNavigate={() => handleNavigate('checkin')}
                  />
                )}
                {deriveRoomContextMode(room.statut) === 'HOUSEKEEPING' && (
                  <HousekeepingSummary
                    room={room}
                    permissions={permissions}
                    onNavigate={() => handleNavigate('housekeeping')}
                  />
                )}
                {deriveRoomContextMode(room.statut) === 'MAINTENANCE' && (
                  <MaintenanceSummary
                    room={room}
                    permissions={permissions}
                    onNavigate={() => handleNavigate('maintenance')}
                  />
                )}
              </TabsPanel>

              <TabsPanel value="historique" className="pt-3">
                <RoomHistoryPanel room={room} permissions={permissions} />
              </TabsPanel>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
