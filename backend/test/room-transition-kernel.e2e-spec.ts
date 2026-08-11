import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StatutChambre } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RoomsService } from '../src/modules/rooms/rooms.service';

describe('Room transition kernel (B0.1)', () => {
  let moduleFixture: TestingModule;
  let prisma: PrismaService;
  let roomsService: RoomsService;
  let roomId: number | undefined;
  let roomTypeId: number | undefined;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = moduleFixture.get(PrismaService);
    roomsService = moduleFixture.get(RoomsService);
  });

  afterEach(async () => {
    if (roomId !== undefined) {
      await prisma.roomStatusLog.deleteMany({ where: { roomId } });
      await prisma.room.delete({ where: { id: roomId } });
      roomId = undefined;
    }
    if (roomTypeId !== undefined) {
      await prisma.roomType.delete({ where: { id: roomTypeId } });
      roomTypeId = undefined;
    }
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  async function createRoom() {
    const suffix = `${Date.now()}-${Math.random()}`;
    const roomType = await prisma.roomType.create({
      data: {
        nom: `B01-${suffix}`,
        prixBase: 100,
        capacite: 1,
      },
    });
    roomTypeId = roomType.id;

    const room = await prisma.room.create({
      data: {
        numero: `B01-${suffix}`,
        roomTypeId: roomType.id,
        statut: StatutChambre.LIBRE_PROPRE,
      },
    });
    roomId = room.id;
    return room;
  }

  it('deux transitions concurrentes depuis le même état : un seul succès et un seul log', async () => {
    const room = await createRoom();

    const results = await Promise.allSettled([
      roomsService.transitionRoom(room.id, StatutChambre.A_NETTOYER, {
        expectedFrom: StatutChambre.LIBRE_PROPRE,
        motif: 'Transition concurrente A',
      }),
      roomsService.transitionRoom(room.id, StatutChambre.A_NETTOYER, {
        expectedFrom: StatutChambre.LIBRE_PROPRE,
        motif: 'Transition concurrente B',
      }),
    ]);

    const successes = results.filter((result) => result.status === 'fulfilled');
    const failures = results.filter((result) => result.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    const failureReason: unknown = failures[0].reason;
    expect(failureReason).toBeInstanceOf(ConflictException);
    if (!(failureReason instanceof ConflictException)) {
      throw new Error('La transition perdante doit retourner un conflit.');
    }
    expect(failureReason.getStatus()).toBe(409);

    const persisted = await prisma.room.findUniqueOrThrow({
      where: { id: room.id },
    });
    expect(persisted.statut).toBe(StatutChambre.A_NETTOYER);
    await expect(
      prisma.roomStatusLog.count({ where: { roomId: room.id } }),
    ).resolves.toBe(1);
  });

  it('refuse un expectedFrom obsolète sans modifier la chambre ni écrire de log', async () => {
    const room = await createRoom();

    await expect(
      roomsService.transitionRoom(room.id, StatutChambre.EN_NETTOYAGE, {
        expectedFrom: StatutChambre.A_NETTOYER,
        motif: 'Transition depuis un état obsolète',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const persisted = await prisma.room.findUniqueOrThrow({
      where: { id: room.id },
    });
    expect(persisted.statut).toBe(StatutChambre.LIBRE_PROPRE);
    await expect(
      prisma.roomStatusLog.count({ where: { roomId: room.id } }),
    ).resolves.toBe(0);
  });

  it('bloque une seconde transaction tant que le verrou Room est détenu', async () => {
    const room = await createRoom();
    let releaseHolder!: () => void;
    let holderLocked!: () => void;
    const holderHasLock = new Promise<void>((resolve) => {
      holderLocked = resolve;
    });
    const releaseHolderLock = new Promise<void>((resolve) => {
      releaseHolder = resolve;
    });

    const holder = prisma.$transaction(async (tx) => {
      await roomsService.lockRoomForUpdate(room.id, tx);
      holderLocked();
      await releaseHolderLock;
    });
    await holderHasLock;

    let contenderAcquired = false;
    const contender = prisma.$transaction(async (tx) => {
      await roomsService.lockRoomForUpdate(room.id, tx);
      contenderAcquired = true;
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(contenderAcquired).toBe(false);
    } finally {
      releaseHolder();
      await holder;
      await contender;
    }
    expect(contenderAcquired).toBe(true);
  });

  it('annule la transition si l’écriture du RoomStatusLog échoue', async () => {
    const room = await createRoom();

    await expect(
      roomsService.transitionRoom(room.id, StatutChambre.A_NETTOYER, {
        expectedFrom: StatutChambre.LIBRE_PROPRE,
        motif: 'x'.repeat(192),
      }),
    ).rejects.toThrow();

    const persisted = await prisma.room.findUniqueOrThrow({
      where: { id: room.id },
    });
    expect(persisted.statut).toBe(StatutChambre.LIBRE_PROPRE);
    await expect(
      prisma.roomStatusLog.count({ where: { roomId: room.id } }),
    ).resolves.toBe(0);
  });
});
