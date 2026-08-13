import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PrioriteTicket } from '../../maintenance/types';
import type { Room } from '../../reservations/types';

interface Props {
  open: boolean;
  rooms: Room[];
  onClose: () => void;
  onConfirm: (input: {
    roomId: number;
    typePanne: string;
    priorite?: PrioriteTicket;
  }) => void;
  submitting: boolean;
}

const PRIORITE_OPTIONS: { value: PrioriteTicket; label: string }[] = [
  { value: 'BASSE', label: 'Basse' },
  { value: 'MOYENNE', label: 'Moyenne' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'URGENTE', label: 'Urgente' },
];

// DESIGN-008 — « Signaler un incident » (housekeeping:report-incident,
// Gouvernante uniquement) : réutilise POST /mobile/housekeeping/incidents
// (déjà exposé côté backend pour l'app mobile, aucune restriction de scope
// de jeton n'empêche un jeton desktop de l'appeler) via
// HousekeepingService.reportIncident() — aucun nouveau code backend.
export function HousekeepingIncidentDialog({
  open,
  rooms,
  onClose,
  onConfirm,
  submitting,
}: Props) {
  const [roomId, setRoomId] = useState<number | null>(null);
  const [typePanne, setTypePanne] = useState('');
  const [priorite, setPriorite] = useState<PrioriteTicket | ''>('');

  const isValid = roomId !== null && typePanne.trim().length >= 3;

  function handleConfirm() {
    if (!isValid || roomId === null) return;
    onConfirm({
      roomId,
      typePanne: typePanne.trim(),
      priorite: priorite || undefined,
    });
  }

  function reset() {
    setRoomId(null);
    setTypePanne('');
    setPriorite('');
  }

  function handleOpenChange(next: boolean) {
    if (!next && !submitting) {
      reset();
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signaler un incident</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="incident-room">Chambre</Label>
            <Select
              value={roomId === null ? '' : String(roomId)}
              onValueChange={(val) => setRoomId(val ? Number(val) : null)}
              disabled={submitting}
              items={rooms.map((room) => ({
                value: String(room.id),
                label: room.numero,
              }))}
            >
              <SelectTrigger id="incident-room">
                <SelectValue placeholder="Sélectionner une chambre" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={String(room.id)}>
                    {room.numero}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="incident-type-panne">Type de panne</Label>
            <Input
              id="incident-type-panne"
              value={typePanne}
              onChange={(e) => setTypePanne(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="incident-priorite">Priorité (optionnelle)</Label>
            <Select
              value={priorite}
              onValueChange={(val) =>
                setPriorite((val as PrioriteTicket) || '')
              }
              disabled={submitting}
              items={PRIORITE_OPTIONS}
            >
              <SelectTrigger id="incident-priorite">
                <SelectValue placeholder="Non précisée" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || submitting}>
            Signaler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
