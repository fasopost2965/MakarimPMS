import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api', () => ({
  getCurrent: vi.fn(),
  getHistory: vi.fn(),
  getReport: vi.fn(),
  startNightAudit: vi.fn(),
  revalidate: vi.fn(),
  acknowledgeWarning: vi.fn(),
  posting: vi.fn(),
  reconcile: vi.fn(),
  prepareClosing: vi.fn(),
  closeNightAudit: vi.fn(),
}));

import { NightAuditPage } from './NightAuditPage';
import { getCurrent } from '../api';
import type { NightAuditCurrent } from '../types';

const businessDay: NightAuditCurrent['businessDay'] = {
  id: 1,
  date: '2026-08-15',
  status: 'OPEN',
  openedAt: '2026-08-15T00:00:00.000Z',
  openedByUserId: null,
  closedAt: null,
  closedByUserId: null,
  source: 'SYSTEM_BOOTSTRAP',
};

function makeCurrent(
  overrides: Partial<NightAuditCurrent> = {},
): NightAuditCurrent {
  return {
    businessDay,
    run: null,
    ...overrides,
  };
}

// ARCH-011A — tests frontend minimum (mission) : chargement, affichage de
// phase, séparation blockers/warnings, permissions read-only/run/close,
// masquage du CTA posting si des bloquants restent ouverts.
describe('NightAuditPage (ARCH-011A)', () => {
  it('affiche la Business Date courante au chargement', async () => {
    vi.mocked(getCurrent).mockResolvedValue(makeCurrent());
    render(<NightAuditPage permissions={['night-audit:read']} />);

    await waitFor(() => {
      expect(screen.getByText('2026-08-15')).toBeInTheDocument();
    });
    expect(screen.getByText('OPEN')).toBeInTheDocument();
  });

  it('sépare les bloquants et les avertissements, affiche la phase du run', async () => {
    vi.mocked(getCurrent).mockResolvedValue(
      makeCurrent({
        run: {
          id: 10,
          businessDayId: 1,
          businessDay,
          status: 'EXCEPTIONS',
          startedAt: '2026-08-15T20:00:00.000Z',
          startedByUserId: 1,
          completedAt: null,
          failedAt: null,
          error: null,
          reportVersion: null,
          reportSnapshot: null,
          steps: [],
          exceptions: [
            {
              id: 1,
              runId: 10,
              code: 'ARRIVALS_UNRESOLVED',
              severity: 'BLOCKER',
              entityType: 'Reservation',
              entityId: 5,
              status: 'OPEN',
              message: 'Réservation #5 attendue aujourd’hui.',
              detectedAt: '2026-08-15T20:00:00.000Z',
              resolvedAt: null,
              acknowledgedAt: null,
              acknowledgedByUserId: null,
              acknowledgementReason: null,
            },
            {
              id: 2,
              runId: 10,
              code: 'POLICE_RECORD_MISSING',
              severity: 'WARNING',
              entityType: 'Stay',
              entityId: 7,
              status: 'OPEN',
              message: 'Fiche de police manquante pour le séjour #7.',
              detectedAt: '2026-08-15T20:00:00.000Z',
              resolvedAt: null,
              acknowledgedAt: null,
              acknowledgedByUserId: null,
              acknowledgementReason: null,
            },
          ],
        },
      }),
    );
    render(
      <NightAuditPage permissions={['night-audit:read', 'night-audit:run']} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Bloquants (1)')).toBeInTheDocument();
    });
    expect(screen.getByText('Avertissements (1)')).toBeInTheDocument();
    expect(
      screen.getByText('Réservation #5 attendue aujourd’hui.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Fiche de police manquante pour le séjour #7.'),
    ).toBeInTheDocument();
  });

  it('Réception (read-only) ne voit aucun bouton de mutation', async () => {
    vi.mocked(getCurrent).mockResolvedValue(makeCurrent());
    render(<NightAuditPage permissions={['night-audit:read']} />);

    await waitFor(() => {
      expect(
        screen.getByText('Aucun Night Audit en cours'),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /Démarrer le Night Audit/i }),
    ).not.toBeInTheDocument();
  });

  it("l'Administrateur (night-audit:run) voit le bouton de démarrage", async () => {
    vi.mocked(getCurrent).mockResolvedValue(makeCurrent());
    render(
      <NightAuditPage permissions={['night-audit:read', 'night-audit:run']} />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Démarrer le Night Audit/i }),
      ).toBeInTheDocument();
    });
  });

  it('un BLOCKER ouvert ne propose jamais de bouton "Acquitter"', async () => {
    vi.mocked(getCurrent).mockResolvedValue(
      makeCurrent({
        run: {
          id: 10,
          businessDayId: 1,
          businessDay,
          status: 'EXCEPTIONS',
          startedAt: '2026-08-15T20:00:00.000Z',
          startedByUserId: 1,
          completedAt: null,
          failedAt: null,
          error: null,
          reportVersion: null,
          reportSnapshot: null,
          steps: [],
          exceptions: [
            {
              id: 1,
              runId: 10,
              code: 'ARRIVALS_UNRESOLVED',
              severity: 'BLOCKER',
              entityType: 'Reservation',
              entityId: 5,
              status: 'OPEN',
              message: 'Réservation #5 attendue aujourd’hui.',
              detectedAt: '2026-08-15T20:00:00.000Z',
              resolvedAt: null,
              acknowledgedAt: null,
              acknowledgedByUserId: null,
              acknowledgementReason: null,
            },
          ],
        },
      }),
    );
    render(
      <NightAuditPage permissions={['night-audit:read', 'night-audit:run']} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Bloquants (1)')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /Acquitter/i }),
    ).not.toBeInTheDocument();
  });

  it('le CTA Posting reste désactivé tant que des bloquants sont ouverts', async () => {
    vi.mocked(getCurrent).mockResolvedValue(
      makeCurrent({
        run: {
          id: 10,
          businessDayId: 1,
          businessDay,
          status: 'EXCEPTIONS',
          startedAt: '2026-08-15T20:00:00.000Z',
          startedByUserId: 1,
          completedAt: null,
          failedAt: null,
          error: null,
          reportVersion: null,
          reportSnapshot: null,
          steps: [],
          exceptions: [
            {
              id: 1,
              runId: 10,
              code: 'ARRIVALS_UNRESOLVED',
              severity: 'BLOCKER',
              entityType: 'Reservation',
              entityId: 5,
              status: 'OPEN',
              message: 'Réservation #5 attendue aujourd’hui.',
              detectedAt: '2026-08-15T20:00:00.000Z',
              resolvedAt: null,
              acknowledgedAt: null,
              acknowledgedByUserId: null,
              acknowledgementReason: null,
            },
          ],
        },
      }),
    );
    render(
      <NightAuditPage permissions={['night-audit:read', 'night-audit:run']} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Posting' })).toBeDisabled();
    });
  });

  it('le bouton Clôturer n’apparaît que pour night-audit:close, en phase CLOSING', async () => {
    vi.mocked(getCurrent).mockResolvedValue(
      makeCurrent({
        run: {
          id: 10,
          businessDayId: 1,
          businessDay,
          status: 'CLOSING',
          startedAt: '2026-08-15T20:00:00.000Z',
          startedByUserId: 1,
          completedAt: null,
          failedAt: null,
          error: null,
          reportVersion: 1,
          reportSnapshot: {
            businessDate: '2026-08-15',
            exploitation: {
              arrivalsExpected: 0,
              checkins: 0,
              noShows: 0,
              departuresExpected: 0,
              checkouts: 0,
              activeStays: 0,
            },
            chambres: {
              occupied: 0,
              availableClean: 24,
              dirty: 0,
              maintenance: 0,
            },
            conformite: {
              policeComplete: 0,
              policeMissing: 0,
              warningsAcknowledged: 0,
              blockersOpen: 0,
            },
            finance: {
              folioCharges: '0.00',
              payments: '0.00',
              invoicesIssued: 0,
              creditNotes: 0,
              taxes: '0.00',
              restaurantCharges: '0.00',
            },
          },
          steps: [],
          exceptions: [],
        },
      }),
    );

    const { rerender } = render(
      <NightAuditPage permissions={['night-audit:read', 'night-audit:run']} />,
    );
    await waitFor(() => {
      expect(screen.getByText('Prêt pour clôture')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: 'Clôturer' }),
    ).not.toBeInTheDocument();

    rerender(
      <NightAuditPage
        permissions={[
          'night-audit:read',
          'night-audit:run',
          'night-audit:close',
        ]}
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Clôturer' }),
      ).toBeInTheDocument();
    });
  });

  it('ouvre le formulaire de clôture avec validation du motif ≥ 10 caractères', async () => {
    vi.mocked(getCurrent).mockResolvedValue(
      makeCurrent({
        run: {
          id: 10,
          businessDayId: 1,
          businessDay,
          status: 'CLOSING',
          startedAt: '2026-08-15T20:00:00.000Z',
          startedByUserId: 1,
          completedAt: null,
          failedAt: null,
          error: null,
          reportVersion: 1,
          reportSnapshot: {
            businessDate: '2026-08-15',
            exploitation: {
              arrivalsExpected: 0,
              checkins: 0,
              noShows: 0,
              departuresExpected: 0,
              checkouts: 0,
              activeStays: 0,
            },
            chambres: {
              occupied: 0,
              availableClean: 24,
              dirty: 0,
              maintenance: 0,
            },
            conformite: {
              policeComplete: 0,
              policeMissing: 0,
              warningsAcknowledged: 0,
              blockersOpen: 0,
            },
            finance: {
              folioCharges: '0.00',
              payments: '0.00',
              invoicesIssued: 0,
              creditNotes: 0,
              taxes: '0.00',
              restaurantCharges: '0.00',
            },
          },
          steps: [],
          exceptions: [],
        },
      }),
    );
    const user = userEvent.setup();
    render(
      <NightAuditPage
        permissions={[
          'night-audit:read',
          'night-audit:run',
          'night-audit:close',
        ]}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Clôturer' }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Clôturer' }));

    const submit = await screen.findByRole('button', { name: /Clôturer$/ });
    expect(submit).toBeDisabled();
  });
});
