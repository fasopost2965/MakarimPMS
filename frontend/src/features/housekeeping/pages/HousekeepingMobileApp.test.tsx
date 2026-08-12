import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HousekeepingTask, PaginatedResponse } from '../types';

vi.mock('../mobile-api', () => ({
  mobileLogin: vi.fn(),
  listMyTasks: vi.fn(),
  listInspectionQueue: vi.fn(),
  startTask: vi.fn(),
  completeTask: vi.fn(),
  validateTask: vi.fn(),
  refuseTask: vi.fn(),
  reportIncident: vi.fn(),
}));

import { HousekeepingMobileApp } from './HousekeepingMobileApp';
import {
  mobileLogin,
  listMyTasks,
  listInspectionQueue,
  startTask,
  completeTask,
  validateTask,
  refuseTask,
  reportIncident,
} from '../mobile-api';

function forbidden(): Error & { status?: number } {
  const err = new Error('Interdit') as Error & { status?: number };
  err.status = 403;
  return err;
}

function task(overrides: Partial<HousekeepingTask> = {}): HousekeepingTask {
  return {
    id: 1,
    roomId: 10,
    assignedUserId: 2,
    statut: 'AFFECTEE',
    origine: 'CHECKOUT',
    sourceEventKey: 'checkout:1',
    activeRoomKey: '10',
    assignedAt: '2026-08-12T08:00:00.000Z',
    startedAt: null,
    completedAt: null,
    validatedAt: null,
    cancelledAt: null,
    createdAt: '2026-08-12T08:00:00.000Z',
    updatedAt: '2026-08-12T08:00:00.000Z',
    room: {
      id: 10,
      numero: '204',
      etage: 2,
      statut: 'A_NETTOYER',
      roomTypeId: 1,
    },
    assignedUser: { id: 2, nom: 'Reception Test', actif: true },
    ...overrides,
  };
}

function tasksResponse(
  items: HousekeepingTask[],
): PaginatedResponse<HousekeepingTask> {
  return {
    data: items,
    meta: { page: 1, limit: 100, total: items.length, totalPages: 1 },
  };
}

async function loginAsAgent() {
  vi.mocked(listInspectionQueue).mockRejectedValue(forbidden());
  vi.mocked(mobileLogin).mockResolvedValue({ accessToken: 'agent-token' });
  const user = userEvent.setup();
  render(<HousekeepingMobileApp />);
  await user.type(screen.getByLabelText('Email'), 'reception@makarim.test');
  await user.type(screen.getByLabelText('Mot de passe'), 'Password123!');
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
  await waitFor(() => expect(listMyTasks).toHaveBeenCalled());
  return user;
}

