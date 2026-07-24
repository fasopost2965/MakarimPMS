import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppSidebar } from './AppSidebar';

const baseProps = {
  activeTab: 'dashboard' as const,
  onNavigate: vi.fn(),
  collapsed: false,
  onToggleCollapsed: vi.fn(),
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
});
