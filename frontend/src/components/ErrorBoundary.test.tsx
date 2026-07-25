import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary — CH-031', () => {
  it("affiche le contenu normalement en l'absence d'erreur", () => {
    render(
      <ErrorBoundary>
        <p>Contenu normal</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Contenu normal')).toBeInTheDocument();
  });

  it("confine une erreur de rendu à l'écran fautif au lieu de laisser planter toute l'application", () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(
      screen.getByText('Un problème est survenu sur cet écran.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Contenu normal')).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("se réarme automatiquement quand resetKey change (changement d'onglet)", () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary resetKey="tab-a">
        <Boom />
      </ErrorBoundary>,
    );
    expect(
      screen.getByText('Un problème est survenu sur cet écran.'),
    ).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="tab-b">
        <p>Autre onglet</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Autre onglet')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('le bouton "Revenir au tableau de bord" appelle onReset', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReset = vi.fn();
    render(
      <ErrorBoundary onReset={onReset}>
        <Boom />
      </ErrorBoundary>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Revenir au tableau de bord' }),
    );
    expect(onReset).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
