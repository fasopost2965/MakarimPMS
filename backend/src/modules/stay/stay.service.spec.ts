import { ConflictException } from '@nestjs/common';
import { StatutReservation } from '@prisma/client';
import { StayService } from './stay.service';

describe('StayService.checkinFromReservation', () => {
  it('refuse un client blacklisté avant toute écriture métier', async () => {
    const reservation = {
      id: 42,
      guestId: 7,
      statut: StatutReservation.CONFIRMEE,
    };
    const tx = {
      reservation: {
        findUnique: jest.fn().mockResolvedValue(reservation),
        update: jest.fn(),
      },
      stay: { create: jest.fn() },
      roomNight: { updateMany: jest.fn() },
      folio: { create: jest.fn() },
      folioLine: { create: jest.fn() },
      reservationDeposit: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    };
    const refusal = new ConflictException(
      'Client Test est en liste noire : réservation et check-in impossibles.',
    );
    const guestsService = {
      assertNotBlacklisted: jest.fn().mockRejectedValue(refusal),
    };
    const roomsService = { transitionRoom: jest.fn() };
    const billingService = { creditFolioLine: jest.fn() };
    const auditService = { writeLog: jest.fn() };

    const service = new StayService(
      prisma as never,
      roomsService as never,
      guestsService as never,
      billingService as never,
      auditService as never,
      { emitAsync: jest.fn() } as never,
    );

    await expect(service.checkinFromReservation(42, 3)).rejects.toBe(refusal);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(guestsService.assertNotBlacklisted).toHaveBeenCalledWith(7, tx);
    expect(tx.stay.create).not.toHaveBeenCalled();
    expect(tx.roomNight.updateMany).not.toHaveBeenCalled();
    expect(tx.reservation.update).not.toHaveBeenCalled();
    expect(roomsService.transitionRoom).not.toHaveBeenCalled();
    expect(tx.folio.create).not.toHaveBeenCalled();
    expect(tx.folioLine.create).not.toHaveBeenCalled();
    expect(tx.reservationDeposit.findMany).not.toHaveBeenCalled();
    expect(tx.reservationDeposit.update).not.toHaveBeenCalled();
    expect(billingService.creditFolioLine).not.toHaveBeenCalled();
    expect(auditService.writeLog).not.toHaveBeenCalled();
  });
});
