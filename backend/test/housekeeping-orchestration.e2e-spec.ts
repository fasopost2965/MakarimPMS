import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { App } from 'supertest/types';
import request from 'supertest';
import { authedRequest, loginAs } from './helpers/auth';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  StatutChambre,
  StatutTacheHousekeeping,
  OrigineTacheHousekeeping,
} from '@prisma/client';

describe('Housekeeping Orchestration & API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let controlClient: ReturnType<typeof authedRequest>;
  let writeClient: ReturnType<typeof authedRequest>;
  let readClient: ReturnType<typeof authedRequest>;
  let noPermClient: ReturnType<typeof authedRequest>;

  let testRoomId: number;
  let testStayId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create tokens for different roles using standard helper
    const gouvernanteToken = await loginAs(
      app.getHttpServer() as App,
      'gouvernante',
    );
    const receptionToken = await loginAs(
      app.getHttpServer() as App,
      'reception',
    );
    const comptableToken = await loginAs(
      app.getHttpServer() as App,
      'comptable',
    );

    controlClient = authedRequest(app.getHttpServer() as App, gouvernanteToken);
    writeClient = authedRequest(app.getHttpServer() as App, gouvernanteToken);
    readClient = authedRequest(app.getHttpServer() as App, receptionToken);
    noPermClient = authedRequest(app.getHttpServer() as App, comptableToken);

    // Clean up from previous runs if they failed mid-way
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@assignable-test.com' } },
    });
    await prisma.rolePermission.deleteMany({
      where: {
        role: {
          nom: { in: ['TEST_ROLE_CONTROL_ONLY', 'TEST_ROLE_READ_ONLY'] },
        },
      },
    });
    await prisma.role.deleteMany({
      where: { nom: { in: ['TEST_ROLE_CONTROL_ONLY', 'TEST_ROLE_READ_ONLY'] } },
    });
    await prisma.roomStatusLog.deleteMany({
      where: { room: { numero: 'HK-999' } },
    });
    await prisma.housekeepingTaskLog.deleteMany({
      where: { task: { room: { numero: 'HK-999' } } },
    });
    await prisma.housekeepingTask.deleteMany({
      where: { room: { numero: 'HK-999' } },
    });
    await prisma.roomNight.deleteMany({
      where: { room: { numero: 'HK-999' } },
    });
    await prisma.stay.deleteMany({ where: { room: { numero: 'HK-999' } } });
    await prisma.reservation.deleteMany({
      where: { room: { numero: 'HK-999' } },
    });
    await prisma.guest.deleteMany({ where: { email: 'hk@test.com' } });
    await prisma.room.deleteMany({ where: { numero: 'HK-999' } });
    await prisma.roomType.deleteMany({ where: { nom: 'HK-Cat' } });

    // Setup basic test data
    const cat = await prisma.roomType.create({
      data: {
        nom: 'HK-Cat',
        capacite: 2,
        prixBase: 100,
      },
    });

    const room = await prisma.room.create({
      data: {
        numero: 'HK-999',
        roomTypeId: cat.id,
        etage: 9,
        statut: StatutChambre.LIBRE_PROPRE,
      },
    });
    testRoomId = room.id;

    const guest = await prisma.guest.create({
      data: {
        nom: 'HK-Test',
        prenom: 'Guest',
        email: 'hk@test.com',
        telephone: '123',
        pieceIdentite: '123',
      },
    });

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const res = await prisma.reservation.create({
      data: {
        guestId: guest.id,
        roomId: room.id,
        dateArrivee: today,
        dateDepart: tomorrow,
        statut: 'CONFIRMEE',
        prixTotalCalcule: 100,
        prixTotalFinal: 100,
      },
    });

    const stay = await prisma.stay.create({
      data: {
        reservationId: res.id,
        guestId: guest.id,
        roomId: room.id,
        dateCheckin: today,
        dateCheckoutPrevue: tomorrow,
        statut: 'EN_COURS',
      },
    });
    testStayId = stay.id;
  });

  afterAll(async () => {
    // Clean up
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { endsWith: '@assignable-test.com' } },
      });
      await prisma.rolePermission.deleteMany({
        where: {
          role: {
            nom: { in: ['TEST_ROLE_CONTROL_ONLY', 'TEST_ROLE_READ_ONLY'] },
          },
        },
      });
      await prisma.role.deleteMany({
        where: {
          nom: { in: ['TEST_ROLE_CONTROL_ONLY', 'TEST_ROLE_READ_ONLY'] },
        },
      });
      await prisma.roomStatusLog.deleteMany({
        where: { room: { numero: 'HK-999' } },
      });
      await prisma.housekeepingTaskLog.deleteMany({
        where: { task: { room: { numero: 'HK-999' } } },
      });
      await prisma.housekeepingTask.deleteMany({
        where: { room: { numero: 'HK-999' } },
      });
      await prisma.roomNight.deleteMany({
        where: { room: { numero: 'HK-999' } },
      });
      await prisma.stay.deleteMany({ where: { room: { numero: 'HK-999' } } });
      await prisma.reservation.deleteMany({
        where: { room: { numero: 'HK-999' } },
      });
      await prisma.guest.deleteMany({ where: { email: 'hk@test.com' } });
      await prisma.room.deleteMany({ where: { numero: 'HK-999' } });
      await prisma.roomType.deleteMany({ where: { nom: 'HK-Cat' } });
    }

    if (app) {
      await app.close();
    }
  });

  describe('RBAC & Endpoints', () => {
    it('GET /api/housekeeping/tasks - should require read permission', async () => {
      await noPermClient.get('/api/housekeeping/tasks').expect(403);

      await readClient.get('/api/housekeeping/tasks').expect(200);
    });

    it('POST /api/housekeeping/tasks - should require write permission', async () => {
      await noPermClient
        .post('/api/housekeeping/tasks')
        .send({ roomId: testRoomId, motif: 'Test manual creation' })
        .expect(403);

      await writeClient
        .post('/api/housekeeping/tasks')
        .send({ roomId: testRoomId, motif: 'Test manual creation' })
        .expect(409); // because room is LIBRE_PROPRE (attendu: A_NETTOYER)
    });
  });

  describe('Checkout Orchestration & Idempotency', () => {
    it('should create task and transition room on checkout.effectue', async () => {
      // Simulate emitting the event
      const eventEmitter = app.get(EventEmitter2);
      await eventEmitter.emitAsync('checkout.effectue', {
        stayId: testStayId,
        roomId: testRoomId,
        userId: 1,
      });

      const room = await prisma.room.findUnique({
        where: { id: testRoomId },
      });
      expect(room?.statut).toBe(StatutChambre.A_NETTOYER);

      const task = await prisma.housekeepingTask.findFirst({
        where: { activeRoomKey: testRoomId },
      });
      expect(task).toBeDefined();
      expect(task?.origine).toBe(OrigineTacheHousekeeping.CHECKOUT);
      expect(task?.sourceEventKey).toBe(`checkout:${testStayId}`);
      expect(task?.statut).toBe(StatutTacheHousekeeping.A_FAIRE);
    });

    it('should be idempotent on replaying checkout.effectue', async () => {
      // Re-emit same event
      const eventEmitter = app.get(EventEmitter2);
      await eventEmitter.emitAsync('checkout.effectue', {
        stayId: testStayId,
        roomId: testRoomId,
        userId: 1,
      });

      // Should still be only 1 task
      const tasks = await prisma.housekeepingTask.findMany({
        where: { activeRoomKey: testRoomId },
      });
      expect(tasks.length).toBe(1);
    });
  });

  describe('Reconciliation', () => {
    it('POST /api/housekeeping/tasks/reconcile-dirty-rooms - should create task for A_NETTOYER without task', async () => {
      // Manually delete active tasks to simulate A_NETTOYER without task
      const tasks = await prisma.housekeepingTask.findMany({
        where: { roomId: testRoomId },
      });
      for (const t of tasks) {
        await prisma.housekeepingTaskLog.deleteMany({
          where: { taskId: t.id },
        });
      }
      await prisma.housekeepingTask.deleteMany({
        where: { roomId: testRoomId },
      });

      const res = await controlClient.post(
        '/api/housekeeping/tasks/reconcile-dirty-rooms',
      );
      if (res.status !== 201) {
        console.error('Reconcile failed:', res.body);
      }
      expect(res.status).toBe(201);

      const task = await prisma.housekeepingTask.findFirst({
        where: { roomId: testRoomId },
      });
      expect(task).toBeDefined();
      expect(task?.origine).toBe('REPRISE'); // from enum
      expect(task?.statut).toBe('A_FAIRE'); // from enum

      const log = await prisma.housekeepingTaskLog.findFirst({
        where: { taskId: task!.id },
      });
      expect(log).toBeDefined();
      expect(log?.type).toBe('CREATION');
      expect(log?.motif).toMatch(/réconciliation/i);
      expect(log?.actorUserId).toBeNull();
    });

    it('should be idempotent (second call creates nothing)', async () => {
      const res = await controlClient.post(
        '/api/housekeeping/tasks/reconcile-dirty-rooms',
      );
      if (res.status !== 201) {
        console.error('Reconcile second call failed:', res.body);
      }
      expect(res.status).toBe(201);

      const resBody = res.body as { created: number };
      expect(resBody.created).toBe(0);

      const countTasks = await prisma.housekeepingTask.count({
        where: { roomId: testRoomId },
      });
      expect(countTasks).toBe(1);

      const task = await prisma.housekeepingTask.findFirst({
        where: { roomId: testRoomId },
      });
      const countLogs = await prisma.housekeepingTaskLog.count({
        where: { taskId: task!.id },
      });
      expect(countLogs).toBe(1); // No new creation log
    });
  });

  describe('Pagination & History', () => {
    it('GET /api/housekeeping/tasks - should paginate', async () => {
      const res = await readClient
        .get('/api/housekeeping/tasks?page=1&limit=10')
        .expect(200);

      const resBody = res.body as {
        meta: { page: number; limit: number };
        data: unknown[];
      };
      expect(resBody.meta).toBeDefined();
      expect(resBody.meta.page).toBe(1);
      expect(resBody.meta.limit).toBe(10);
      expect(resBody.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/housekeeping/tasks/assignable-users', () => {
    let userW1: { id: number };
    let userW2: { id: number };
    let userW3: { id: number };
    let userInactive: { id: number };
    let userDeleted: { id: number };
    let userRead: { id: number };
    let userControl: { id: number };
    let userNoPerm: { id: number };

    beforeAll(async () => {
      const gouvernanteRole = await prisma.role.findFirst({
        where: { nom: 'gouvernante' },
      });

      const permRead = await prisma.permission.upsert({
        where: { module_action: { module: 'housekeeping', action: 'read' } },
        update: {},
        create: { module: 'housekeeping', action: 'read' },
      });

      const roleRead = await prisma.role.create({
        data: {
          nom: 'TEST_ROLE_READ_ONLY',
          permissions: {
            create: [{ permissionId: permRead.id }],
          },
        },
      });

      const permControl = await prisma.permission.upsert({
        where: { module_action: { module: 'housekeeping', action: 'control' } },
        update: {},
        create: { module: 'housekeeping', action: 'control' },
      });

      const roleControl = await prisma.role.create({
        data: {
          nom: 'TEST_ROLE_CONTROL_ONLY',
          permissions: {
            create: [{ permissionId: permControl.id }],
          },
        },
      });

      const roleNoPerm = await prisma.role.create({
        data: {
          nom: 'TEST_ROLE_NO_PERM',
        },
      });

      const fakeHash = '$2b$10$e8.Z/v7P23YV9j44J7KxOe3.1/v7P23YV9j44J7KxOe3.1';

      userW1 = await prisma.user.create({
        data: {
          nom: 'Z_Assignable HK User',
          email: 'z_assignable@assignable-test.com',
          motDePasseHash: fakeHash,
          roleId: gouvernanteRole!.id,
          actif: true,
        },
      });

      userW2 = await prisma.user.create({
        data: {
          nom: 'A_Assignable HK User',
          email: 'a_assignable1@assignable-test.com',
          motDePasseHash: fakeHash,
          roleId: gouvernanteRole!.id,
          actif: true,
        },
      });

      userW3 = await prisma.user.create({
        data: {
          nom: 'A_Assignable HK User',
          email: 'a_assignable2@assignable-test.com',
          motDePasseHash: fakeHash,
          roleId: gouvernanteRole!.id,
          actif: true,
        },
      });

      userInactive = await prisma.user.create({
        data: {
          nom: 'B_Inactive HK User',
          email: 'inactive@assignable-test.com',
          motDePasseHash: fakeHash,
          roleId: gouvernanteRole!.id,
          actif: false,
        },
      });

      userDeleted = await prisma.user.create({
        data: {
          nom: 'C_Deleted HK User',
          email: 'deleted@assignable-test.com',
          motDePasseHash: fakeHash,
          roleId: gouvernanteRole!.id,
          actif: true,
          deletedAt: new Date(),
        },
      });

      userRead = await prisma.user.create({
        data: {
          nom: 'D_Read HK User',
          email: 'read_only@assignable-test.com',
          motDePasseHash: fakeHash,
          roleId: roleRead.id,
          actif: true,
        },
      });

      userControl = await prisma.user.create({
        data: {
          nom: 'F_ControlOnly HK User',
          email: 'control_only@assignable-test.com',
          motDePasseHash: fakeHash,
          roleId: roleControl.id,
          actif: true,
        },
      });

      userNoPerm = await prisma.user.create({
        data: {
          nom: 'G_NoPerm HK User',
          email: 'no_perm@assignable-test.com',
          motDePasseHash: fakeHash,
          roleId: roleNoPerm.id,
          actif: true,
        },
      });
    });

    afterAll(async () => {
      await prisma.user.deleteMany({
        where: { email: { endsWith: '@assignable-test.com' } },
      });
      await prisma.rolePermission.deleteMany({
        where: {
          role: {
            nom: {
              in: [
                'TEST_ROLE_CONTROL_ONLY',
                'TEST_ROLE_READ_ONLY',
                'TEST_ROLE_NO_PERM',
              ],
            },
          },
        },
      });
      await prisma.role.deleteMany({
        where: {
          nom: {
            in: [
              'TEST_ROLE_CONTROL_ONLY',
              'TEST_ROLE_READ_ONLY',
              'TEST_ROLE_NO_PERM',
            ],
          },
        },
      });
    });

    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer() as App)
        .get('/api/housekeeping/tasks/assignable-users')
        .expect(401);
    });

    it('should return 403 when user lacks housekeeping:write', async () => {
      await noPermClient
        .get('/api/housekeeping/tasks/assignable-users')
        .expect(403);
    });

    it('should return active users with housekeeping:write and exclude inactive, deleted, read-only, control-only users', async () => {
      const res = await writeClient
        .get('/api/housekeeping/tasks/assignable-users')
        .expect(200);

      const users = res.body as Array<{
        id: number;
        nom: string;
        actif: boolean;
      }>;

      expect(Array.isArray(users)).toBe(true);

      const returnedIds = users.map((u) => u.id);
      expect(returnedIds).toContain(userW1.id);
      expect(returnedIds).toContain(userW2.id);
      expect(returnedIds).toContain(userW3.id);

      expect(returnedIds).not.toContain(userInactive.id);
      expect(returnedIds).not.toContain(userDeleted.id);
      expect(returnedIds).not.toContain(userRead.id);
      expect(returnedIds).not.toContain(userControl.id);
      expect(returnedIds).not.toContain(userNoPerm.id);
    });

    it('should project exactly id, nom, actif and omit all sensitive fields', async () => {
      const res = await writeClient
        .get('/api/housekeeping/tasks/assignable-users')
        .expect(200);

      const users = res.body as Array<Record<string, unknown>>;
      expect(users.length).toBeGreaterThan(0);

      for (const item of users) {
        expect(Object.keys(item).sort()).toEqual(['actif', 'id', 'nom']);
        expect(item.actif).toBe(true);
        expect(item).not.toHaveProperty('email');
        expect(item).not.toHaveProperty('motDePasseHash');
        expect(item).not.toHaveProperty('roleId');
        expect(item).not.toHaveProperty('tokenVersion');
        expect(item).not.toHaveProperty('deletedAt');
        expect(item).not.toHaveProperty('permissions');
        expect(item).not.toHaveProperty('employee');
      }
    });

    it('should sort deterministically by nom ASC then id ASC', async () => {
      const res = await writeClient
        .get('/api/housekeeping/tasks/assignable-users')
        .expect(200);

      const users = res.body as Array<{
        id: number;
        nom: string;
        actif: boolean;
      }>;

      const testUsers = users.filter((u) =>
        [userW1.id, userW2.id, userW3.id].includes(u.id),
      );

      expect(testUsers).toHaveLength(3);
      expect(testUsers[0].id).toBe(userW2.id); // A_Assignable, smaller ID
      expect(testUsers[1].id).toBe(userW3.id); // A_Assignable, larger ID
      expect(testUsers[2].id).toBe(userW1.id); // Z_Assignable
    });

    it('should not collide with GET /housekeeping/tasks/:id route', async () => {
      const res = await readClient
        .get('/api/housekeeping/tasks/999999')
        .expect(404);

      const body = res.body as { message: string };
      expect(body.message).toMatch(/Tâche 999999 introuvable/);
    });
  });
});
