import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { App } from 'supertest/types';
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
      eventEmitter.emit('checkout.effectue', {
        stayId: testStayId,
        roomId: testRoomId,
        userId: 1,
      });

      // Wait a bit for async event processing
      await new Promise((resolve) => setTimeout(resolve, 500));

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
      eventEmitter.emit('checkout.effectue', {
        stayId: testStayId,
        roomId: testRoomId,
        userId: 1,
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

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
});
