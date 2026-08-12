import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import {
  authedRequest,
  loginAs,
  loginMobileAs,
  SEED_USERS,
} from './helpers/auth';

interface TaskResponse {
  id: number;
  roomId: number;
  statut: string;
  assignedUserId: number | null;
}

interface PaginatedTasks {
  data: TaskResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface TicketResponse {
  id: number;
  roomId: number | null;
  bloqueVente: boolean;
  resoluAt: string | null;
}

interface RoomResponse {
  id: number;
  numero: string;
  statut: string;
}

// B0.4A (DESIGN-004B, design gelé) — endpoints mobile additifs délégateurs
// vers HousekeepingTaskService/MaintenanceService. Vrais appels HTTP contre
// une vraie base MySQL/MariaDB, aucun mock — même convention que le reste de
// la suite e2e.
//
// Les jetons mobiles (scope réduit, throttle 5/min sur /login — voir
// AuthController) sont obtenus UNE SEULE FOIS par rôle dans beforeAll et
// réutilisés par tous les tests du fichier : se reconnecter à chaque `it()`
// épuiserait la limite de connexion en quelques tests.
describe('Mobile Housekeeping — endpoints additifs B0.4A (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roomTypeId: number;
  let receptionUserId: number;
  let gouvernanteUserId: number;

  let adminClient: ReturnType<typeof authedRequest>;
  let receptionMobile: ReturnType<typeof authedRequest>;
  let gouvMobile: ReturnType<typeof authedRequest>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const adminToken = await loginAs(app.getHttpServer(), 'admin');
    adminClient = authedRequest(app.getHttpServer(), adminToken);

    const receptionToken = await loginMobileAs(
      app.getHttpServer(),
      'reception',
    );
    receptionMobile = authedRequest(app.getHttpServer(), receptionToken);
    const gouvToken = await loginMobileAs(app.getHttpServer(), 'gouvernante');
    gouvMobile = authedRequest(app.getHttpServer(), gouvToken);

    const roomType = await prisma.roomType.create({
      data: { nom: 'TEST-MOBILE-HK-TYPE', prixBase: 300, capacite: 2 },
    });
    roomTypeId = roomType.id;

    const reception = await prisma.user.findUniqueOrThrow({
      where: { email: SEED_USERS.reception },
    });
    receptionUserId = reception.id;
    const gouvernante = await prisma.user.findUniqueOrThrow({
      where: { email: SEED_USERS.gouvernante },
    });
    gouvernanteUserId = gouvernante.id;
  });

  afterAll(async () => {
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  // roomId toujours connu et nettoyable dès sa création, même si l'étape
  // suivante (création/assignation de tâche) échoue — évite qu'une chambre
  // orpheline bloque le deleteMany(roomType) de afterAll par contrainte FK.
  async function createRoom(): Promise<number> {
    const room = await prisma.room.create({
      data: {
        numero: `TEST-MHK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        roomTypeId,
        statut: 'A_NETTOYER',
      },
    });
    return room.id;
  }

  // Assignation à receptionUserId (housekeeping:write, peut démarrer/
  // compléter depuis le mobile) — housekeeping:control reste réservé à la
  // Gouvernante pour valider/refuser, ce qui garantit un contrôleur
  // toujours différent de l'exécutant sans compte dédié supplémentaire.
  async function createAndAssignTask(roomId: number): Promise<number> {
    const task = await adminClient
      .post('/api/housekeeping/tasks')
      .send({ roomId, motif: 'Tâche de test B0.4A (mobile)' });
    expect(task.status).toBe(201);
    const taskId = (task.body as TaskResponse).id;

    const assign = await adminClient
      .patch(`/api/housekeeping/tasks/${taskId}/assignment`)
      .send({ assignedUserId: receptionUserId });
    expect(assign.status).toBe(200);

    return taskId;
  }

  async function cleanupRoom(roomId: number) {
    await prisma.stockMovement.deleteMany({
      where: { housekeepingStockConsumption: { housekeepingTask: { roomId } } },
    });
    await prisma.housekeepingStockConsumption.deleteMany({
      where: { housekeepingTask: { roomId } },
    });
    await prisma.maintenanceTicket.deleteMany({ where: { roomId } });
    await prisma.housekeepingTaskLog.deleteMany({
      where: { task: { roomId } },
    });
    await prisma.housekeepingTask.deleteMany({ where: { roomId } });
    await prisma.roomStatusLog.deleteMany({ where: { roomId } });
    await prisma.room.deleteMany({ where: { id: roomId } });
  }

  describe('GET /mobile/housekeeping/tasks/mine — anti-IDOR', () => {
    it("ne retourne que les tâches assignées à l'agent connecté, même en tentant d'injecter assignedUserId", async () => {
      const roomId = await createRoom();
      try {
        const taskId = await createAndAssignTask(roomId);

        const mine = await receptionMobile.get(
          '/api/mobile/housekeeping/tasks/mine',
        );
        expect(mine.status).toBe(200);
        const items = (mine.body as PaginatedTasks).data;
        expect(items.some((t) => t.id === taskId)).toBe(true);
        expect(items.every((t) => t.assignedUserId === receptionUserId)).toBe(
          true,
        );

        // Tentative d'injection : le champ n'existe pas dans
        // MobileTaskQueryDto — ValidationPipe({whitelist:true}) le retire
        // silencieusement de l'objet transformé (le harness e2e n'active
        // pas forbidNonWhitelisted comme main.ts, donc 200 et non 400 ici),
        // mais le contrôleur écrase de toute façon systématiquement
        // assignedUserId par user.sub : la valeur injectée n'a donc aucun
        // effet observable, seule la vraie protection anti-IDOR compte.
        const spoofed = await receptionMobile.get(
          `/api/mobile/housekeeping/tasks/mine?assignedUserId=${gouvernanteUserId}`,
        );
        expect(spoofed.status).toBe(200);
        const spoofedItems = (spoofed.body as PaginatedTasks).data;
        expect(
          spoofedItems.every((t) => t.assignedUserId === receptionUserId),
        ).toBe(true);

        // Confirmation indépendante : la Gouvernante (autre agent) ne voit
        // jamais la tâche assignée à Réception depuis "mine".
        const gouvMine = await gouvMobile.get(
          '/api/mobile/housekeeping/tasks/mine',
        );
        expect(gouvMine.status).toBe(200);
        const gouvItems = (gouvMine.body as PaginatedTasks).data;
        expect(gouvItems.some((t) => t.id === taskId)).toBe(false);
      } finally {
        await cleanupRoom(roomId);
      }
    });
  });

  describe('start / complete / validate / refuse depuis le mobile', () => {
    it('exécute le cycle complet start -> complete -> validate (Gouvernante, agent différent)', async () => {
      const roomId = await createRoom();
      try {
        const taskId = await createAndAssignTask(roomId);

        const start = await receptionMobile.post(
          `/api/mobile/housekeeping/tasks/${taskId}/start`,
        );
        expect(start.status).toBe(201);
        expect((start.body as TaskResponse).statut).toBe('EN_COURS');

        const complete = await receptionMobile.post(
          `/api/mobile/housekeeping/tasks/${taskId}/complete`,
        );
        expect(complete.status).toBe(201);
        expect((complete.body as TaskResponse).statut).toBe('TERMINEE');

        // Auto-validation interdite : l'agent assigné (Réception) ne peut
        // pas valider sa propre tâche même via le mobile, malgré
        // housekeeping:write — seul housekeeping:control (Gouvernante) le
        // permet, et validate() rejette explicitement actorId===assignedId.
        const selfValidate = await receptionMobile
          .post(`/api/mobile/housekeeping/tasks/${taskId}/validate`)
          .send({ motif: 'Tentative auto-validation interdite (test)' });
        expect(selfValidate.status).toBe(403);

        const validate = await gouvMobile
          .post(`/api/mobile/housekeeping/tasks/${taskId}/validate`)
          .send({ motif: 'Contrôle Gouvernante depuis mobile (test B0.4A)' });
        expect(validate.status).toBe(201);
        expect((validate.body as TaskResponse).statut).toBe('VALIDEE');

        const room = await prisma.room.findUniqueOrThrow({
          where: { id: roomId },
        });
        expect(room.statut).toBe('LIBRE_PROPRE');
      } finally {
        await cleanupRoom(roomId);
      }
    });

    it('refuse le contrôle depuis le mobile (Gouvernante) et remet la tâche EN_COURS', async () => {
      const roomId = await createRoom();
      try {
        const taskId = await createAndAssignTask(roomId);

        await receptionMobile.post(
          `/api/mobile/housekeeping/tasks/${taskId}/start`,
        );
        await receptionMobile.post(
          `/api/mobile/housekeeping/tasks/${taskId}/complete`,
        );

        const refuse = await gouvMobile
          .post(`/api/mobile/housekeeping/tasks/${taskId}/refuse`)
          .send({ motif: 'Salle de bain pas nettoyée (test B0.4A)' });
        expect(refuse.status).toBe(201);
        expect((refuse.body as TaskResponse).statut).toBe('EN_COURS');

        // Réception (housekeeping:write, pas control) ne peut pas refuser.
        const forbiddenRefuse = await receptionMobile
          .post(`/api/mobile/housekeeping/tasks/${taskId}/refuse`)
          .send({ motif: 'Tentative sans housekeeping:control (test)' });
        expect(forbiddenRefuse.status).toBe(403);
      } finally {
        await cleanupRoom(roomId);
      }
    });
  });

  describe('POST /mobile/housekeeping/incidents — signalement terrain (Finding 2)', () => {
    it('crée un vrai MaintenanceTicket bloquant et projette EN_MAINTENANCE via le chemin canonique', async () => {
      const room = await prisma.room.create({
        data: {
          numero: `TEST-MHK-INC-${Date.now()}`,
          roomTypeId,
          statut: 'LIBRE_PROPRE',
        },
      });
      try {
        const res = await gouvMobile
          .post('/api/mobile/housekeeping/incidents')
          .send({ roomId: room.id, typePanne: 'Robinet cassé (test B0.4A)' });
        expect(res.status).toBe(201);
        const ticket = res.body as TicketResponse;
        expect(ticket.roomId).toBe(room.id);
        expect(ticket.bloqueVente).toBe(true);
        expect(ticket.resoluAt).toBeNull();

        // Visible depuis la file Maintenance réelle (rôle Maintenance) —
        // preuve directe que ce n'est pas un blocage fantôme (Finding 2).
        const maintenanceToken = await loginAs(
          app.getHttpServer(),
          'maintenance',
        );
        const maintenanceClient = authedRequest(
          app.getHttpServer(),
          maintenanceToken,
        );
        const list = await maintenanceClient.get(
          `/api/maintenance-tickets?roomId=${room.id}`,
        );
        expect(list.status).toBe(200);
        expect(
          (list.body as TicketResponse[]).some((t) => t.id === ticket.id),
        ).toBe(true);

        const rooms = await adminClient.get('/api/rooms');
        const oursRoom = (rooms.body as RoomResponse[]).find(
          (r) => r.id === room.id,
        );
        expect(oursRoom!.statut).toBe('EN_MAINTENANCE');
      } finally {
        await prisma.maintenanceTicket.deleteMany({
          where: { roomId: room.id },
        });
        await prisma.roomStatusLog.deleteMany({ where: { roomId: room.id } });
        await prisma.room.deleteMany({ where: { id: room.id } });
      }
    });

    it('fonctionne avec housekeeping:report-incident seul, sans maintenance:write (Gouvernante)', async () => {
      const gouvernante = await prisma.user.findUniqueOrThrow({
        where: { email: SEED_USERS.gouvernante },
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      });
      const hasMaintenanceWrite = gouvernante.role.permissions.some(
        (rp) =>
          rp.permission.module === 'maintenance' &&
          rp.permission.action === 'write',
      );
      expect(hasMaintenanceWrite).toBe(false);

      const room = await prisma.room.create({
        data: {
          numero: `TEST-MHK-INC2-${Date.now()}`,
          roomTypeId,
          statut: 'LIBRE_PROPRE',
        },
      });
      try {
        const res = await gouvMobile
          .post('/api/mobile/housekeeping/incidents')
          .send({ roomId: room.id, typePanne: 'Climatisation en panne' });
        expect(res.status).toBe(201);
      } finally {
        await prisma.maintenanceTicket.deleteMany({
          where: { roomId: room.id },
        });
        await prisma.roomStatusLog.deleteMany({ where: { roomId: room.id } });
        await prisma.room.deleteMany({ where: { id: room.id } });
      }
    });

    it('refuse en 403 un compte sans housekeeping:report-incident (Réception)', async () => {
      const room = await prisma.room.create({
        data: {
          numero: `TEST-MHK-INC3-${Date.now()}`,
          roomTypeId,
          statut: 'LIBRE_PROPRE',
        },
      });
      try {
        const res = await receptionMobile
          .post('/api/mobile/housekeeping/incidents')
          .send({ roomId: room.id, typePanne: 'Ampoule grillée' });
        expect(res.status).toBe(403);

        // La chambre n'a pas bougé, aucun ticket créé.
        const ticketCount = await prisma.maintenanceTicket.count({
          where: { roomId: room.id },
        });
        expect(ticketCount).toBe(0);
      } finally {
        await prisma.room.deleteMany({ where: { id: room.id } });
      }
    });
  });

  describe('JwtAuthGuard — jeton mobile toujours confiné à /api/mobile/housekeeping/* (non-régression F9)', () => {
    it('rejette un jeton mobile-housekeeping sur une route desktop équivalente', async () => {
      const onDesktopTasks = await receptionMobile.get(
        '/api/housekeeping/tasks',
      );
      expect(onDesktopTasks.status).toBe(401);

      const onDesktopRooms = await receptionMobile.get('/api/rooms');
      expect(onDesktopRooms.status).toBe(401);
    });
  });

  // B0.4A (rollout compatibility correction) — PATCH /mobile/housekeeping/
  // rooms/:id/statut (legacy F9) doit continuer d'accepter ses 4 cibles
  // historiques pendant la fenêtre de rollout : l'app mobile actuellement
  // déployée n'a pas encore été migrée vers les endpoints tasks/* de B0.4A.
  // Seul le DTO desktop (UpdateRoomStatusDto) a été confiné à A_NETTOYER.
  describe('PATCH /mobile/housekeeping/rooms/:id/statut — préservation legacy pendant le rollout', () => {
    it('accepte encore LIBRE_PROPRE, EN_MAINTENANCE et EN_NETTOYAGE (comportement historique inchangé)', async () => {
      const room = await prisma.room.create({
        data: {
          numero: `TEST-MHK-LEGACY-${Date.now()}`,
          roomTypeId,
          statut: 'A_NETTOYER',
        },
      });
      try {
        const toCleaning = await receptionMobile
          .patch(`/api/mobile/housekeeping/rooms/${room.id}/statut`)
          .send({ statut: 'EN_NETTOYAGE' });
        expect(toCleaning.status).toBe(200);

        const toMaintenance = await receptionMobile
          .patch(`/api/mobile/housekeeping/rooms/${room.id}/statut`)
          .send({ statut: 'EN_MAINTENANCE' });
        expect(toMaintenance.status).toBe(200);

        const toClean = await receptionMobile
          .patch(`/api/mobile/housekeeping/rooms/${room.id}/statut`)
          .send({ statut: 'LIBRE_PROPRE' });
        expect(toClean.status).toBe(200);
        expect((toClean.body as RoomResponse).statut).toBe('LIBRE_PROPRE');
      } finally {
        await prisma.roomStatusLog.deleteMany({ where: { roomId: room.id } });
        await prisma.room.deleteMany({ where: { id: room.id } });
      }
    });

    // Décision explicite du lot (pas une régression accidentelle) : le
    // garde-fou activeRoomKey (HousekeepingService.updateStatus) reste actif
    // pour le mobile legacy — c'est un invariant de sécurité déjà démontré
    // en DESIGN-004B (Finding 1 : tâche orpheline -> check-out bloqué en
    // 409), pas une restriction de cible réintroduite en douce. Confirmé
    // ici pour qu'un futur lot ne le retire pas par erreur en pensant
    // "restaurer le legacy à l'identique".
    it('reste bloqué en 409 par le garde-fou activeRoomKey même via le PATCH mobile legacy (invariant de sécurité, pas une régression de confinement)', async () => {
      const room = await prisma.room.create({
        data: {
          numero: `TEST-MHK-LEGACY-GUARD-${Date.now()}`,
          roomTypeId,
          statut: 'A_NETTOYER',
        },
      });
      try {
        const task = await adminClient
          .post('/api/housekeeping/tasks')
          .send({ roomId: room.id, motif: 'Tâche active de test (rollout)' });
        expect(task.status).toBe(201);

        const blocked = await receptionMobile
          .patch(`/api/mobile/housekeeping/rooms/${room.id}/statut`)
          .send({ statut: 'LIBRE_PROPRE' });
        expect(blocked.status).toBe(409);
        expect((blocked.body as { message?: string }).message).toMatch(
          /tâche de ménage active/i,
        );
      } finally {
        const taskId = (
          await prisma.housekeepingTask.findFirstOrThrow({
            where: { roomId: room.id },
          })
        ).id;
        await prisma.housekeepingTaskLog.deleteMany({ where: { taskId } });
        await prisma.housekeepingTask.deleteMany({ where: { id: taskId } });
        await prisma.roomStatusLog.deleteMany({ where: { roomId: room.id } });
        await prisma.room.deleteMany({ where: { id: room.id } });
      }
    });
  });
});
