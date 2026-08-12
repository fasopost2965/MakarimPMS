import { StatutChambre } from '@prisma/client';
import { HousekeepingTaskService } from './housekeeping-task.service';

describe('HousekeepingTaskService.reconcileDirtyRooms — relecture verrouillée', () => {
  it('ne crée pas de tâche si la chambre a été nettoyée depuis le snapshot', async () => {
    const tx = {
      room: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 9, statut: StatutChambre.A_NETTOYER }]),
      },
      housekeepingTask: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      housekeepingTaskLog: { create: jest.fn() },
    };
    const prisma = {
      room: tx.room,
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const roomsService = {
      lockRoomForUpdate: jest.fn().mockResolvedValue({
        id: 9,
        statut: StatutChambre.LIBRE_PROPRE,
      }),
    };
    const service = new HousekeepingTaskService(
      prisma as never,
      {} as never,
      roomsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.reconcileDirtyRooms(1)).resolves.toEqual({
      created: 0,
      skipped: 1,
    });
    expect(tx.housekeepingTask.findUnique).not.toHaveBeenCalled();
    expect(tx.housekeepingTask.create).not.toHaveBeenCalled();
  });
});
