import {
  OrigineTacheHousekeeping,
  Prisma,
  PrismaClient,
  StatutChambre,
  StatutTacheHousekeeping,
  TypeLogTacheHousekeeping,
} from '@prisma/client';
import {
  backfillHousekeepingTasks,
  HOUSEKEEPING_BACKFILL_MOTIF,
  HousekeepingBackfillInconsistencyError,
} from '../prisma/scripts/backfill-housekeeping-tasks';

describe('HK-P1-03A — schéma et reprise HousekeepingTask (e2e)', () => {
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let roomTypeId: number;

  beforeAll(async () => {
    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-HK-TASK-${suffix}`,
        prixBase: 100,
        capacite: 1,
      },
    });
    roomTypeId = roomType.id;
  });

  afterEach(async () => {
    await prisma.housekeepingTaskLog.deleteMany({
      where: { task: { room: { roomTypeId } } },
    });
    await prisma.housekeepingTask.deleteMany({
      where: { room: { roomTypeId } },
    });
    await prisma.room.deleteMany({ where: { roomTypeId } });
  });

  afterAll(async () => {
    await prisma.housekeepingTaskLog.deleteMany({
      where: { task: { room: { roomTypeId } } },
    });
    await prisma.housekeepingTask.deleteMany({
      where: { room: { roomTypeId } },
    });
    await prisma.room.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.delete({ where: { id: roomTypeId } });
    await prisma.$disconnect();
  });

  async function createRoom(numero: string, statut: StatutChambre) {
    return prisma.room.create({
      data: { numero: `${numero}-${suffix}`, roomTypeId, statut },
    });
  }

  it('confirme la migration appliquée et housekeeping:control attribuée aux seuls rôles validés', async () => {
    const migration = await prisma.$queryRaw<
      Array<{ finished_at: Date | null; rolled_back_at: Date | null }>
    >`
      SELECT finished_at, rolled_back_at
      FROM _prisma_migrations
      WHERE migration_name = '20260801223000_housekeeping_task_foundation'
    `;
    expect(migration).toHaveLength(1);
    expect(migration[0].finished_at).not.toBeNull();
    expect(migration[0].rolled_back_at).toBeNull();

    const sourceEventColumn = await prisma.$queryRaw<
      Array<{ CHARACTER_MAXIMUM_LENGTH: bigint | null; IS_NULLABLE: string }>
    >`
      SELECT CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'HousekeepingTask'
        AND COLUMN_NAME = 'sourceEventKey'
    `;
    expect(sourceEventColumn).toHaveLength(1);
    expect(Number(sourceEventColumn[0].CHARACTER_MAXIMUM_LENGTH)).toBe(64);
    expect(sourceEventColumn[0].IS_NULLABLE).toBe('YES');

    const permission = await prisma.permission.findUniqueOrThrow({
      where: {
        module_action: { module: 'housekeeping', action: 'control' },
      },
      include: { roles: { include: { role: true } } },
    });
    expect(permission.roles.map(({ role }) => role.nom).sort()).toEqual([
      'Administrateur',
      'Gouvernante',
    ]);
  });

  it('impose les unicités nullable activeRoomKey et sourceEventKey', async () => {
    const roomA = await createRoom('HK-UNIQUE-A', StatutChambre.A_NETTOYER);
    const roomB = await createRoom('HK-UNIQUE-B', StatutChambre.A_NETTOYER);

    await prisma.housekeepingTask.create({
      data: {
        roomId: roomA.id,
        statut: StatutTacheHousekeeping.A_FAIRE,
        origine: OrigineTacheHousekeeping.CHECKOUT,
        activeRoomKey: roomA.id,
        sourceEventKey: 'checkout:1000001',
      },
    });

    await expect(
      prisma.housekeepingTask.create({
        data: {
          roomId: roomA.id,
          statut: StatutTacheHousekeeping.A_FAIRE,
          origine: OrigineTacheHousekeeping.MANUELLE,
          activeRoomKey: roomA.id,
        },
      }),
    ).rejects.toMatchObject<Partial<Prisma.PrismaClientKnownRequestError>>({
      code: 'P2002',
    });

    await expect(
      prisma.housekeepingTask.create({
        data: {
          roomId: roomB.id,
          statut: StatutTacheHousekeeping.A_FAIRE,
          origine: OrigineTacheHousekeeping.CHECKOUT,
          activeRoomKey: roomB.id,
          sourceEventKey: 'checkout:1000001',
        },
      }),
    ).rejects.toMatchObject<Partial<Prisma.PrismaClientKnownRequestError>>({
      code: 'P2002',
    });

    await prisma.housekeepingTask.createMany({
      data: [
        {
          roomId: roomA.id,
          statut: StatutTacheHousekeeping.VALIDEE,
          origine: OrigineTacheHousekeeping.MANUELLE,
          activeRoomKey: null,
        },
        {
          roomId: roomB.id,
          statut: StatutTacheHousekeeping.ANNULEE,
          origine: OrigineTacheHousekeeping.MANUELLE,
          activeRoomKey: null,
        },
      ],
    });
  });

  it('reprend exactement les chambres sales, conserve leurs données et reste idempotent', async () => {
    const aNettoyer = await createRoom(
      'HK-BACKFILL-DIRTY',
      StatutChambre.A_NETTOYER,
    );
    const enNettoyage = await createRoom(
      'HK-BACKFILL-CLEANING',
      StatutChambre.EN_NETTOYAGE,
    );
    const propre = await createRoom(
      'HK-BACKFILL-CLEAN',
      StatutChambre.LIBRE_PROPRE,
    );
    const maintenance = await createRoom(
      'HK-BACKFILL-MAINTENANCE',
      StatutChambre.EN_MAINTENANCE,
    );

    const candidateCount = await prisma.room.count({
      where: {
        statut: {
          in: [StatutChambre.A_NETTOYER, StatutChambre.EN_NETTOYAGE],
        },
      },
    });

    const first = await backfillHousekeepingTasks(prisma);
    expect(first).toEqual({
      examinees: candidateCount,
      creees: 2,
      ignorees: candidateCount - 2,
      erreurs: [],
    });

    const tasks = await prisma.housekeepingTask.findMany({
      where: { roomId: { in: [aNettoyer.id, enNettoyage.id] } },
      include: { logs: true },
      orderBy: { roomId: 'asc' },
    });
    expect(tasks).toHaveLength(2);

    const dirtyTask = tasks.find((task) => task.roomId === aNettoyer.id)!;
    expect(dirtyTask).toMatchObject({
      statut: StatutTacheHousekeeping.A_FAIRE,
      origine: OrigineTacheHousekeeping.REPRISE,
      activeRoomKey: aNettoyer.id,
      assignedUserId: null,
      assignedAt: null,
      startedAt: null,
      completedAt: null,
      validatedAt: null,
      cancelledAt: null,
    });

    const cleaningTask = tasks.find((task) => task.roomId === enNettoyage.id)!;
    expect(cleaningTask).toMatchObject({
      statut: StatutTacheHousekeeping.EN_COURS,
      origine: OrigineTacheHousekeeping.REPRISE,
      activeRoomKey: enNettoyage.id,
      assignedUserId: null,
      assignedAt: null,
      startedAt: null,
      completedAt: null,
      validatedAt: null,
      cancelledAt: null,
    });

    for (const task of tasks) {
      expect(task.logs).toHaveLength(1);
      expect(task.logs[0]).toMatchObject({
        type: TypeLogTacheHousekeeping.CREATION,
        actorUserId: null,
        actorUserNom: null,
        ancienAssignedUserId: null,
        nouveauAssignedUserId: null,
        ancienAssignedUserNom: null,
        nouveauAssignedUserNom: null,
        motif: HOUSEKEEPING_BACKFILL_MOTIF,
      });
      expect(task.logs[0].nouveauStatut).toBe(task.statut);
    }

    expect(
      await prisma.housekeepingTask.count({
        where: { roomId: { in: [propre.id, maintenance.id] } },
      }),
    ).toBe(0);

    const roomsAfter = await prisma.room.findMany({
      where: {
        id: { in: [aNettoyer.id, enNettoyage.id, propre.id, maintenance.id] },
      },
      orderBy: { id: 'asc' },
    });
    expect(
      roomsAfter.map(({ id, numero, statut, roomTypeId: typeId }) => ({
        id,
        numero,
        statut,
        roomTypeId: typeId,
      })),
    ).toEqual(
      [aNettoyer, enNettoyage, propre, maintenance]
        .sort((left, right) => left.id - right.id)
        .map(({ id, numero, statut, roomTypeId: typeId }) => ({
          id,
          numero,
          statut,
          roomTypeId: typeId,
        })),
    );

    const second = await backfillHousekeepingTasks(prisma);
    expect(second).toEqual({
      examinees: candidateCount,
      creees: 0,
      ignorees: candidateCount,
      erreurs: [],
    });
    expect(
      await prisma.housekeepingTask.count({
        where: { roomId: { in: [aNettoyer.id, enNettoyage.id] } },
      }),
    ).toBe(2);
  });

  it('reste idempotent lorsque deux backfills MySQL sont lancés simultanément', async () => {
    const room = await createRoom(
      'HK-BACKFILL-CONCURRENT',
      StatutChambre.A_NETTOYER,
    );
    const candidatesBefore = await prisma.room.count({
      where: {
        statut: {
          in: [StatutChambre.A_NETTOYER, StatutChambre.EN_NETTOYAGE],
        },
      },
    });
    const missingTasksBefore = await prisma.room.count({
      where: {
        statut: {
          in: [StatutChambre.A_NETTOYER, StatutChambre.EN_NETTOYAGE],
        },
        housekeepingTasks: { none: { activeRoomKey: { not: null } } },
      },
    });

    const [first, second] = await Promise.all([
      backfillHousekeepingTasks(prisma),
      backfillHousekeepingTasks(prisma),
    ]);

    expect(first.erreurs).toEqual([]);
    expect(second.erreurs).toEqual([]);
    expect(first.examinees).toBe(candidatesBefore);
    expect(second.examinees).toBe(candidatesBefore);
    expect(first.creees + second.creees).toBe(missingTasksBefore);
    expect(first.ignorees + second.ignorees).toBe(
      candidatesBefore * 2 - missingTasksBefore,
    );

    const tasks = await prisma.housekeepingTask.findMany({
      where: { roomId: room.id },
      include: { logs: true },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].logs).toHaveLength(1);
    expect(tasks[0].logs[0].type).toBe(TypeLogTacheHousekeeping.CREATION);

    const roomAfter = await prisma.room.findUniqueOrThrow({
      where: { id: room.id },
    });
    expect(roomAfter.statut).toBe(StatutChambre.A_NETTOYER);
  });

  it('s’arrête avec un rapport d’erreur sans corriger ni créer de données', async () => {
    const inconsistentRoom = await createRoom(
      'HK-BACKFILL-INCONSISTENT',
      StatutChambre.A_NETTOYER,
    );
    const pendingRoom = await createRoom(
      'HK-BACKFILL-PENDING',
      StatutChambre.A_NETTOYER,
    );
    await prisma.housekeepingTask.create({
      data: {
        roomId: inconsistentRoom.id,
        statut: StatutTacheHousekeeping.A_FAIRE,
        origine: OrigineTacheHousekeeping.REPRISE,
        activeRoomKey: null,
      },
    });

    const candidateCount = await prisma.room.count({
      where: {
        statut: {
          in: [StatutChambre.A_NETTOYER, StatutChambre.EN_NETTOYAGE],
        },
      },
    });

    let failure: HousekeepingBackfillInconsistencyError | undefined;
    try {
      await backfillHousekeepingTasks(prisma);
    } catch (error) {
      if (error instanceof HousekeepingBackfillInconsistencyError) {
        failure = error;
      } else {
        throw error;
      }
    }

    expect(failure).toBeDefined();
    expect(failure!.report).toMatchObject({
      examinees: candidateCount,
      creees: 0,
      ignorees: 0,
    });
    expect(failure!.report.erreurs).toHaveLength(1);
    expect(failure!.report.erreurs[0]).toContain(`Tâche active`);
    expect(
      await prisma.housekeepingTask.count({
        where: { roomId: pendingRoom.id },
      }),
    ).toBe(0);

    const inconsistentTask = await prisma.housekeepingTask.findFirstOrThrow({
      where: { roomId: inconsistentRoom.id },
    });
    expect(inconsistentTask.activeRoomKey).toBeNull();
  });
});
