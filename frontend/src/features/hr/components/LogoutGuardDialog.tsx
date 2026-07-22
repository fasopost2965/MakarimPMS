import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { mettreEnPause, terminerService } from '../api';

interface Props {
  open: boolean;
  onCancel: () => void;
  onResolved: () => void;
}

// BR-RH-004 (ADR-007 §3.5/§8) : une déconnexion pendant un service actif est
// bloquée — l'employé doit explicitement clôturer ou mettre en pause son
// service avant que le frontend ne détruise la session locale.
export function LogoutGuardDialog({ open, onCancel, onResolved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setLoading(true);
    setError(null);
    try {
      await action();
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Service en cours</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Un service de pointage est actif sur ce compte. Clôturez-le ou
          mettez-le en pause avant de vous déconnecter (BR-RH-004).
        </p>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => run(mettreEnPause)}
          >
            Mettre en pause
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => run(terminerService)}
          >
            Terminer mon service
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
