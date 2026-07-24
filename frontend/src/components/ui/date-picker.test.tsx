import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DateRangeField } from './date-picker';

function ControlledDateRangeField() {
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  return (
    <DateRangeField
      idPrefix="periode"
      startValue={start}
      endValue={end}
      onStartChange={setStart}
      onEndChange={setEnd}
    />
  );
}

describe('DateRangeField — CH-032 (composant partagé, dette Lot 0)', () => {
  it('appelle onStartChange/onEndChange à la saisie', () => {
    const onStartChange = vi.fn();
    const onEndChange = vi.fn();
    render(
      <DateRangeField
        idPrefix="periode"
        startValue=""
        endValue=""
        onStartChange={onStartChange}
        onEndChange={onEndChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Début'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByLabelText('Fin'), {
      target: { value: '2026-01-31' },
    });

    expect(onStartChange).toHaveBeenCalledWith('2026-01-01');
    expect(onEndChange).toHaveBeenCalledWith('2026-01-31');
  });

  it('signale une erreur quand la fin précède le début, effacée quand la période redevient valide', () => {
    render(<ControlledDateRangeField />);

    fireEvent.change(screen.getByLabelText('Début'), {
      target: { value: '2026-06-10' },
    });
    fireEvent.change(screen.getByLabelText('Fin'), {
      target: { value: '2026-06-01' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La date de fin doit être postérieure ou égale à la date de début.',
    );

    fireEvent.change(screen.getByLabelText('Fin'), {
      target: { value: '2026-06-15' },
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
