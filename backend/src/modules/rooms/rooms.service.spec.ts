import { ConflictException } from '@nestjs/common';
import { StatutChambre } from '@prisma/client';
import { RoomsService } from './rooms.service';

describe('RoomsService.transitionRoom', () => {
  it('retourne 409 et n’écrit aucun log si l’écriture conditionnelle ne modifie aucune ligne', async () => {
    const room = {
      id: 7,
      numero: '107',
      roomTypeId: 1,
      statut: StatutChambre.LIBRE_PROPRE,
      etage: null,
      deletedAt: null,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([room]),
      room: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          ...room,
          statut: StatutChambre.A_NETTOYER,
          roomType: {},
        }),
      },
      roomStatusLog: { create: jest.fn() },
    };
    const service = new RoomsService({} as never, {} as never);

    const result = service.transitionRoom(room.id, StatutChambre.A_NETTOYER, {
      expectedFrom: StatutChambre.LIBRE_PROPRE,
      tx: tx as never,
    });

    await expect(result).rejects.toMatchObject({ status: 409 });
    await expect(result).rejects.toBeInstanceOf(ConflictException);
    expect(tx.room.findUnique).not.toHaveBeenCalled();
    expect(tx.roomStatusLog.create).not.toHaveBeenCalled();
  });
});
