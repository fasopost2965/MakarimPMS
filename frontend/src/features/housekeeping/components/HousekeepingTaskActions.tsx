import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HousekeepingTask } from '../types';

// DESIGN-008 — table de mapping actions-par-statut extraite de l'ancien
// HousekeepingTaskRow.tsx (RBAC identique, aucune règle métier modifiée) :
// A_FAIRE→Affecter/Annuler ; AFFECTEE→Démarrer/Réaffecter/Annuler ;
// EN_COURS→Terminer ; TERMINEE→Valider/Refuser [housekeeping:control] ;
// VALIDEE→Réouvrir [housekeeping:control] ; Historique toujours accessible
// tant que housekeeping:read est présent (déjà nécessaire pour voir la
// tâche elle-même). Réutilisée par HousekeepingRoomsView (implicitement,
// via les cartes), HousekeepingTasksView (vue tableau) et
// HousekeepingControlQueue (bandeau gouvernante).
interface HousekeepingTaskActionsProps {
  task: HousekeepingTask;
  permissions?: string[] | null;
  disabled?: boolean;
  onAssign: () => void;
  onStart: () => void;
  onComplete: () => void;
  onValidate: () => void;
  onRefuse: () => void;
  onCancel: () => void;
  onReopen: () => void;
  onTaskHistory: () => void;
  /** Bouton historique textuel (bandeau contrôle) plutôt qu'icône seule
   * (table dense) — même donnée, présentation différente selon le
   * contexte. */
  historyLabel?: string;
  align?: 'start' | 'end';
  /** Vue Tâches uniquement : une tâche TERMINEE est déjà actionnable au
   * premier niveau dans HousekeepingControlQueue (mission §7 — toujours
   * visible, jamais caché derrière un clic) ; dupliquer Valider/Refuser
   * dans la ligne du tableau créerait deux commandes identiques pour la
   * même tâche à l'écran (constaté en e2e live : deux boutons "Valider"
   * simultanés, ambiguïté réelle pour un utilisateur comme pour les
   * lecteurs d'écran). Le contrôle reste possible, mais exclusivement
   * depuis le bandeau — la ligne garde ses autres actions (Historique) et
   * un renvoi textuel neutre. */
  hideControlActions?: boolean;
}

export function HousekeepingTaskActions({
  task,
  permissions,
  disabled,
  onAssign,
  onStart,
  onComplete,
  onValidate,
  onRefuse,
  onCancel,
  onReopen,
  onTaskHistory,
  historyLabel,
  align = 'end',
  hideControlActions = false,
}: HousekeepingTaskActionsProps) {
  const hasWrite = permissions?.includes('housekeeping:write');
  const hasControl = permissions?.includes('housekeeping:control');
  const hasRead = permissions?.includes('housekeeping:read');

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${
        align === 'end' ? 'justify-end' : ''
      }`}
    >
      {task.statut === 'A_FAIRE' && hasWrite && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={onAssign}
            disabled={disabled}
          >
            Affecter
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onCancel}
            disabled={disabled}
          >
            Annuler
          </Button>
        </>
      )}
      {task.statut === 'AFFECTEE' && hasWrite && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={onStart}
            disabled={disabled}
          >
            Démarrer
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onAssign}
            disabled={disabled}
          >
            Réaffecter
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onCancel}
            disabled={disabled}
          >
            Annuler
          </Button>
        </>
      )}
      {task.statut === 'EN_COURS' && hasWrite && (
        <Button size="sm" onClick={onComplete} disabled={disabled}>
          Terminer
        </Button>
      )}
      {task.statut === 'TERMINEE' && hasControl && !hideControlActions && (
        <>
          <Button
            size="sm"
            variant="destructive"
            onClick={onRefuse}
            disabled={disabled}
          >
            Refuser
          </Button>
          <Button size="sm" onClick={onValidate} disabled={disabled}>
            Valider
          </Button>
        </>
      )}
      {task.statut === 'TERMINEE' && hasControl && hideControlActions && (
        <span className="text-muted-foreground text-xs italic">
          Contrôle ci-dessus
        </span>
      )}
      {task.statut === 'VALIDEE' && hasControl && (
        <Button
          size="sm"
          variant="outline"
          onClick={onReopen}
          disabled={disabled}
        >
          Réouvrir
        </Button>
      )}
      {hasRead &&
        (historyLabel ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onTaskHistory}
            disabled={disabled}
          >
            {historyLabel}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={onTaskHistory}
            disabled={disabled}
            aria-label={`Historique de la tâche — chambre ${task.room.numero}`}
          >
            <History className="size-3.5" />
          </Button>
        ))}
    </div>
  );
}
