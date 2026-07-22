import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createPayment } from '../api';
import type { MoyenPaiement } from '../types';

const MOYENS: MoyenPaiement[] = ['ESPECES', 'CARTE', 'VIREMENT', 'ACOMPTE'];

const MOYEN_LABEL: Record<MoyenPaiement, string> = {
  ESPECES: 'Espèces',
  CARTE: 'Carte',
  VIREMENT: 'Virement',
  ACOMPTE: 'Acompte',
};

interface Props {
  open: boolean;
  folioId: number;
  onClose: () => void;
  onRecorded: () => void;
}

// Encaissement d'un règlement sur un folio (docs/modules/payments.md §4) —
// idempotencyKey générée côté client à l'ouverture du dialogue, pas à
// chaque frappe, pour qu'un double-clic sur "Enregistrer" ne crée jamais
// deux paiements distincts.
export function RecordPaymentDialog({
  open,
  folioId,
  onClose,
  onRecorded,
}: Props) {
  const [moyen, setMoyen] = useState<MoyenPaiement>('ESPECES');
  const [montant, setMontant] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!montant) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPayment({ folioId, moyen, montant, idempotencyKey });
      onRecorded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encaisser un paiement</DialogTitle>
        </DialogHeader>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="moyen">Moyen de paiement</Label>
            <Select
              value={moyen}
              onValueChange={(v) => v && setMoyen(v as MoyenPaiement)}
              items={MOYENS.map((m) => ({ value: m, label: MOYEN_LABEL[m] }))}
            >
              <SelectTrigger id="moyen" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOYENS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MOYEN_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="montant">Montant (MAD)</Label>
            <Input
              id="montant"
              type="number"
              step="0.01"
              min="0.01"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              required
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
            <Button type="submit" disabled={submitting || !montant}>
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
