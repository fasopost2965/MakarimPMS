import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
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
    it('valider un nettoyage décompte 1 unité par occupant théorique pour chaque article kitAccueil, jamais pour un article hors kit', async () => {
      const roomId = await createRoomANettoyer();
      const savonAvant = await getItem(SOAP_CODE);
      const shampoingAvant = await getItem(SHAMPOO_CODE);
      const drapAvant = await getItem(DRAP_CODE);

      const enNettoyage = await gouvernanteClient
        .patch(`/api/rooms/${roomId}/statut`)
        .send({ statut: 'EN_NETTOYAGE' });
      expect(enNettoyage.status).toBe(200);

      const libre = await gouvernanteClient
        .patch(`/api/rooms/${roomId}/statut`)
        .send({ statut: 'LIBRE_PROPRE' });
      expect(libre.status).toBe(200);
      await attendreCondition(mouvementSortieExiste(savonAvant.id, roomId));

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

        const libre = await gouvernanteClient
          .patch(`/api/rooms/${roomId}/statut`)
          .send({ statut: 'LIBRE_PROPRE' });
        // Le flux de ménage principal réussit malgré l'échec du décompte savon.
        expect(libre.status).toBe(200);
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
        const libre = await gouvernanteClient
          .patch(`/api/rooms/${roomId}/statut`)
          .send({ statut: 'LIBRE_PROPRE' });
        expect(libre.status).toBe(200);
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
