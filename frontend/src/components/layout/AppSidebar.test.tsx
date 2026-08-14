import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppSidebar } from './AppSidebar';

const baseProps = {
  activeTab: 'dashboard' as const,
  onNavigate: vi.fn(),
  collapsed: false,
  onToggleCollapsed: vi.fn(),
  mobileOpen: false,
  onMobileClose: vi.fn(),
};

// CH-011 (gating RBAC, granularité onglet entier, RD-009) jamais couvert
// par un test automatisé jusqu'ici — vérifié uniquement en navigateur réel
// à la clôture de ce chantier. Reproduit ici le scénario Gouvernante déjà
// vérifié manuellement (housekeeping:read + stock:read, sans
// maintenance:read ni rh:read) pour qu'une régression future soit détectée
// sans repasser par une vérification manuelle.
describe('AppSidebar — gating RBAC (CH-011)', () => {
  it("n'affiche aucun onglet tant que les permissions ne sont pas encore chargées", () => {
    render(<AppSidebar {...baseProps} permissions={null} />);
    expect(screen.queryByText('Tableau de bord')).not.toBeInTheDocument();
    expect(screen.queryByText('Réservations')).not.toBeInTheDocument();
  });

  it("n'affiche que les onglets couverts par les permissions accordées (rôle Gouvernante)", () => {
    render(
      <AppSidebar
        {...baseProps}
        permissions={['housekeeping:read', 'stock:read']}
      />,
    );
    expect(screen.getByText('Housekeeping')).toBeInTheDocument();
    expect(screen.getByText('Stock')).toBeInTheDocument();
    expect(screen.queryByText('Maintenance')).not.toBeInTheDocument();
    expect(screen.queryByText('RH')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit')).not.toBeInTheDocument();
  });

  it('affiche tous les onglets pour un rôle disposant de toutes les permissions :read', () => {
    const allReadPermissions = [
      'dashboard:read',
      'reservations:read',
      'checkin:read',
      'housekeeping:read',
      'maintenance:read',
      'guests:read',
      'guests:write',
      'parameters:read',
      'rh:read',
      'stock:read',
      'reporting:read',
      'notifications:read',
      'audit:read',
    ];
    render(<AppSidebar {...baseProps} permissions={allReadPermissions} />);
    expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
    expect(screen.getByText('Audit')).toBeInTheDocument();
    expect(screen.getByText("Scan pièce d'identité")).toBeInTheDocument();
  });

  // DESIGN-010 — "Facturation" est désormais un onglet top-level gated par
  // billing:read (jamais checkin:read, dépendance historique retirée).
  it('affiche "Facturation" avec billing:read, la masque avec checkin:read seul', () => {
    const { rerender } = render(
      <AppSidebar {...baseProps} permissions={['billing:read']} />,
    );
    expect(screen.getByText('Facturation')).toBeInTheDocument();

    rerender(<AppSidebar {...baseProps} permissions={['checkin:read']} />);
    expect(screen.queryByText('Facturation')).not.toBeInTheDocument();
  });
});

// CH-034 — tiroir mobile (docs/audits/PHASE_11_FRONTEND_QUALITE.md §4.7) :
// jamais couvert avant ce chantier, le frontend était desktop-only.
describe('AppSidebar — tiroir mobile (CH-034)', () => {
  it("n'affiche aucun fond assombri (backdrop) quand le tiroir est fermé", () => {
    render(<AppSidebar {...baseProps} permissions={['dashboard:read']} />);
    expect(document.querySelector('[data-slot="sidebar-backdrop"]')).toBeNull();
  });

  it('ferme le tiroir au clic sur le fond assombri (backdrop)', () => {
    const onMobileClose = vi.fn();
    render(
      <AppSidebar
        {...baseProps}
        permissions={['dashboard:read']}
        mobileOpen
        onMobileClose={onMobileClose}
      />,
    );
    const backdrop = document.querySelector('[data-slot="sidebar-backdrop"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onMobileClose).toHaveBeenCalledTimes(1);
  });

  it('ferme le tiroir à la touche Échap', () => {
    const onMobileClose = vi.fn();
    render(
      <AppSidebar
        {...baseProps}
        permissions={['dashboard:read']}
        mobileOpen
        onMobileClose={onMobileClose}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onMobileClose).toHaveBeenCalledTimes(1);
  });

  it('ferme le tiroir automatiquement après un clic sur un item de navigation', () => {
    const onNavigate = vi.fn();
    const onMobileClose = vi.fn();
    render(
      <AppSidebar
        {...baseProps}
        permissions={['housekeeping:read']}
        mobileOpen
        onNavigate={onNavigate}
        onMobileClose={onMobileClose}
      />,
    );
    fireEvent.click(screen.getByText('Housekeeping'));
    expect(onNavigate).toHaveBeenCalledWith('housekeeping');
    expect(onMobileClose).toHaveBeenCalledTimes(1);
  });

  it('affiche toujours les libellés complets dans le tiroir mobile, même si collapsed=true (concept desktop uniquement)', () => {
    render(
      <AppSidebar
        {...baseProps}
        permissions={['dashboard:read']}
        collapsed
        mobileOpen
      />,
    );
    expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
  });
});
