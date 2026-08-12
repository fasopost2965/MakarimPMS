import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { StockService } from './../src/modules/stock/stock.service';
import { authedRequest, loginAs } from './helpers/auth';

interface StockItemResponse {
  id: number;
  code: string;
  quantiteDisponible: number;
  seuilAlerte: number;
  sousSeuilAlerte: boolean;
}

const SOAP_CODE = 'AMEN-SOAP-01';
const SHAMPOO_CODE = 'AMEN-SHMP-01';
const DRAP_CODE = 'LINGE-DRAP-01';
const CAPACITE = 3;

// Module stock (Sprint 12, BR-STK-001/002). Vrais appels HTTP contre une
// vraie base MySQL, aucun mock — sauf le spy EventEmitter2 pour vérifier
// l'émission de StockThresholdAlertEvent sans dépendre d'un consommateur.
describe('Stock — inventaire et déstockage automatique (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let gouvernanteClient: ReturnType<typeof authedRequest>;
  let receptionClient: ReturnType<typeof authedRequest>;
  let maintenanceClient: ReturnType<typeof authedRequest>;
  let adminClient: ReturnType<typeof authedRequest>;
  let gouvernanteId: number;
  let roomTypeId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const gouvernanteToken = await loginAs(app.getHttpServer(), 'gouvernante');
    gouvernanteClient = authedRequest(app.getHttpServer(), gouvernanteToken);
    const receptionToken = await loginAs(app.getHttpServer(), 'reception');
    receptionClient = authedRequest(app.getHttpServer(), receptionToken);
    const maintenanceToken = await loginAs(app.getHttpServer(), 'maintenance');
    maintenanceClient = authedRequest(app.getHttpServer(), maintenanceToken);
    const adminToken = await loginAs(app.getHttpServer(), 'admin');
    adminClient = authedRequest(app.getHttpServer(), adminToken);
    gouvernanteId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'gouvernante@makarim.test' },
        select: { id: true },
      })
    ).id;

    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-STOCK-TYPE-${Date.now()}`,
        prixBase: 400,
        capacite: CAPACITE,
      },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({
      where: { room: { roomTypeId } },
    });
    await prisma.stockMovement.deleteMany({
      where: {
        housekeepingStockConsumption: {
          housekeepingTask: { room: { roomTypeId } },
        },
      },
    });
    await prisma.housekeepingStockConsumption.deleteMany({
      where: { housekeepingTask: { room: { roomTypeId } } },
    });
    await prisma.housekeepingTaskLog.deleteMany({
      where: { task: { room: { roomTypeId } } },
    });
    await prisma.housekeepingTask.deleteMany({
      where: { room: { roomTypeId } },
    });
    await prisma.roomStatusLog.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.room.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  // HousekeepingService.updateStatus() émet nettoyage.valide via emit() —
  // volontairement NON attendu (isolation, voir le commentaire du service),
  // donc la réponse HTTP revient avant que le listener stock ait fini son
  // travail asynchrone. Sabotage/restore ayant révélé la fragilité d'un
  // délai fixe ici (flake CI ponctuel : le listener peut mettre plus de
  // 100ms sous charge) : on attend la condition réelle par polling plutôt
  // qu'un délai arbitraire — robuste quelle que soit la charge de la
  // machine, sans jamais dépasser un timeout généreux en cas d'échec
  // véritable. En production, rien ne dépend de ce timing (c'est
  // précisément le but de l'isolation par emit()).
  async function attendreCondition(
    condition: () => boolean | Promise<boolean>,
    timeoutMs = 2000,
    intervalMs = 20,
  ): Promise<void> {
    const debut = Date.now();
    while (Date.now() - debut < timeoutMs) {
      if (await condition()) return;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(
      `Condition non remplie après ${timeoutMs}ms (listener asynchrone trop lent ou jamais déclenché).`,
    );
  }

  function mouvementSortieExiste(stockItemId: number, roomId: number) {
    return async () =>
      (await prisma.stockMovement.findFirst({
        where: { stockItemId, typeMouvement: 'SORTIE', roomId },
      })) !== null;
  }

  async function createRoomANettoyer() {
    const room = await prisma.room.create({
      data: {
        numero: `TEST-STOCK-${Date.now()}-${Math.random()}`,
        roomTypeId,
        statut: 'A_NETTOYER',
      },
    });
    return room.id;
  }

  async function getItem(code: string) {
    return prisma.stockItem.findUniqueOrThrow({ where: { code } });
  }

  async function runTaskCycle(roomId: number, taskId?: number) {
    let id = taskId;
    if (!id) {
      const task = await prisma.housekeepingTask.create({
        data: {
          roomId,
          assignedUserId: gouvernanteId,
          statut: 'AFFECTEE',
          origine: 'MANUELLE',
          activeRoomKey: roomId,
        },
      });
      id = task.id;
    }

    expect(
      (await adminClient.post(`/api/housekeeping/tasks/${id}/start`)).status,
    ).toBe(201);
    expect(
      (await adminClient.post(`/api/housekeeping/tasks/${id}/complete`)).status,
    ).toBe(201);
    expect(
      (
        await adminClient
          .post(`/api/housekeeping/tasks/${id}/validate`)
          .send({ motif: 'Contrôle complet de la chambre' })
      ).status,
    ).toBe(201);
    return id;
  }

  describe('Réassort manuel (POST /stocks/replenish)', () => {
    it('augmente la quantité disponible et journalise une ENTREE avec référence fournisseur', async () => {
      const before = await getItem(DRAP_CODE);

      const res = await gouvernanteClient.post('/api/stocks/replenish').send({
        stockItemId: before.id,
        quantite: 20,
        motif: 'Livraison hebdomadaire linge',
        referenceFournisseur: 'BL-2026-0456',
      });
      expect(res.status).toBe(201);
      const item = res.body as StockItemResponse;
      expect(item.quantiteDisponible).toBe(before.quantiteDisponible + 20);

      const mouvement = await prisma.stockMovement.findFirst({
        where: { stockItemId: before.id, typeMouvement: 'ENTREE' },
        orderBy: { createdAt: 'desc' },
      });
      expect(mouvement).toBeDefined();
      expect(mouvement!.referenceFournisseur).toBe('BL-2026-0456');
      expect(mouvement!.quantite).toBe(20);
    });
  });

  describe('Sortie manuelle (POST /stocks/sortie, CH-039)', () => {
    it('décrémente la quantité et journalise une SORTIE liée à une chambre réelle (réfection de chambre)', async () => {
      const roomId = await createRoomANettoyer();
      const before = await getItem(DRAP_CODE);

      const res = await gouvernanteClient.post('/api/stocks/sortie').send({
        stockItemId: before.id,
        quantite: 2,
        motif: 'Réfection chambre — linge sale envoyé en buanderie',
        roomId,
      });
      expect(res.status).toBe(201);
      const item = res.body as StockItemResponse;
      expect(item.quantiteDisponible).toBe(before.quantiteDisponible - 2);

      const mouvement = await prisma.stockMovement.findFirst({
        where: { stockItemId: before.id, typeMouvement: 'SORTIE', roomId },
        orderBy: { createdAt: 'desc' },
      });
      expect(mouvement).toBeDefined();
      expect(mouvement!.quantite).toBe(2);
      expect(mouvement!.roomId).toBe(roomId);
    });

    it('accepte une sortie sans chambre (constat de perte/casse/péremption, BR-STK-003)', async () => {
      const before = await getItem(DRAP_CODE);

      const res = await gouvernanteClient.post('/api/stocks/sortie').send({
        stockItemId: before.id,
        quantite: 1,
        motif: 'Constat de casse — drap déchiré, mis au rebut',
      });
      expect(res.status).toBe(201);

      const mouvement = await prisma.stockMovement.findFirst({
        where: {
          stockItemId: before.id,
          typeMouvement: 'SORTIE',
          roomId: null,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(mouvement).toBeDefined();
      expect(mouvement!.motif).toContain('Constat de casse');
    });

    it('un motif < 10 caractères est rejeté (BR-STK-003, 400)', async () => {
      const item = await getItem(DRAP_CODE);
      const res = await gouvernanteClient.post('/api/stocks/sortie').send({
        stockItemId: item.id,
        quantite: 1,
        motif: 'court',
      });
      expect(res.status).toBe(400);
    });

    it('un roomId inexistant renvoie 404 (façade RoomsService, pas une erreur FK opaque)', async () => {
      const item = await getItem(DRAP_CODE);
      const res = await gouvernanteClient.post('/api/stocks/sortie').send({
        stockItemId: item.id,
        quantite: 1,
        motif: 'Test roomId inexistant e2e',
        roomId: 999999,
      });
      expect(res.status).toBe(404);
    });

    it('refuse une sortie qui rendrait la quantité négative (INV-STK-001, 400)', async () => {
      const item = await getItem(DRAP_CODE);
      const res = await gouvernanteClient.post('/api/stocks/sortie').send({
        stockItemId: item.id,
        quantite: item.quantiteDisponible + 1000,
        motif: 'Test sortie excessive e2e',
      });
      expect(res.status).toBe(400);

      const apres = await getItem(DRAP_CODE);
      expect(apres.quantiteDisponible).toBe(item.quantiteDisponible);
    });

    it('la Réception ne peut pas déclarer de sortie manuelle (403)', async () => {
      const item = await getItem(DRAP_CODE);
      const res = await receptionClient.post('/api/stocks/sortie').send({
        stockItemId: item.id,
        quantite: 1,
        motif: 'Tentative non autorisée test e2e',
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Cloisonnement RBAC (module stock, RBAC_MATRIX.md)', () => {
    it('la Réception ne peut ni lire ni écrire (403)', async () => {
      const lecture = await receptionClient.get('/api/stocks');
      expect(lecture.status).toBe(403);

      const item = await getItem(DRAP_CODE);
      const ecriture = await receptionClient
        .post('/api/stocks/replenish')
        .send({ stockItemId: item.id, quantite: 5, motif: 'Test' });
      expect(ecriture.status).toBe(403);
    });

    it("Maintenance n'a PAS accès au stock, malgré la mention contraire de docs/modules/stock.md (RBAC_MATRIX.md fait foi)", async () => {
      const res = await maintenanceClient.get('/api/stocks');
      expect(res.status).toBe(403);
    });

    it('la Gouvernante peut lire et écrire', async () => {
      const res = await gouvernanteClient.get('/api/stocks');
      expect(res.status).toBe(200);
    });
  });

  describe('Déstockage automatique du kit d’accueil (BR-STK-001)', () => {
    beforeEach(async () => {
      await prisma.stockItem.updateMany({
        where: { code: { in: [SOAP_CODE, SHAMPOO_CODE] } },
        data: { quantiteDisponible: 200 },
      });
    });

    it('rejouer le même cycle reste idempotent (un mouvement par article)', async () => {
      const roomId = await createRoomANettoyer();
      const taskId = await runTaskCycle(roomId);
      const stock = app.get(StockService);

      await Promise.all([
        stock.processHousekeepingCycle(taskId, 1),
        stock.processHousekeepingCycle(taskId, 1),
      ]);

      const consumptions = await prisma.housekeepingStockConsumption.findMany({
        where: { housekeepingTaskId: taskId, cycle: 1 },
      });
      expect(consumptions).toHaveLength(2);
      expect(consumptions.every((row) => row.statut === 'DONE')).toBe(true);
      for (const row of consumptions) {
        expect(
          await prisma.stockMovement.count({
            where: { housekeepingStockConsumptionId: row.id },
          }),
        ).toBe(1);
      }
    });

    it('deux consommateurs concurrents ne décrémentent qu’une fois', async () => {
      const roomId = await createRoomANettoyer();
      const savon = await getItem(SOAP_CODE);
      await prisma.stockItem.update({
        where: { id: savon.id },
        data: { quantiteDisponible: 20 },
      });
      const task = await prisma.housekeepingTask.create({
        data: {
          roomId,
          assignedUserId: gouvernanteId,
          statut: 'VALIDEE',
          origine: 'MANUELLE',
          activeRoomKey: null,
        },
      });
      const consumption = await prisma.housekeepingStockConsumption.create({
        data: {
          housekeepingTaskId: task.id,
          cycle: 1,
          stockItemId: savon.id,
          quantite: CAPACITE,
        },
      });
      const stock = app.get(StockService);
      const avant = (await getItem(SOAP_CODE)).quantiteDisponible;
      await Promise.all([
        stock.processHousekeepingCycle(task.id, 1),
        stock.processHousekeepingCycle(task.id, 1),
      ]);
      expect((await getItem(SOAP_CODE)).quantiteDisponible).toBe(
        avant - CAPACITE,
      );
      expect(
        await prisma.stockMovement.count({
          where: { housekeepingStockConsumptionId: consumption.id },
        }),
      ).toBe(1);
      expect(
        (
          await prisma.housekeepingStockConsumption.findUniqueOrThrow({
            where: { id: consumption.id },
          })
        ).statut,
      ).toBe('DONE');
    });

    it('reprend une intention PENDING et ignore le second rejeu', async () => {
      const roomId = await createRoomANettoyer();
      const savon = await getItem(SOAP_CODE);
      const task = await prisma.housekeepingTask.create({
        data: {
          roomId,
          assignedUserId: gouvernanteId,
          statut: 'VALIDEE',
          origine: 'MANUELLE',
        },
      });
      const row = await prisma.housekeepingStockConsumption.create({
        data: {
          housekeepingTaskId: task.id,
          cycle: 1,
          stockItemId: savon.id,
          quantite: 1,
        },
      });
      const stock = app.get(StockService);
      await stock.processHousekeepingCycle(task.id, 1);
      await stock.processHousekeepingCycle(task.id, 1);
      expect(
        (
          await prisma.housekeepingStockConsumption.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).statut,
      ).toBe('DONE');
      expect(
        await prisma.stockMovement.count({
          where: { housekeepingStockConsumptionId: row.id },
        }),
      ).toBe(1);
    });

    it('reprend après interruption déterministe entre deux articles', async () => {
      const roomId = await createRoomANettoyer();
      const [savon, shampoing] = await Promise.all([
        getItem(SOAP_CODE),
        getItem(SHAMPOO_CODE),
      ]);
      const task = await prisma.housekeepingTask.create({
        data: {
          roomId,
          assignedUserId: gouvernanteId,
          statut: 'VALIDEE',
          origine: 'MANUELLE',
        },
      });
      const first = await prisma.housekeepingStockConsumption.create({
        data: {
          housekeepingTaskId: task.id,
          cycle: 1,
          stockItemId: savon.id,
          quantite: 1,
        },
      });
      const second = await prisma.housekeepingStockConsumption.create({
        data: {
          housekeepingTaskId: task.id,
          cycle: 1,
          stockItemId: shampoing.id,
          quantite: 1,
        },
      });
      const stock = app.get(StockService);
      const seamTarget = stock as unknown as {
        processHousekeepingConsumption: (id: number) => Promise<void>;
      };
      const original = seamTarget.processHousekeepingConsumption.bind(stock);
      const seam = jest
        .spyOn(seamTarget, 'processHousekeepingConsumption')
        .mockImplementationOnce((id) => original(id))
        .mockImplementationOnce(async () => {
          throw new Error('TEST_INTERRUPTION_BEFORE_SECOND_ARTICLE');
        });
      await expect(stock.processHousekeepingCycle(task.id, 1)).rejects.toThrow(
        'TEST_INTERRUPTION_BEFORE_SECOND_ARTICLE',
      );
      seam.mockRestore();

      expect(
        (
          await prisma.housekeepingStockConsumption.findUniqueOrThrow({
            where: { id: first.id },
          })
        ).statut,
      ).toBe('DONE');
      expect(
        (
          await prisma.housekeepingStockConsumption.findUniqueOrThrow({
            where: { id: second.id },
          })
        ).statut,
      ).toBe('PENDING');

      await stock.processHousekeepingCycle(task.id, 1);
      expect(
        await prisma.stockMovement.count({
          where: { housekeepingStockConsumptionId: first.id },
        }),
      ).toBe(1);
      expect(
        await prisma.stockMovement.count({
          where: { housekeepingStockConsumptionId: second.id },
        }),
      ).toBe(1);
      expect(
        await prisma.housekeepingStockConsumption.count({
          where: { housekeepingTaskId: task.id, statut: 'DONE' },
        }),
      ).toBe(2);
    });

    it('FAILED reste terminal après réassort et rejeu', async () => {
      const roomId = await createRoomANettoyer();
      const savon = await getItem(SOAP_CODE);
      await prisma.stockItem.update({
        where: { id: savon.id },
        data: { quantiteDisponible: 0 },
      });
      const task = await prisma.housekeepingTask.create({
        data: {
          roomId,
          assignedUserId: gouvernanteId,
          statut: 'VALIDEE',
          origine: 'MANUELLE',
        },
      });
      const row = await prisma.housekeepingStockConsumption.create({
        data: {
          housekeepingTaskId: task.id,
          cycle: 1,
          stockItemId: savon.id,
          quantite: 1,
        },
      });
      const stock = app.get(StockService);
      await stock.processHousekeepingCycle(task.id, 1);
      await prisma.stockItem.update({
        where: { id: savon.id },
        data: { quantiteDisponible: 20 },
      });
      await stock.processHousekeepingCycle(task.id, 1);
      expect(
        (
          await prisma.housekeepingStockConsumption.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).statut,
      ).toBe('FAILED');
      expect(
        await prisma.stockMovement.count({
          where: { housekeepingStockConsumptionId: row.id },
        }),
      ).toBe(0);
    });

    it('sortie manuelle concurrente et consommation automatique préservent le stock', async () => {
      const roomId = await createRoomANettoyer();
      const savon = await getItem(SOAP_CODE);
      await prisma.stockItem.update({
        where: { id: savon.id },
        data: { quantiteDisponible: 10 },
      });
      const task = await prisma.housekeepingTask.create({
        data: {
          roomId,
          assignedUserId: gouvernanteId,
          statut: 'VALIDEE',
          origine: 'MANUELLE',
        },
      });
      await prisma.housekeepingStockConsumption.create({
        data: {
          housekeepingTaskId: task.id,
          cycle: 1,
          stockItemId: savon.id,
          quantite: 3,
        },
      });
      const stock = app.get(StockService);
      await Promise.all([
        stock.processHousekeepingCycle(task.id, 1),
        gouvernanteClient.post('/api/stocks/sortie').send({
          stockItemId: savon.id,
          quantite: 2,
          motif: 'Sortie manuelle concurrente test',
          roomId,
        }),
      ]);
      expect((await getItem(SOAP_CODE)).quantiteDisponible).toBe(5);
      expect(
        await prisma.stockMovement.count({
          where: { stockItemId: savon.id, roomId },
        }),
      ).toBe(2);
    });

    it('préserve les mouvements historiques sans clé Housekeeping', async () => {
      expect(
        await prisma.stockMovement.count({
          where: { housekeepingStockConsumptionId: null },
        }),
      ).toBeGreaterThan(0);
    });

    it('deux validations concurrentes ne créent qu’un ensemble d’intentions', async () => {
      const roomId = await createRoomANettoyer();
      const task = await prisma.housekeepingTask.create({
        data: {
          roomId,
          assignedUserId: gouvernanteId,
          statut: 'AFFECTEE',
          origine: 'MANUELLE',
        },
      });
      await adminClient.post(`/api/housekeeping/tasks/${task.id}/start`);
      await adminClient.post(`/api/housekeeping/tasks/${task.id}/complete`);
      const validations = await Promise.all([
        adminClient
          .post(`/api/housekeeping/tasks/${task.id}/validate`)
          .send({ motif: 'Contrôle concurrent 1' }),
        adminClient
          .post(`/api/housekeeping/tasks/${task.id}/validate`)
          .send({ motif: 'Contrôle concurrent 2' }),
      ]);
      expect(
        validations.filter((response) => response.status === 201),
      ).toHaveLength(1);
      expect(
        validations.filter((response) => response.status === 409),
      ).toHaveLength(1);
      const taskId = task.id;
      const persistedTask = await prisma.housekeepingTask.findUniqueOrThrow({
        where: { id: taskId },
      });
      const rows = await prisma.housekeepingStockConsumption.findMany({
        where: { housekeepingTaskId: taskId, cycle: persistedTask.stockCycle },
      });
      expect(rows).toHaveLength(2);
      await attendreCondition(async () => {
        return (
          (await prisma.stockMovement.count({
            where: {
              housekeepingStockConsumptionId: { in: rows.map((row) => row.id) },
            },
          })) === 2
        );
      });
      expect(
        await prisma.stockMovement.count({
          where: {
            housekeepingStockConsumptionId: { in: rows.map((row) => row.id) },
          },
        }),
      ).toBe(2);
    });

    it('la réouverture incrémente le cycle et autorise un nouveau kit', async () => {
      const roomId = await createRoomANettoyer();
      const taskId = await runTaskCycle(roomId);
      await attendreCondition(async () => {
        const rows = await prisma.housekeepingStockConsumption.findMany({
          where: { housekeepingTaskId: taskId, cycle: 1 },
        });
        return rows.length === 2 && rows.every((row) => row.statut === 'DONE');
      });
      await expect(
        adminClient.post(`/api/housekeeping/tasks/${taskId}/reopen`).send({
          motif: 'Nouveau cycle physique de contrôle',
        }),
      ).resolves.toMatchObject({ status: 201 });
      await prisma.housekeepingTask.update({
        where: { id: taskId },
        data: { assignedUserId: gouvernanteId, statut: 'AFFECTEE' },
      });
      await runTaskCycle(roomId, taskId);
      await attendreCondition(async () => {
        const rows = await prisma.housekeepingStockConsumption.findMany({
          where: { housekeepingTaskId: taskId, cycle: 2 },
        });
        return rows.length === 2 && rows.every((row) => row.statut === 'DONE');
      });

      const consumptions = await prisma.housekeepingStockConsumption.findMany({
        where: { housekeepingTaskId: taskId },
        orderBy: { cycle: 'asc' },
      });
      expect(consumptions.map((row) => row.cycle)).toEqual([1, 1, 2, 2]);
      expect(consumptions.every((row) => row.statut === 'DONE')).toBe(true);
    });

    it('valider un nettoyage décompte 1 unité par occupant théorique pour chaque article kitAccueil, jamais pour un article hors kit', async () => {
      const roomId = await createRoomANettoyer();
      const savonAvant = await getItem(SOAP_CODE);
      const shampoingAvant = await getItem(SHAMPOO_CODE);
      const drapAvant = await getItem(DRAP_CODE);

      await runTaskCycle(roomId);
      const mouvementSavonExiste = mouvementSortieExiste(savonAvant.id, roomId);
      const mouvementShampoingExiste = mouvementSortieExiste(
        shampoingAvant.id,
        roomId,
      );
      await attendreCondition(
        async () =>
          (await mouvementSavonExiste()) && (await mouvementShampoingExiste()),
      );

      const savonApres = await getItem(SOAP_CODE);
      const shampoingApres = await getItem(SHAMPOO_CODE);
      const drapApres = await getItem(DRAP_CODE);

      expect(savonApres.quantiteDisponible).toBe(
        savonAvant.quantiteDisponible - CAPACITE,
      );
      expect(shampoingApres.quantiteDisponible).toBe(
        shampoingAvant.quantiteDisponible - CAPACITE,
      );
      // Article hors kit d'accueil : jamais touché par le décompte auto.
      expect(drapApres.quantiteDisponible).toBe(drapAvant.quantiteDisponible);

      const mouvementSavon = await prisma.stockMovement.findFirst({
        where: { stockItemId: savonApres.id, typeMouvement: 'SORTIE', roomId },
        orderBy: { createdAt: 'desc' },
      });
      expect(mouvementSavon).toBeDefined();
      expect(mouvementSavon!.quantite).toBe(CAPACITE);
      expect(mouvementSavon!.userId).toBeNull();
    });

    it('le changement legacy de statut Room ne déclenche plus Stock', async () => {
      const roomId = await createRoomANettoyer();
      expect(
        (
          await gouvernanteClient
            .patch(`/api/rooms/${roomId}/statut`)
            .send({ statut: 'EN_NETTOYAGE' })
        ).status,
      ).toBe(200);
      expect(
        (
          await gouvernanteClient
            .patch(`/api/rooms/${roomId}/statut`)
            .send({ statut: 'LIBRE_PROPRE' })
        ).status,
      ).toBe(200);
      expect(
        await prisma.stockMovement.count({
          where: { roomId, typeMouvement: 'SORTIE' },
        }),
      ).toBe(0);
    });

    it('un article de kit en rupture n’empêche ni la validation du ménage ni le décompte des autres articles (isolation)', async () => {
      const roomId = await createRoomANettoyer();
      const savon = await getItem(SOAP_CODE);

      // Force une rupture insuffisante pour le savon uniquement.
      await prisma.stockItem.update({
        where: { id: savon.id },
        data: { quantiteDisponible: 1 },
      });

      try {
        const shampoingAvant = await getItem(SHAMPOO_CODE);

        await runTaskCycle(roomId);
        await attendreCondition(
          mouvementSortieExiste(shampoingAvant.id, roomId),
        );

        const savonApres = await getItem(SOAP_CODE);
        const shampoingApres = await getItem(SHAMPOO_CODE);

        // INV-STK-001 : jamais négatif, jamais partiellement décrémenté.
        expect(savonApres.quantiteDisponible).toBe(1);
        // L'article non contraint est bien décompté malgré l'échec du premier.
        expect(shampoingApres.quantiteDisponible).toBe(
          shampoingAvant.quantiteDisponible - CAPACITE,
        );
      } finally {
        // Restaure un niveau réaliste même si une assertion échoue, pour ne
        // jamais polluer les tests suivants (ou une exécution ultérieure).
        await prisma.stockItem.update({
          where: { id: savon.id },
          data: { quantiteDisponible: savon.quantiteDisponible },
        });
      }
    });

    it('émet StockThresholdAlertEvent quand le niveau franchit le seuil (BR-STK-002)', async () => {
      const roomId = await createRoomANettoyer();
      const savon = await getItem(SOAP_CODE);

      // Positionne le stock pile à seuilAlerte + CAPACITE : après décompte,
      // le niveau tombe exactement à seuilAlerte (condition <=, franchie).
      await prisma.stockItem.update({
        where: { id: savon.id },
        data: { quantiteDisponible: savon.seuilAlerte + CAPACITE },
      });

      const eventEmitter = app.get(EventEmitter2);
      const emitSpy = jest.spyOn(eventEmitter, 'emitAsync');

      try {
        await runTaskCycle(roomId);
        await attendreCondition(() =>
          emitSpy.mock.calls.some((call) => call[0] === 'stock.seuil_critique'),
        );

        expect(emitSpy).toHaveBeenCalledWith(
          'stock.seuil_critique',
          expect.objectContaining({
            stockItemId: savon.id,
            code: SOAP_CODE,
            quantiteDisponible: savon.seuilAlerte,
          }),
        );
      } finally {
        emitSpy.mockRestore();
        // Restaure un niveau confortable même en cas d'échec d'assertion.
        await prisma.stockItem.update({
          where: { id: savon.id },
          data: { quantiteDisponible: 200 },
        });
      }
    });
  });
});
