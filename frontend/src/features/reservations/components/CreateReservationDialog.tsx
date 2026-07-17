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
import type { Room } from '../types';

export interface CreateReservationSelection {
  room: Room;
  dateArrivee: string;
  dateDepart: string;
}

interface Props {
  selection: CreateReservationSelection | null;
  onClose: () => void;
  onConfirm: (input: {
    nom: string;
    prenom: string;
    telephone?: string;
    email?: string;
  }) => void;
  submitting: boolean;
  error: string | null;
}

export function CreateReservationDialog({
  selection,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  const open = selection !== null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {selection && (
          // Clé = remonte le formulaire (champs vides) à chaque nouvelle
          // sélection, sans passer par un effect pour resynchroniser l'état.
          <ReservationForm
            key={`${selection.room.id}-${selection.dateArrivee}-${selection.dateDepart}`}
            selection={selection}
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

function ReservationForm({
  selection,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props & { selection: CreateReservationSelection }) {
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouvelle réservation</DialogTitle>
      </DialogHeader>

      <p className="text-muted-foreground text-sm">
        Chambre {selection.room.numero} ({selection.room.roomType.nom}) — du{' '}
        {selection.dateArrivee} au {selection.dateDepart}
      </p>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm({
            nom,
            prenom,
            telephone: telephone || undefined,
            email: email || undefined,
          });
        }}
      >
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
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Création…' : 'Créer la réservation'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
