import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoneyDisplay } from './money-display';

// DESIGN-002 — règle §1.4/§8 : tout montant MAD est rendu en
// `font-mono tabular-nums`, et §7 : jamais reformaté ni animé côté client.
// Ce dernier point est un invariant de confiance financière, pas une
// préférence esthétique : un montant reformaté par le frontend ferait de
// celui-ci une seconde source de vérité sur une valeur métier.
describe('MoneyDisplay', () => {
  it('affiche le montant exactement tel que fourni par le backend', () => {
    render(<MoneyDisplay value="1250.00" />);
    expect(screen.getByText('1250.00 MAD')).toBeVisible();
  });

  it("n'arrondit ni ne localise une valeur à décimales longues", () => {
    render(<MoneyDisplay value="0.05" />);
    expect(screen.getByText('0.05 MAD')).toBeVisible();
  });

  it('applique font-mono et tabular-nums pour aligner les colonnes', () => {
    render(<MoneyDisplay value="42.00" />);
    const el = screen.getByText('42.00 MAD');
    expect(el.className).toContain('font-mono');
    expect(el.className).toContain('tabular-nums');
  });

  it('accepte une autre devise sans en supposer une par défaut invisible', () => {
    render(<MoneyDisplay value="10.00" devise="EUR" />);
    expect(screen.getByText('10.00 EUR')).toBeVisible();
  });
});
