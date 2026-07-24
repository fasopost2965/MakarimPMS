import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectSearch } from './select-search';

const ITEMS = [
  { value: '1', label: '101 — Simple' },
  { value: '2', label: '102 — Double' },
  { value: '3', label: '201 — Suite' },
];

describe('SelectSearch — CH-032 (composant partagé, dette Lot 0)', () => {
  it("affiche le libellé de l'élément sélectionné dans le champ", () => {
    render(<SelectSearch items={ITEMS} value="2" onValueChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveValue('102 — Double');
  });

  it('filtre les options à la saisie et sélectionne une chambre', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SelectSearch items={ITEMS} value="" onValueChange={onValueChange} />,
    );

    const input = screen.getByRole('combobox');
    await user.type(input, 'Suite');

    const option = await screen.findByRole('option', { name: '201 — Suite' });
    await user.click(option);

    expect(onValueChange).toHaveBeenCalledWith('3');
  });
});
