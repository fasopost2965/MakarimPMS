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
import { addFolioLine } from '../api';
import type { FolioLine } from '../types';

// CH-050 (docs/execution/PLAN_MODULE_FACTURATION.md) — POST /folios/:id/lignes
// existait déjà côté backend (billing:write) sans jamais avoir de formulaire
// côté frontend. Type volontairement figé à EXTRA (pas de sélecteur) :
// HEBERGEMENT et PAIEMENT ont chacun leur propre chemin d'écriture canonique
// (StayService.createFolioPrincipal / PaymentsService.creditFolioLine — voir
// CLAUDE.md "un seul chemin d'écriture par champ sensible") et TAXE_SEJOUR
// est déjà matérialisée automatiquement par BillingService.generateInvoice
// (ParametersService.getApplicableTaxes) — en ajouter une manuellement ici
// ferait croire à tort à generateInvoice() que la taxe est déjà posée
// (`taxeDejaMaterialisee`) et supprimerait silencieusement l'injection
// automatique correcte. Un vrai sélecteur de type n'a donc pas sa place dans
// ce formulaire générique.
const LIGNE_TYPE: FolioLine['type'] = 'EXTRA';

interface Props {
  open: boolean;
  folioId: number;
  onClose: () => void;
  onAdded: () => void;
}

export function AddFolioLineDialog({ open, folioId, onClose, onAdded }: Props) {
  const [libelle, setLibelle] = useState('');
  const [montant, setMontant] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!libelle || !montant) return;
    setSubmitting(true);
    setError(null);
    try {
      await addFolioLine(folioId, { type: LIGNE_TYPE, libelle, montant });
      setLibelle('');
      setMontant('');
      onAdded();
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
          <DialogTitle>Ajouter une charge (extra)</DialogTitle>
        </DialogHeader>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ligne-libelle">Libellé</Label>
            <Input
              id="ligne-libelle"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Ex. Café restaurant"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ligne-montant">Montant HT (MAD)</Label>
            <Input
              id="ligne-montant"
              type="number"
              step="0.01"
              min="0"
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
            <Button type="submit" disabled={submitting || !libelle || !montant}>
              {submitting ? 'Ajout…' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
