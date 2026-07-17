import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Room } from '../../reservations/types';
import type { WalkinCheckinInput } from '../types';

interface Props {
  open: boolean;
  rooms: Room[];
  onClose: () => void;
  onConfirm: (input: WalkinCheckinInput) => void;
  submitting: boolean;
  error: string | null;
}

export function WalkinCheckinDialog({
  open,
  rooms,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {/* Le formulaire n'est monté que pendant l'ouverture : il repart
            toujours d'un état vide sans avoir besoin d'un effect de reset. */}
        {open && (
          <WalkinForm
            rooms={rooms}
            onClose={onClose}
            onConfirm={onConfirm}
            submitting={submitting}
            error={error}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function WalkinForm({
  rooms,
  onClose,
  onConfirm,
  submitting,
  error,
}: Omit<Props, 'open'>) {
  const [roomId, setRoomId] = useState('');
  const [dateCheckoutPrevue, setDateCheckoutPrevue] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');

  return (
    <>
      <DialogHeader>
        <DialogTitle>Check-in walk-in</DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!roomId || !dateCheckoutPrevue) return;
          onConfirm({
            roomId: Number(roomId),
            dateCheckoutPrevue,
            guest: {
              nom,
              prenom,
              telephone: telephone || undefined,
              email: email || undefined,
            },
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room">Chambre</Label>
          <Select
            value={roomId}
            onValueChange={(v) => setRoomId(v ?? '')}
            items={rooms.map((room) => ({
              value: String(room.id),
              label: `${room.numero} — ${room.roomType.nom}`,
            }))}
          >
            <SelectTrigger id="room" className="w-full">
              <SelectValue placeholder="Choisir une chambre" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={String(room.id)}>
                  {room.numero} — {room.roomType.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateCheckoutPrevue">Départ prévu</Label>
          <Input
            id="dateCheckoutPrevue"
            type="date"
            value={dateCheckoutPrevue}
            onChange={(e) => setDateCheckoutPrevue(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nom">Nom</Label>
          <Input
            id="nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prenom">Prénom</Label>
          <Input
            id="prenom"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telephone">Téléphone</Label>
          <Input
            id="telephone"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={submitting || !roomId || !dateCheckoutPrevue}
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer le check-in'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
