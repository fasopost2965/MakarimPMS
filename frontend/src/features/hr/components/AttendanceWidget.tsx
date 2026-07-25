import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  demarrerService,
  mettreEnPause,
  reprendreService,
  statutCourant,
  terminerService,
} from '../api';
import type { StatutCourant } from '../types';

const STATUT_LABEL: Record<StatutCourant['statut'], string> = {
  NON_DEMARRE: 'Service non démarré',
  ACTIF: 'En service',
  EN_PAUSE: 'En pause',
  TERMINE: 'Service terminé',
};

// Pointage self-service (ADR-007) — visible en permanence dans la barre de
// navigation pour tout le personnel, pas seulement le rôle RH : chaque
// employé pointe sur sa propre fiche, jamais au nom d'un collègue.
export function AttendanceWidget() {
  const [statut, setStatut] = useState<StatutCourant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setStatut(await statutCourant());
    } catch {
      // Aucune fiche employé active associée à ce compte (ex. Administrateur
      // sans dossier RH) — le widget reste silencieusement masqué.
      setStatut(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  async function run(action: () => Promise<unknown>) {
    setLoading(true);
    setError(null);
    try {
      await action();
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  if (!statut) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Badge variant={statut.statut === 'ACTIF' ? 'default' : 'secondary'}>
        {STATUT_LABEL[statut.statut]}
      </Badge>
      {statut.statut === 'NON_DEMARRE' && (
        <Button
          size="sm"
          disabled={loading}
          onClick={() => run(demarrerService)}
        >
          Démarrer
        </Button>
      )}
      {statut.statut === 'ACTIF' && (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => run(mettreEnPause)}
          >
            Pause
          </Button>
          <Button
            size="sm"
            disabled={loading}
            onClick={() => run(terminerService)}
          >
            Terminer
          </Button>
        </>
      )}
      {statut.statut === 'EN_PAUSE' && (
        <Button
          size="sm"
          disabled={loading}
          onClick={() => run(reprendreService)}
        >
          Reprendre
        </Button>
      )}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}
