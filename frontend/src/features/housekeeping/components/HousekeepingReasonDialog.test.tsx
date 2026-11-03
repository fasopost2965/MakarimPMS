import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HousekeepingReasonDialog } from './HousekeepingReasonDialog';

function renderDialog(
  props: Partial<React.ComponentProps<typeof HousekeepingReasonDialog>> = {},
) {
  const onConfirm = vi.fn();
  render(
    <HousekeepingReasonDialog
      open
      onClose={() => undefined}
      title="Valider la tâche"
      confirmLabel="Valider"
      onConfirm={onConfirm}
      submitting={false}
      {...props}
    />,
  );
  return { onConfirm };
}

describe('HousekeepingReasonDialog', () => {
  it('affiche l’erreur serveur DANS la fenêtre', () => {
    renderDialog({ actionError: 'Auto-validation interdite.' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Auto-validation interdite.',
    );
  });

  it('désactive la confirmation et explique pourquoi quand l’action est bloquée', async () => {
    const { onConfirm } = renderDialog({
      blockedReason: 'Un autre contrôleur doit valider.',
    });
    await userEvent.type(
      screen.getByLabelText('Motif (minimum 10 caractères)'),
      'chambre verifiee ok',
    );
    const bouton = screen.getByRole('button', { name: 'Valider' });
    expect(bouton).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Un autre contrôleur doit valider.',
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirme normalement avec un motif de 10 caractères et sans blocage', async () => {
    const { onConfirm } = renderDialog();
    await userEvent.type(
      screen.getByLabelText('Motif (minimum 10 caractères)'),
      'chambre verifiee ok',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }));
    expect(onConfirm).toHaveBeenCalledWith('chambre verifiee ok');
  });
});
