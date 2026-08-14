import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api', () => ({ getDashboardResume: vi.fn() }));
vi.mock('../../reservations/api', () => ({
  listRooms: vi.fn(),
  arrivalsToday: vi.fn(),
}));
vi.mock('../../maintenance/api', () => ({ listTickets: vi.fn() }));
vi.mock('../../checkin/api', () => ({ listDepartsDuJour: vi.fn() }));

import { getDashboardResume } from '../api';
import { listRooms, arrivalsToday } from '../../reservations/api';
import { listTickets } from '../../maintenance/api';
import { listDepartsDuJour } from '../../checkin/api';
import { DashboardPage } from './DashboardPage';
import type { Room } from '../../reservations/types';
import type { MaintenanceTicket } from '../../maintenance/types';

const RESUME = {
  tauxOccupation: 75,
  chambresOccupees: 15,
  totalChambres: 20,
  arriveesAujourdhui: 4,
  departsAujourdhui: 3,
  chambresANettoyer: 2,
  encaisseAujourdhui: '1250.00',
};

function room(overrides: Partial<Room> = {}): Room {
  return {
    id: 1,
    numero: '101',
    roomTypeId: 1,
    etage: 1,
    statut: 'LIBRE_PROPRE',
    roomType: {
      id: 1,
      nom: 'Single',
      capacite: 1,
      prixBase: '0',
    },
    ...overrides,
  };
}

function ticket(overrides: Partial<MaintenanceTicket> = {}): MaintenanceTicket {
  return {
    id: 1,
    roomId: 1,
    room: room(),
    typePanne: 'Climatisation en panne',
    priorite: 'URGENTE',
    photoUrl: null,
    assigneA: null,
    bloqueVente: true,
    resoluAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getDashboardResume).mockReset().mockResolvedValue(RESUME);
  vi.mocked(listRooms).mockReset().mockResolvedValue([]);
  vi.mocked(arrivalsToday).mockReset().mockResolvedValue([]);
  vi.mocked(listTickets).mockReset().mockResolvedValue([]);
  vi.mocked(listDepartsDuJour).mockReset().mockResolvedValue([]);
});

describe('DashboardPage — personnalisation par permissions', () => {
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
    expect(screen.getByText('Chambres actuellement occupées')).toBeVisible();
    expect(screen.getByText('En attente de nettoyage')).toBeVisible();
    expect(screen.queryByText(/Statut OCCUPEE/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Statut A_NETTOYER/)).not.toBeInTheDocument();
  });

  it("ne monte aucun module d'Accès rapides sans la permission correspondante", async () => {
    render(
      <DashboardPage onNavigate={vi.fn()} permissions={['dashboard:read']} />,
    );

    await screen.findByText("Taux d'occupation");
    expect(
      screen.queryByRole('button', { name: /Réservations/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Séjours \/ Check-in/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Accès rapides')).not.toBeInTheDocument();
  });

  it('affiche uniquement les modules Accès rapides couverts par les permissions', async () => {
    render(
      <DashboardPage
        onNavigate={vi.fn()}
        permissions={['dashboard:read', 'reservations:read']}
      />,
    );

    expect(
      await screen.findByRole('button', { name: /Réservations/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Séjours \/ Check-in/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Maintenance/ }),
    ).not.toBeInTheDocument();
  });

  // DESIGN-010 — la tuile "Facturation" ouvre désormais le vrai module
  // Billing Center (`billing`, permission `billing:read`) au lieu de
  // `checkin`. Réception (billing:read absent aujourd'hui, RBAC gelé) ne
  // doit plus voir cette tuile.
  it('affiche la tuile Facturation seulement avec billing:read, et navigue vers l’onglet billing', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <DashboardPage
        onNavigate={onNavigate}
        permissions={['dashboard:read', 'billing:read']}
      />,
    );

    const tile = await screen.findByRole('button', { name: /Facturation/ });
    await user.click(tile);
    expect(onNavigate).toHaveBeenCalledWith('billing');
  });

  it('masque la tuile Facturation sans billing:read (ex. Réception, checkin:read seul)', async () => {
    render(
      <DashboardPage
        onNavigate={vi.fn()}
        permissions={['dashboard:read', 'checkin:read']}
      />,
    );

    await screen.findByText("Taux d'occupation");
    expect(
      screen.queryByRole('button', { name: /Facturation/ }),
    ).not.toBeInTheDocument();
  });

  it('navigue vers le bon onglet au clic sur une tuile Accès rapides', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <DashboardPage
        onNavigate={onNavigate}
        permissions={['dashboard:read', 'reservations:read']}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: /Réservations/ }),
    );
    expect(onNavigate).toHaveBeenCalledWith('reservations');
  });

  it("conserve l'affichage même si le résumé échoue, et permet de relancer", async () => {
    vi.mocked(getDashboardResume)
      .mockRejectedValueOnce(new Error('Service indisponible'))
      .mockResolvedValueOnce(RESUME);
    vi.mocked(listTickets).mockResolvedValue([ticket()]);
    const user = userEvent.setup();

    render(
      <DashboardPage
        onNavigate={vi.fn()}
        permissions={['dashboard:read', 'maintenance:read']}
      />,
    );

    expect(
      await screen.findByText('Impossible de charger les indicateurs'),
    ).toBeVisible();
    expect(screen.getByText('Service indisponible')).toBeVisible();
    // La zone "À traiter" (maintenance) reste indépendante de l'échec du
    // résumé — même principe que les anciens widgets qu'elle remplace.
    expect(await screen.findByText(/Climatisation en panne/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(getDashboardResume).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Taux d'occupation")).toBeVisible();
  });
});

