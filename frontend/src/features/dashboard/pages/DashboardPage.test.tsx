import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api', () => ({ getDashboardResume: vi.fn() }));
vi.mock('../components/RoomsToCleanWidget', () => ({
  RoomsToCleanWidget: () => <div>Widget chambres</div>,
}));
vi.mock('../components/OpenMaintenanceWidget', () => ({
  OpenMaintenanceWidget: () => <div>Widget maintenance</div>,
}));

import { getDashboardResume } from '../api';
import { DashboardPage } from './DashboardPage';

const RESUME = {
  tauxOccupation: 75,
  chambresOccupees: 15,
  totalChambres: 20,
  arriveesAujourdhui: 4,
  departsAujourdhui: 3,
  chambresANettoyer: 2,
  encaisseAujourdhui: '1250.00',
};

describe('DashboardPage — personnalisation par permissions', () => {
  beforeEach(() => {
    vi.mocked(getDashboardResume).mockReset();
    vi.mocked(getDashboardResume).mockResolvedValue(RESUME);
  });

  it('conserve la sémantique des KPI existants', async () => {
    render(
      <DashboardPage onNavigate={vi.fn()} permissions={['dashboard:read']} />,
    );

    expect(await screen.findByText("Taux d'occupation")).toBeVisible();
    expect(screen.getByText('75%')).toBeVisible();
    expect(screen.getByText("Arrivées aujourd'hui")).toBeVisible();
    expect(screen.getByText("Départs aujourd'hui")).toBeVisible();
    expect(screen.getByText('Chambres à nettoyer')).toBeVisible();
    expect(screen.getByText("Encaissé aujourd'hui")).toBeVisible();
    expect(screen.getByText('1250.00 MAD')).toBeVisible();
  });

  it('ne monte ni action ni widget sans la permission correspondante', async () => {
    render(
      <DashboardPage onNavigate={vi.fn()} permissions={['dashboard:read']} />,
    );

    await screen.findByText("Taux d'occupation");
    expect(
      screen.queryByRole('button', { name: 'Nouvelle réservation' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Check-in walk-in' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Widget chambres')).not.toBeInTheDocument();
    expect(screen.queryByText('Widget maintenance')).not.toBeInTheDocument();
  });

  it('affiche uniquement les actions et widgets couverts par les permissions', async () => {
    render(
      <DashboardPage
        onNavigate={vi.fn()}
        permissions={[
          'dashboard:read',
          'reservations:write',
          'housekeeping:read',
          'maintenance:read',
        ]}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Nouvelle réservation' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Check-in walk-in' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Signaler une panne')).not.toBeInTheDocument();
    expect(screen.getByText('Widget chambres')).toBeVisible();
    expect(screen.getByText('Widget maintenance')).toBeVisible();
    await screen.findByText("Taux d'occupation");
  });

  it('conserve les widgets et permet de relancer si le résumé échoue', async () => {
    vi.mocked(getDashboardResume)
      .mockRejectedValueOnce(new Error('Service indisponible'))
      .mockResolvedValueOnce(RESUME);
    const user = userEvent.setup();

    render(
      <DashboardPage
        onNavigate={vi.fn()}
        permissions={['dashboard:read', 'maintenance:read']}
      />,
    );

    expect(screen.getByText('Widget maintenance')).toBeVisible();
    expect(
      await screen.findByText('Impossible de charger les indicateurs'),
    ).toBeVisible();
    expect(screen.getByText('Service indisponible')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(getDashboardResume).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Taux d'occupation")).toBeVisible();
    expect(screen.getByText('Widget maintenance')).toBeVisible();
  });
});
