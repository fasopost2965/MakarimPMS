import {
  OrigineTacheHousekeeping,
  Prisma,
  PrismaClient,
  StatutChambre,
  StatutTacheHousekeeping,
  TypeLogTacheHousekeeping,
} from '@prisma/client';

export const HOUSEKEEPING_BACKFILL_MOTIF =
  'Reprise contrôlée HK-P1-03A depuis le statut existant de la chambre.';

export interface HousekeepingBackfillReport {
  examinees: number;
  creees: number;
  ignorees: number;
  erreurs: string[];
}

export class HousekeepingBackfillInconsistencyError extends Error {
  constructor(public readonly report: HousekeepingBackfillReport) {
    super(
      `Backfill Housekeeping interrompu : ${report.erreurs.length} incohérence(s) détectée(s).`,
    );
    this.name = 'HousekeepingBackfillInconsistencyError';
  }
}

export class HousekeepingBackfillConcurrencyError extends Error {
  constructor(public readonly code: 'P2002' | 'P2034') {
    super(
      `Backfill Housekeeping interrompu après ${MAX_CONCURRENCY_ATTEMPTS} tentatives concurrentes (${code}).`,
    );
    this.name = 'HousekeepingBackfillConcurrencyError';
  }
}

const ACTIVE_TASK_STATUSES: StatutTacheHousekeeping[] = [
  StatutTacheHousekeeping.A_FAIRE,
  StatutTacheHousekeeping.AFFECTEE,
  StatutTacheHousekeeping.EN_COURS,
  StatutTacheHousekeeping.TERMINEE,
];

const TERMINAL_TASK_STATUSES: StatutTacheHousekeeping[] = [
  StatutTacheHousekeeping.VALIDEE,
  StatutTacheHousekeeping.ANNULEE,
];

const MAX_CONCURRENCY_ATTEMPTS = 3;

type LockedRoom = {
  id: number;
  numero: string;
  statut: StatutChambre;
};

function expectedRoomStatus(statut: StatutTacheHousekeeping): StatutChambre {
  if (
    statut === StatutTacheHousekeeping.A_FAIRE ||
    statut === StatutTacheHousekeeping.AFFECTEE
  ) {
    return StatutChambre.A_NETTOYER;
  }
  return StatutChambre.EN_NETTOYAGE;
}

async function findInconsistencies(
  tx: Prisma.TransactionClient,
): Promise<string[]> {
  const errors: string[] = [];
  const activeTasks = await tx.housekeepingTask.findMany({
    where: { statut: { in: ACTIVE_TASK_STATUSES } },
    include: { room: { select: { numero: true, statut: true } } },
    orderBy: { id: 'asc' },
  });

  for (const task of activeTasks) {
    if (task.activeRoomKey !== task.roomId) {
      errors.push(
        `Tâche active ${task.id} : activeRoomKey=${String(task.activeRoomKey)} au lieu de roomId=${task.roomId}.`,
      );
    }

    const expected = expectedRoomStatus(task.statut);
    if (task.room.statut !== expected) {
      errors.push(
        `Tâche active ${task.id} : chambre ${task.room.numero} au statut ${task.room.statut}, attendu ${expected}.`,
      );
    }
  }

  const terminalWithActiveKey = await tx.housekeepingTask.findMany({
    where: {
      statut: { in: TERMINAL_TASK_STATUSES },
      activeRoomKey: { not: null },
    },
    select: { id: true, roomId: true, activeRoomKey: true },
    orderBy: { id: 'asc' },
  });
  for (const task of terminalWithActiveKey) {
    errors.push(
      `Tâche terminale ${task.id} de la chambre ${task.roomId} avec activeRoomKey=${String(task.activeRoomKey)}.`,
    );
  }

  return errors;
}

async function executeBackfill(
  prisma: PrismaClient,
): Promise<HousekeepingBackfillReport> {
  return prisma.$transaction(
    async (tx) => {
      const rooms = await tx.room.findMany({
        where: {
          statut: {
            in: [StatutChambre.A_NETTOYER, StatutChambre.EN_NETTOYAGE],
          },
        },
        select: { id: true, numero: true, statut: true },
        orderBy: { id: 'asc' },
      });

      const report: HousekeepingBackfillReport = {
        examinees: rooms.length,
        creees: 0,
        ignorees: 0,
        erreurs: await findInconsistencies(tx),
      };

      if (report.erreurs.length > 0) {
        throw new HousekeepingBackfillInconsistencyError(report);
      }

      for (const room of rooms) {
        const lockedRooms = await tx.$queryRaw<LockedRoom[]>`
          SELECT id, numero, statut
          FROM Room
          WHERE id = ${room.id}
          FOR UPDATE
        `;
        const lockedRoom = lockedRooms[0];

        if (
          !lockedRoom ||
          (lockedRoom.statut !== StatutChambre.A_NETTOYER &&
            lockedRoom.statut !== StatutChambre.EN_NETTOYAGE)
        ) {
          report.ignorees += 1;
          continue;
        }

        const statut =
          lockedRoom.statut === StatutChambre.A_NETTOYER
            ? StatutTacheHousekeeping.A_FAIRE
            : StatutTacheHousekeeping.EN_COURS;

        const inserted = await tx.$executeRaw`
          INSERT INTO HousekeepingTask (
            roomId,
            statut,
            origine,
            activeRoomKey,
            createdAt,
            updatedAt
          )
          SELECT
            ${lockedRoom.id},
            ${statut},
            ${OrigineTacheHousekeeping.REPRISE},
            ${lockedRoom.id},
            CURRENT_TIMESTAMP(3),
            CURRENT_TIMESTAMP(3)
          FROM DUAL
          WHERE NOT EXISTS (
            SELECT 1
            FROM HousekeepingTask
            WHERE activeRoomKey = ${lockedRoom.id}
          )
        `;

        if (inserted === 0) {
          report.ignorees += 1;
          continue;
        }

        const task = await tx.housekeepingTask.findUniqueOrThrow({
          where: { activeRoomKey: lockedRoom.id },
          select: { id: true },
        });
        await tx.housekeepingTaskLog.create({
          data: {
            taskId: task.id,
            type: TypeLogTacheHousekeeping.CREATION,
            nouveauStatut: statut,
            motif: HOUSEKEEPING_BACKFILL_MOTIF,
          },
        });
        report.creees += 1;
      }

      return report;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

function isRetryableConcurrencyError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError & {
  code: 'P2002' | 'P2034';
} {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

export async function backfillHousekeepingTasks(
  prisma: PrismaClient,
): Promise<HousekeepingBackfillReport> {
  for (let attempt = 1; attempt <= MAX_CONCURRENCY_ATTEMPTS; attempt += 1) {
    try {
      return await executeBackfill(prisma);
    } catch (error) {
      if (!isRetryableConcurrencyError(error)) {
        throw error;
      }
      if (attempt === MAX_CONCURRENCY_ATTEMPTS) {
        throw new HousekeepingBackfillConcurrencyError(error.code);
      }
    }
  }

  throw new Error(
    'Backfill Housekeeping interrompu après plusieurs tentatives.',
  );
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const report = await backfillHousekeepingTasks(prisma);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (error instanceof HousekeepingBackfillInconsistencyError) {
      console.error(JSON.stringify(error.report, null, 2));
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
