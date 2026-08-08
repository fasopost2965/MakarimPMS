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

// DESIGN-002 — Dashboard « Modern Operations ». Ces tests couvrent les
// ajouts du lot : zone supérieure, zone « À traiter aujourd'hui », état de
// chargement par squelettes, et le garde-fou de lecture sur les deux
// définitions distinctes du taux d'occupation (brut côté /dashboard/resume,
// net côté /reporting/yield-forecast).
describe('DashboardPage — DESIGN-002', () => {
  beforeEach(() => {
    vi.mocked(getDashboardResume).mockReset();
    vi.mocked(getDashboardResume).mockResolvedValue(RESUME);
  });

  it('affiche une zone supérieure titrée « Dashboard / Vue opérationnelle »', async () => {
    render(
      <DashboardPage onNavigate={vi.fn()} permissions={['dashboard:read']} />,
    );
    expect(
      screen.getByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeVisible();
    expect(screen.getByText('Vue opérationnelle')).toBeVisible();
    await screen.findByText("Taux d'occupation");
  });

  it('affiche des squelettes pendant le chargement, jamais un « Chargement… » brut', () => {
    vi.mocked(getDashboardResume).mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <DashboardPage onNavigate={vi.fn()} permissions={['dashboard:read']} />,
    );

    expect(
      container.querySelectorAll('[data-slot="kpi-card-skeleton"]').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/Chargement…/)).not.toBeInTheDocument();
  });

  it("qualifie explicitement le taux d'occupation du jour (dénominateur = toutes les chambres)", async () => {
    render(
      <DashboardPage onNavigate={vi.fn()} permissions={['dashboard:read']} />,
    );
    // Garde-fou de lecture : ce KPI n'a PAS la même définition que le taux
    // net de /reporting/yield-forecast (qui exclut les chambres en
    // maintenance). Le libellé doit rester distinctif.
    expect(
      await screen.findByText('Sur les 20 chambres, maintenance incluse'),
    ).toBeVisible();
  });

  it('affiche la charge du jour dans « À traiter aujourd’hui » avec des libellés distincts des KPI', async () => {
    render(
      <DashboardPage
        onNavigate={vi.fn()}
        permissions={['dashboard:read', 'checkin:read']}
      />,
    );

    expect(await screen.findByText("À traiter aujourd'hui")).toBeVisible();
    expect(screen.getByText('Arrivées à enregistrer')).toBeVisible();
    expect(screen.getByText('Départs à traiter')).toBeVisible();
    expect(screen.getByText('Ménage en attente')).toBeVisible();
    // Libellés volontairement différents des KPI, pour que chaque texte
    // reste non ambigu à l'écran comme pour un lecteur d'écran.
    expect(screen.getByText("Arrivées aujourd'hui")).toBeVisible();
  });

  it('énonce en toutes lettres l’absence de tâche plutôt qu’un simple 0 coloré', async () => {
    vi.mocked(getDashboardResume).mockResolvedValue({
      ...RESUME,
      arriveesAujourdhui: 0,
      departsAujourdhui: 0,
      chambresANettoyer: 0,
    });
    render(
      <DashboardPage onNavigate={vi.fn()} permissions={['dashboard:read']} />,
    );

    expect(await screen.findByText('Aucune arrivée attendue')).toBeVisible();
    expect(screen.getByText('Aucun départ prévu')).toBeVisible();
    expect(screen.getByText('Toutes les chambres sont traitées')).toBeVisible();
  });

  it('affiche le montant encaissé en font-mono tabular-nums, sans reformatage', async () => {
    render(
      <DashboardPage onNavigate={vi.fn()} permissions={['dashboard:read']} />,
    );
    const montant = await screen.findByText('1250.00 MAD');
    expect(montant.className).toContain('font-mono');
    expect(montant.className).toContain('tabular-nums');
  });

  it('ne charge la prévision d’occupation que si reporting:read est accordée', async () => {
    render(
      <DashboardPage onNavigate={vi.fn()} permissions={['dashboard:read']} />,
    );
    await screen.findByText("Taux d'occupation");
    expect(
      screen.queryByText(/Prévision d'occupation/),
    ).not.toBeInTheDocument();
  });

  it('permet de rafraîchir les indicateurs à la demande', async () => {
    const user = userEvent.setup();
    render(
      <DashboardPage onNavigate={vi.fn()} permissions={['dashboard:read']} />,
    );
    await screen.findByText("Taux d'occupation");

    await user.click(
      screen.getByRole('button', { name: 'Actualiser les indicateurs' }),
    );
    await waitFor(() => expect(getDashboardResume).toHaveBeenCalledTimes(2));
  });
});
