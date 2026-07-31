import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppTopbar } from './AppTopbar';

// CH-034 — bouton d'ouverture du tiroir mobile, jamais couvert avant ce
// chantier (docs/audits/PHASE_11_FRONTEND_QUALITE.md §4.7).
describe('AppTopbar — CH-034', () => {
  it("affiche le titre de l'onglet actif", () => {
    render(
      <AppTopbar
        activeTab="stock"
        onLogout={vi.fn()}
        onOpenMobileNav={vi.fn()}
        onNavigate={vi.fn()}
        permissions={null}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Stock' })).toBeInTheDocument();
  });

  it('le bouton hamburger appelle onOpenMobileNav', () => {
    const onOpenMobileNav = vi.fn();
    render(
      <AppTopbar
        activeTab="dashboard"
        onLogout={vi.fn()}
        onOpenMobileNav={onOpenMobileNav}
        onNavigate={vi.fn()}
        permissions={null}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Ouvrir la navigation' }),
    );
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });
});