async function loginAsGouvernante(inspectionTasks: HousekeepingTask[] = []) {
  vi.mocked(listInspectionQueue).mockResolvedValue(
    tasksResponse(inspectionTasks),
  );
  vi.mocked(mobileLogin).mockResolvedValue({ accessToken: 'gouv-token' });
  const user = userEvent.setup();
  render(<HousekeepingMobileApp />);
  await user.type(screen.getByLabelText('Email'), 'gouvernante@makarim.test');
  await user.type(screen.getByLabelText('Mot de passe'), 'Password123!');
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
  await waitFor(() => expect(listMyTasks).toHaveBeenCalled());
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('HousekeepingMobileApp — login', () => {
  it("affiche l'écran de connexion tant qu'aucun jeton n'est présent", () => {
    render(<HousekeepingMobileApp />);
    expect(screen.getByText('Housekeeping mobile')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('affiche un message en cas d’échec de connexion', async () => {
    vi.mocked(mobileLogin).mockRejectedValue(
      new Error('Identifiants invalides.'),
    );
    const user = userEvent.setup();
    render(<HousekeepingMobileApp />);
    await user.type(screen.getByLabelText('Email'), 'x@x.test');
    await user.type(screen.getByLabelText('Mot de passe'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(
      await screen.findByText('Identifiants invalides.'),
    ).toBeInTheDocument();
  });
});

describe('HousekeepingMobileApp — liste des tâches (agent)', () => {
  it('liste les tâches assignées avec chambre/étage/statut', async () => {
    vi.mocked(listMyTasks).mockResolvedValue(
      tasksResponse([task({ statut: 'AFFECTEE' })]),
    );
    vi.mocked(listInspectionQueue).mockRejectedValue(forbidden());
    await loginAsAgent();
    expect(await screen.findByText(/Chambre 204/)).toBeInTheDocument();
    expect(screen.getByText(/Étage 2/)).toBeInTheDocument();
    expect(screen.getByText('À démarrer')).toBeInTheDocument();
  });

  it('affiche un indicateur de bloqueur si la chambre est EN_MAINTENANCE', async () => {
    vi.mocked(listMyTasks).mockResolvedValue(
      tasksResponse([
        task({
          room: {
            id: 10,
            numero: '204',
            etage: 2,
            statut: 'EN_MAINTENANCE',
            roomTypeId: 1,
          },
        }),
      ]),
    );
    vi.mocked(listInspectionQueue).mockRejectedValue(forbidden());
    await loginAsAgent();
    expect(await screen.findByText(/Chambre bloquée/)).toBeInTheDocument();
  });

  it('affiche une erreur réseau avec un bouton Réessayer', async () => {
    vi.mocked(listMyTasks).mockRejectedValue(new Error('Erreur réseau'));
    vi.mocked(listInspectionQueue).mockRejectedValue(forbidden());
    await loginAsAgent();
    expect(await screen.findByText('Erreur réseau')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Réessayer' }),
    ).toBeInTheDocument();
  });

  it('déconnecte automatiquement sur une erreur 401', async () => {
    const err = new Error('Non autorisé') as Error & { status?: number };
    err.status = 401;
    vi.mocked(listMyTasks).mockRejectedValue(err);
    vi.mocked(listInspectionQueue).mockRejectedValue(forbidden());
    await loginAsAgent();
    await waitFor(() =>
      expect(screen.getByText('Housekeeping mobile')).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});

describe('HousekeepingMobileApp — parcours agent', () => {
  it('démarre une tâche AFFECTEE puis rafraîchit la liste', async () => {
    vi.mocked(listMyTasks).mockResolvedValue(
      tasksResponse([task({ statut: 'AFFECTEE' })]),
    );
    vi.mocked(startTask).mockResolvedValue(task({ statut: 'EN_COURS' }));
    const user = await loginAsAgent();

    await user.click(await screen.findByText(/Chambre 204/));
    await user.click(await screen.findByRole('button', { name: 'Démarrer' }));

    await waitFor(() =>
      expect(startTask).toHaveBeenCalledWith('agent-token', 1),
    );
    await waitFor(() => expect(listMyTasks).toHaveBeenCalledTimes(2));
  });

  it('termine une tâche EN_COURS', async () => {
    vi.mocked(listMyTasks).mockResolvedValue(
      tasksResponse([task({ statut: 'EN_COURS' })]),
    );
    vi.mocked(completeTask).mockResolvedValue(task({ statut: 'TERMINEE' }));
    const user = await loginAsAgent();

    await user.click(await screen.findByText(/Chambre 204/));
    await user.click(await screen.findByRole('button', { name: 'Terminer' }));

    await waitFor(() =>
      expect(completeTask).toHaveBeenCalledWith('agent-token', 1),
    );
  });

  it("affiche 'en attente de contrôle' en lecture seule pour un agent sans housekeeping:control", async () => {
    vi.mocked(listMyTasks).mockResolvedValue(
      tasksResponse([task({ statut: 'TERMINEE' })]),
    );
    const user = await loginAsAgent();

    await user.click(await screen.findByText(/Chambre 204/));
    expect(
      await screen.findByText('En attente de contrôle par la Gouvernante.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Valider' }),
    ).not.toBeInTheDocument();
  });
});

describe('HousekeepingMobileApp — parcours Gouvernante (contrôle)', () => {
  it('valide une tâche TERMINEE avec un motif suffisant', async () => {
    vi.mocked(listMyTasks).mockResolvedValue(
      tasksResponse([task({ statut: 'TERMINEE' })]),
    );
    vi.mocked(validateTask).mockResolvedValue(task({ statut: 'VALIDEE' }));
    const user = await loginAsGouvernante();

    await user.click(await screen.findByText(/Chambre 204/));
    await user.click(await screen.findByRole('button', { name: 'Valider' }));

    const submit = screen.getByRole('button', {
      name: 'Confirmer la validation',
    });
    expect(submit).toBeDisabled();

    await user.type(
      screen.getByLabelText(/Motif/),
      'Contrôle effectué, chambre conforme',
    );
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() =>
      expect(validateTask).toHaveBeenCalledWith(
        'gouv-token',
        1,
        'Contrôle effectué, chambre conforme',
      ),
    );
  });

  it('refuse une tâche TERMINEE avec un motif', async () => {
    vi.mocked(listMyTasks).mockResolvedValue(
      tasksResponse([task({ statut: 'TERMINEE' })]),
    );
    vi.mocked(refuseTask).mockResolvedValue(task({ statut: 'EN_COURS' }));
    const user = await loginAsGouvernante();

    await user.click(await screen.findByText(/Chambre 204/));
    await user.click(await screen.findByRole('button', { name: 'Refuser' }));
    await user.type(
      screen.getByLabelText(/Motif/),
      'Salle de bain pas nettoyée',
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirmer le refus' }),
    );

    await waitFor(() =>
      expect(refuseTask).toHaveBeenCalledWith(
        'gouv-token',
        1,
        'Salle de bain pas nettoyée',
      ),
    );
  });

  it('affiche le message serveur en cas d’auto-validation refusée (403)', async () => {
    vi.mocked(listMyTasks).mockResolvedValue(
      tasksResponse([task({ statut: 'TERMINEE' })]),
    );
    vi.mocked(validateTask).mockRejectedValue(
      new Error(
        "Auto-validation interdite : le contrôleur ne peut pas être l'agent affecté.",
      ),
    );
    const user = await loginAsGouvernante();

    await user.click(await screen.findByText(/Chambre 204/));
    await user.click(await screen.findByRole('button', { name: 'Valider' }));
    await user.type(screen.getByLabelText(/Motif/), 'Contrôle Gouvernante');
    await user.click(
      screen.getByRole('button', { name: 'Confirmer la validation' }),
    );

    expect(
      await screen.findByText(/Auto-validation interdite/),
    ).toBeInTheDocument();
  });
});

describe('HousekeepingMobileApp — signalement incident', () => {
  it('signale un incident et affiche la confirmation, sans jamais patcher Room.statut', async () => {
    vi.mocked(listMyTasks).mockResolvedValue(
      tasksResponse([task({ statut: 'AFFECTEE' })]),
    );
    vi.mocked(reportIncident).mockResolvedValue({
      id: 1,
      roomId: 10,
      bloqueVente: true,
      resoluAt: null,
    });
    const user = await loginAsAgent();

    await user.click(await screen.findByText(/Chambre 204/));
    await user.click(
      await screen.findByRole('button', { name: 'Signaler un incident' }),
    );
    await user.type(
      screen.getByLabelText('Description du problème'),
      'Robinet cassé',
    );
    await user.click(screen.getByRole('button', { name: 'Haute' }));
    await user.click(
      screen.getByRole('button', { name: 'Envoyer le signalement' }),
    );

    await waitFor(() =>
      expect(reportIncident).toHaveBeenCalledWith('agent-token', {
        roomId: 10,
        typePanne: 'Robinet cassé',
        priorite: 'HAUTE',
      }),
    );
    expect(
      await screen.findByText('Incident signalé à la maintenance.'),
    ).toBeInTheDocument();
  });
});

describe('HousekeepingMobileApp — file d’inspection (Supervisor Inspection Queue Fix)', () => {
  it("n'affiche jamais l'onglet « À inspecter » pour un agent standard (sondage 403)", async () => {
    vi.mocked(listMyTasks).mockResolvedValue(
      tasksResponse([task({ statut: 'AFFECTEE' })]),
    );
    await loginAsAgent();

    await screen.findByText(/Chambre 204/);
    expect(
      screen.queryByRole('button', { name: /À inspecter/ }),
    ).not.toBeInTheDocument();
  });

  it("affiche l'onglet « À inspecter » pour la Gouvernante seulement une fois le sondage autorisé (200)", async () => {
    vi.mocked(listMyTasks).mockResolvedValue(tasksResponse([]));
    const user = await loginAsGouvernante([
      task({
        id: 42,
        statut: 'TERMINEE',
        assignedUserId: 99,
        assignedUser: { id: 99, nom: 'Autre agent', actif: true },
      }),
    ]);

    const tab = await screen.findByRole('button', { name: /À inspecter/ });
    expect(tab).toBeInTheDocument();
    expect(screen.queryByText(/Chambre 204/)).not.toBeInTheDocument();

    await user.click(tab);
    expect(await screen.findByText(/Chambre 204/)).toBeInTheDocument();
  });

  it("permet à la Gouvernante de valider depuis l'onglet « À inspecter » une tâche assignée à un autre agent", async () => {
    vi.mocked(listMyTasks).mockResolvedValue(tasksResponse([]));
    vi.mocked(validateTask).mockResolvedValue(task({ statut: 'VALIDEE' }));
    const user = await loginAsGouvernante([
      task({
        statut: 'TERMINEE',
        assignedUserId: 99,
        assignedUser: { id: 99, nom: 'Autre agent', actif: true },
      }),
    ]);

    await user.click(
      await screen.findByRole('button', { name: /À inspecter/ }),
    );
    await user.click(await screen.findByText(/Chambre 204/));
    await user.click(await screen.findByRole('button', { name: 'Valider' }));
    await user.type(
      screen.getByLabelText(/Motif/),
      'Contrôle effectué depuis la file À inspecter',
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirmer la validation' }),
    );

    await waitFor(() =>
      expect(validateTask).toHaveBeenCalledWith(
        'gouv-token',
        1,
        'Contrôle effectué depuis la file À inspecter',
      ),
    );
  });

  it('« Mes tâches » reste strictement personnel — aucune tâche de la file de contrôle ne s’y mélange', async () => {
    vi.mocked(listMyTasks).mockResolvedValue(
      tasksResponse([
        task({
          id: 1,
          room: {
            id: 10,
            numero: '101',
            etage: 1,
            statut: 'A_NETTOYER',
            roomTypeId: 1,
          },
        }),
      ]),
    );
    const user = await loginAsGouvernante([
      task({
        id: 2,
        statut: 'TERMINEE',
        room: {
          id: 20,
          numero: '202',
          etage: 2,
          statut: 'A_NETTOYER',
          roomTypeId: 1,
        },
        assignedUserId: 99,
      }),
    ]);

    await screen.findByText(/Chambre 101/);
    expect(screen.queryByText(/Chambre 202/)).not.toBeInTheDocument();

    await user.click(
      await screen.findByRole('button', { name: /À inspecter/ }),
    );
    await screen.findByText(/Chambre 202/);
    expect(screen.queryByText(/Chambre 101/)).not.toBeInTheDocument();
  });
});
