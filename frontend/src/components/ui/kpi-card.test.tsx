import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Gauge } from 'lucide-react';
import { KpiCard, KpiCardSkeleton } from './kpi-card';

// DESIGN-002 — KpiCard formalisé en primitive partagée (Makarim Design
// System 2026 §3). Ces tests protègent les propriétés qui ne doivent pas
// régresser lors des prochains lots de migration : accessibilité clavier
// d'une carte cliquable, absence d'interactivité quand elle n'est pas
// cliquable, et absence de tout recalcul de la valeur affichée.
describe('KpiCard', () => {
  it('affiche le label, la valeur et le contexte secondaire tels quels', () => {
    render(
      <KpiCard
        label="Taux d'occupation"
        value="75%"
        hint="Sur les 24 chambres"
        icon={Gauge}
      />,
    );
    const label = screen.getByText("Taux d'occupation");
    expect(label).toBeVisible();
    expect(label).not.toHaveClass('uppercase');
    expect(screen.getByText('75%')).toBeVisible();
    expect(screen.getByText('Sur les 24 chambres')).toBeVisible();
  });

  it("n'est ni focusable ni annoncée comme bouton sans onClick", () => {
    render(<KpiCard label="Départs" value="3" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('devient un bouton atteignable au clavier quand elle est cliquable', () => {
    const onClick = vi.fn();
    render(<KpiCard label="Départs" value="3" onClick={onClick} />);

    const card = screen.getByRole('button', { name: /Départs/ });
    expect(card).toHaveAttribute('tabindex', '0');

    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(card, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('borne la barre de progression sans jamais modifier la valeur affichée', () => {
    const { container, rerender } = render(
      <KpiCard label="Occupation" value="120%" progress={120} />,
    );
    let bar = container.querySelector<HTMLElement>(
      '[data-slot="kpi-card"] > div > div',
    );
    expect(bar?.style.width).toBe('100%');
    // La valeur textuelle, elle, n'est jamais corrigée par le composant.
    expect(screen.getByText('120%')).toBeVisible();

    rerender(<KpiCard label="Occupation" value="-5%" progress={-5} />);
    bar = container.querySelector<HTMLElement>(
      '[data-slot="kpi-card"] > div > div',
    );
    expect(bar?.style.width).toBe('0%');
  });

  it('expose un squelette de chargement aux mêmes emplacements', () => {
    const { container } = render(<KpiCardSkeleton />);
    expect(
      container.querySelector('[data-slot="kpi-card-skeleton"]'),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      4,
    );
  });
});