// DESIGN-005 — intégration du Prototype D3 validé : header compact, Accès
// rapides, grille opérationnelle Chambres / À traiter / Aujourd'hui.
describe('DashboardPage — DESIGN-005 (intégration D3)', () => {
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
    expect(
      await screen.findByText('Sur les 20 chambres, maintenance incluse'),
    ).toBeVisible();
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
      screen.queryByText(/Occupation — 7 prochains jours/),
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

  it('affiche un badge d’alerte urgente quand un ticket de maintenance urgent existe', async () => {
    vi.mocked(listTickets).mockResolvedValue([ticket({ priorite: 'URGENTE' })]);
    render(
      <DashboardPage
        onNavigate={vi.fn()}
        permissions={['dashboard:read', 'maintenance:read']}
      />,
    );
    expect(await screen.findByText('1 urgent')).toBeVisible();
  });

  it("n'affiche aucun badge d'alerte sans ticket urgent", async () => {
    vi.mocked(listTickets).mockResolvedValue([]);
    render(
      <DashboardPage
        onNavigate={vi.fn()}
        permissions={['dashboard:read', 'maintenance:read']}
      />,
    );
    await screen.findByText("Taux d'occupation");
    expect(screen.queryByText(/urgent/)).not.toBeInTheDocument();
  });

  it('affiche la grille État des chambres avec les chambres réelles (housekeeping:read)', async () => {
    vi.mocked(listRooms).mockResolvedValue([
      room({ id: 1, numero: '204', statut: 'A_NETTOYER' }),
    ]);
    render(
      <DashboardPage
        onNavigate={vi.fn()}
        permissions={['dashboard:read', 'housekeeping:read']}
      />,
    );
    expect(await screen.findByText('État des chambres')).toBeVisible();
    expect(screen.getAllByText('204').length).toBeGreaterThan(0);
  });

  it("n'affiche pas la grille de chambres sans housekeeping:read", async () => {
    render(
      <DashboardPage onNavigate={vi.fn()} permissions={['dashboard:read']} />,
    );
    await screen.findByText("Taux d'occupation");
    expect(screen.queryByText('État des chambres')).not.toBeInTheDocument();
  });

  it('énonce en toutes lettres l’absence de ménage ou d’intervention plutôt qu’un simple 0', async () => {
    vi.mocked(listRooms).mockResolvedValue([]);
    vi.mocked(listTickets).mockResolvedValue([]);
    render(
      <DashboardPage
        onNavigate={vi.fn()}
        permissions={[
          'dashboard:read',
          'housekeeping:read',
          'maintenance:read',
        ]}
      />,
    );
    expect(
      await screen.findByText('Toutes les chambres sont traitées.'),
    ).toBeVisible();
    expect(screen.getByText('Aucune intervention ouverte.')).toBeVisible();
  });

  it('affiche les arrivées/départs nominatifs du jour (checkin:read)', async () => {
    vi.mocked(arrivalsToday).mockResolvedValue([
      {
        id: 1,
        canal: 'DIRECT',
        guestId: 1,
        guest: { id: 1, nom: 'Amrani', prenom: 'Karim' },
        roomId: 1,
        room: room({ numero: '208' }),
        dateArrivee: new Date().toISOString(),
        dateDepart: new Date().toISOString(),
        statut: 'CONFIRMEE',
        sourceBrute: null,
        prixTotalCalcule: '0',
        prixTotalFinal: '0',
        ajustementManuel: false,
        motifAjustement: null,
        nombreOccupants: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as never);
    render(
      <DashboardPage
        onNavigate={vi.fn()}
        permissions={['dashboard:read', 'checkin:read']}
      />,
    );
    expect(await screen.findByText("Aujourd'hui")).toBeVisible();
    expect(screen.getByText('Karim Amrani')).toBeVisible();
    expect(screen.getByText('Ch. 208')).toBeVisible();
  });
});
