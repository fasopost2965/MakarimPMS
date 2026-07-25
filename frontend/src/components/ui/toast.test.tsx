import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, toastManager } from './toast';

afterEach(() => {
  // Le manager est un singleton persistant entre les tests (dette
  // assumée : c'est précisément ce qui permet à toastManager.add() de
  // fonctionner depuis n'importe quel composant sans hook local) — on le
  // vide explicitement pour ne pas laisser un toast d'un test fuiter vers
  // le suivant.
  toastManager.close();
});

describe('Toaster — CH-032 (composant partagé, dette Lot 0)', () => {
  it('affiche un toast ajouté via toastManager.add()', async () => {
    render(<Toaster />);

    toastManager.add({
      title: 'Réassort enregistré',
      description: '+10 unités — Serviettes',
      type: 'success',
    });

    expect(await screen.findByText('Réassort enregistré')).toBeInTheDocument();
    expect(screen.getByText('+10 unités — Serviettes')).toBeInTheDocument();
  });

  it('la fermeture programmatique (toastManager.close) retire le toast du DOM', async () => {
    render(<Toaster />);

    const id = toastManager.add({
      title: 'Notification fermable',
      type: 'success',
    });
    await screen.findByText('Notification fermable');

    toastManager.close(id);

    await waitFor(() => {
      expect(
        screen.queryByText('Notification fermable'),
      ).not.toBeInTheDocument();
    });
  });

  it('le bouton de fermeture devient accessible une fois la pile de notifications survolée', async () => {
    const user = userEvent.setup();
    render(<Toaster />);

    toastManager.add({ title: 'Notification survolée', type: 'success' });
    await screen.findByText('Notification survolée');

    await user.hover(screen.getByRole('region', { name: 'Notifications' }));

    const closeButton = await screen.findByRole('button', {
      name: 'Fermer la notification',
    });
    await user.click(closeButton);

    await waitFor(() => {
      expect(
        screen.queryByText('Notification survolée'),
      ).not.toBeInTheDocument();
    });
  });
});
