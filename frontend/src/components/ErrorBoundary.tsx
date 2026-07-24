import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  // Rendu à chaque changement d'onglet actif : force le remontage de la
  // limite (et donc la sortie de l'état d'erreur) quand l'utilisateur
  // navigue ailleurs, sans quoi un onglet resterait bloqué en erreur même
  // après avoir quitté puis re-sélectionné un écran fonctionnel.
  resetKey?: unknown;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
}

// CH-031 — limite de récupération d'erreur transverse (Lot 0 du plan
// frontend d'origine, jamais construite avant cette itération). Sans elle,
// une exception de rendu dans un seul onglet fait planter toute
// l'application (écran blanc complet), pas seulement l'écran fautif —
// docs/audits/PHASE_11_FRONTEND_QUALITE.md §4.5. Un composant classe reste
// la seule API React capable d'intercepter une erreur de rendu
// (getDerivedStateFromError/componentDidCatch n'ont pas d'équivalent hook).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      'Erreur de rendu interceptée par ErrorBoundary :',
      error,
      info,
    );
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-base font-medium">
            Un problème est survenu sur cet écran.
          </p>
          <p className="text-muted-foreground max-w-md text-sm">
            Vos données n'ont pas été perdues. Vous pouvez réessayer ou revenir
            au tableau de bord.
          </p>
          <Button size="sm" onClick={this.handleReset}>
            Revenir au tableau de bord
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
