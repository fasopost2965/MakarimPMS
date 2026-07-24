import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './dialog';

// CH-029 (accessibilité, docs/audits/PHASE_11_FRONTEND_QUALITE.md §4.2) —
// dialog.tsx enveloppe @base-ui/react/dialog, qui s'appuie en interne sur
// FloatingFocusManager (floating-ui) en mode modal : piégeage du focus et
// restauration au déclencheur sont déjà fournis par le primitif, pas à
// construire ici. Ce test le PROUVE (comportement découvert en lisant
// node_modules/@base-ui/react/dialog/popup/DialogPopup.js — même discipline
// que la découverte data-active/aria-hidden des lots précédents) plutôt que
// de le supposer.
function TestDialog() {
  return (
    <Dialog>
      <DialogTrigger>Ouvrir</DialogTrigger>
      <DialogContent>
        <DialogTitle>Titre du dialogue</DialogTitle>
        <DialogDescription>Description</DialogDescription>
        <button type="button">Premier bouton</button>
        <button type="button">Second bouton</button>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog — piégeage et restauration du focus (CH-029)', () => {
  it('déplace le focus dans le dialogue à son ouverture', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('piège le focus dans le dialogue (Tab ne sort jamais vers le déclencheur)', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    const dialog = await screen.findByRole('dialog');

    // FloatingFocusManager (base-ui/floating-ui) matérialise des "focus
    // guards" (spans sentinelles hors du dialogue) pour détecter une sortie
    // de focus et la rediriger — le focus y transite un instant avant la
    // redirection interne, d'où le waitFor plutôt qu'une assertion
    // synchrone après chaque Tab.
    for (let i = 0; i < 8; i++) {
      await user.tab();
      await waitFor(() =>
        expect(dialog).toContainElement(document.activeElement as HTMLElement),
      );
    }
  });

  it('restaure le focus sur le déclencheur à la fermeture (Échap)', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);
    const trigger = screen.getByRole('button', { name: 'Ouvrir' });
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
