import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  resetKey?: unknown;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "Erreur de rendu interceptée par ErrorBoundary :",
      error,
      info,
    );
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.message?.includes("dynamically imported module") ||
        this.state.error?.message?.includes("Failed to fetch dynamically imported module") ||
        this.state.error?.message?.includes("Loading chunk");

      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-base font-medium">
            {isChunkError
              ? "Une mise à jour de l'application a été effectuée."
              : "Un problème est survenu sur cet écran."}
          </p>
          <p className="text-muted-foreground max-w-md text-sm">
            {isChunkError
              ? "Certains modules mis à jour nécessitent un rafraîchissement du navigateur."
              : "Vos données n'ont pas été perdues. Vous pouvez réessayer ou revenir au tableau de bord."}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={this.handleReload}>
              Recharger la page
            </Button>
            {!isChunkError && (
              <Button size="sm" variant="outline" onClick={this.handleReset}>
                Revenir au tableau de bord
              </Button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
