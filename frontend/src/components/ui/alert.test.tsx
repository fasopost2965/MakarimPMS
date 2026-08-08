import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert } from './alert';

// DESIGN-002 — §8 : « États ne reposant pas uniquement sur la couleur ».
// Chaque ton porte une icône ET un libellé texte ; le ton destructive est en
// plus annoncé comme `role="alert"` pour être signalé immédiatement par un
// lecteur d'écran.
describe('Alert', () => {
  it('affiche toujours un titre texte, jamais une simple pastille colorée', () => {
    render(<Alert tone="warning" title="Solde dû au check-out" />);
    expect(screen.getByText('Solde dû au check-out')).toBeVisible();
  });

  it('accompagne systématiquement la couleur d’une icône', () => {
    const { container } = render(<Alert tone="success" title="Enregistré" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('annonce un ton destructive comme alerte, les autres comme statut', () => {
    const { rerender } = render(
      <Alert tone="destructive" title="Paiement refusé" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Paiement refusé');

    rerender(<Alert tone="info" title="Information" />);
    expect(screen.getByRole('status')).toHaveTextContent('Information');
  });

  it('affiche la description et l’action fournies', () => {
    render(
      <Alert
        tone="info"
        title="Fiche police manquante"
        description="Le registre DGSN doit être complété."
        action={<button type="button">Compléter</button>}
      />,
    );
    expect(
      screen.getByText('Le registre DGSN doit être complété.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Compléter' })).toBeVisible();
  });
});
