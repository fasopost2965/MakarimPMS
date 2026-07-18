import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

interface DashboardResume {
  tauxOccupation: number;
  chambresOccupees: number;
  totalChambres: number;
  arriveesAujourdhui: number;
  departsAujourdhui: number;
  chambresANettoyer: number;
  encaisseAujourdhui: string;
}

interface StayResponse {
  id: number;
  roomId: number;
}

// Dashboard basique (cahier des charges §5.3, Phase 1). Le point de vigilance
// principal (rappelé explicitement dans la demande) : réutiliser la même
// fenêtre "aujourd'hui" (UTC minuit → UTC minuit+1) que reservations
// (arrivalsToday) et checkin (departsToday), pour ne pas réintroduire le bug
// UTC/local déjà corrigé au module 5.4. Les tests ci-dessous comparent
// directement les chiffres du dashboard aux réponses des endpoints existants
// plutôt que de recalculer une date indépendamment — c'est la preuve de
// cohérence demandée. Vrais appels HTTP contre une vraie base MySQL.
describe('Dashboard — résumé (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roomTypeId: number;
  let roomId: number;
  let roomId2: number;
  let client: ReturnType<typeof authedRequest>;

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
    const token = await loginAs(app.getHttpServer(), 'admin');
    client = authedRequest(app.getHttpServer(), token);

    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-DASHBOARD-TYPE-${Date.now()}`,
        prixBase: 400,
        capacite: 2,
      },
    });
    roomTypeId = roomType.id;

    const room = await prisma.room.create({
      data: { numero: `TEST-DASH-${Date.now()}-1`, roomTypeId },
    });
    roomId = room.id;

    const room2 = await prisma.room.create({
      data: { numero: `TEST-DASH-${Date.now()}-2`, roomTypeId },
    });
    roomId2 = room2.id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({
      where: {
        invoice: { folio: { stay: { roomId: { in: [roomId, roomId2] } } } },
      },
    });
    await prisma.invoice.deleteMany({
      where: { folio: { stay: { roomId: { in: [roomId, roomId2] } } } },
    });
    await prisma.folioLine.deleteMany({
      where: { folio: { stay: { roomId: { in: [roomId, roomId2] } } } },
    });
    await prisma.folio.deleteMany({
      where: { stay: { roomId: { in: [roomId, roomId2] } } },
    });
    await prisma.roomNight.deleteMany({
      where: { roomId: { in: [roomId, roomId2] } },
    });
    await prisma.stay.deleteMany({
      where: { roomId: { in: [roomId, roomId2] } },
    });
    await prisma.reservation.deleteMany({
      where: { roomId: { in: [roomId, roomId2] } },
    });
    await prisma.roomStatusLog.deleteMany({
      where: { roomId: { in: [roomId, roomId2] } },
    });
    await prisma.room.deleteMany({ where: { id: { in: [roomId, roomId2] } } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  it("renvoie une structure de résumé avec un taux d'occupation cohérent", async () => {
    // Note : ce test ne compare pas totalChambres à un second appel Prisma
    // indépendant — les autres suites e2e du fichier tournent en parallèle
    // (Jest exécute chaque *.e2e-spec.ts dans son propre worker) et créent/
    // suppriment des chambres pendant ce test, ce qui rendrait une telle
    // comparaison instable. On vérifie plutôt la cohérence interne d'une
    // seule et même réponse.
    const res = await client.get('/api/dashboard/resume');
    expect(res.status).toBe(200);

    const resume = res.body as DashboardResume;
    expect(resume.totalChambres).toBeGreaterThan(0);
    expect(resume.chambresOccupees).toBeLessThanOrEqual(resume.totalChambres);

    // Taux d'occupation = chambresOccupees / totalChambres * 100, calculé à
    // partir des mêmes chiffres renvoyés dans la même réponse.
    const expectedTaux = Number(
      ((resume.chambresOccupees / resume.totalChambres) * 100).toFixed(1),
    );
    expect(resume.tauxOccupation).toBe(expectedTaux);
  });

  it(
    "le nombre d'arrivées du jour dans le dashboard correspond exactement à " +
      'GET /reservations/arrivees-du-jour (même fenêtre de date, pas de bug UTC/local)',
    async () => {
      // Créer une réservation arrivant aujourd'hui.
      await client.post('/api/reservations').send({
        roomId,
        dateArrivee: new Date().toISOString().slice(0, 10),
        dateDepart: new Date(Date.now() + 2 * 86_400_000)
          .toISOString()
          .slice(0, 10),
        guest: { nom: 'Dashboard', prenom: 'Arrivee' },
      });

      // Appels quasi-simultanés (Promise.all) pour réduire au minimum la
      // fenêtre de course avec les autres suites e2e qui tournent en
      // parallèle et peuvent muter des réservations/séjours pendant le test.
      const [arrivalsRes, dashboardRes] = await Promise.all([
        client.get('/api/reservations/arrivees-du-jour'),
        client.get('/api/dashboard/resume'),
      ]);

      const arrivals = arrivalsRes.body as unknown[];
      const resume = dashboardRes.body as DashboardResume;

      expect(resume.arriveesAujourdhui).toBe(arrivals.length);
      // Vérifie explicitement que notre réservation de test est bien comptée
      // (pas juste une coïncidence de compteurs à zéro).
      expect(arrivals.length).toBeGreaterThan(0);
    },
  );

  it(
    'le nombre de départs du jour dans le dashboard correspond exactement à ' +
      'GET /stays/departs-du-jour (même fenêtre de date que checkin.departsToday)',
    async () => {
      // Walk-in avec départ prévu aujourd'hui (impossible via la validation
      // normale « doit être postérieur à aujourd'hui », donc on force via un
      // check-in normal avec départ demain, puis on avance directement la
      // date en base pour simuler un départ prévu aujourd'hui sans dépendre
      // de la validation métier hors-sujet ici).
      const checkin = await client.post('/api/checkin/walk-in').send({
        roomId: roomId2,
        dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
          .toISOString()
          .slice(0, 10),
        guest: { nom: 'Dashboard', prenom: 'Depart' },
      });
      expect(checkin.status).toBe(201);
      const stayId = (checkin.body as StayResponse).id;

      await prisma.stay.update({
        where: { id: stayId },
        data: { dateCheckoutPrevue: new Date() },
      });

      const [departsRes, dashboardRes] = await Promise.all([
        client.get('/api/stays/departs-du-jour'),
        client.get('/api/dashboard/resume'),
      ]);

      const departs = departsRes.body as unknown[];
      const resume = dashboardRes.body as DashboardResume;

      expect(resume.departsAujourdhui).toBe(departs.length);
      expect(departs.length).toBeGreaterThan(0);

      // Nettoyer ce séjour tout de suite pour ne pas fausser les tests
      // suivants du fichier (chambresOccupees, etc.).
      await client.post(`/api/checkout/${stayId}`).send();
    },
  );

  it('le nombre de chambres à nettoyer correspond exactement à GET /rooms filtré sur A_NETTOYER', async () => {
    await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'A_NETTOYER' });

    const [roomsRes, dashboardRes] = await Promise.all([
      client.get('/api/rooms'),
      client.get('/api/dashboard/resume'),
    ]);

    interface RoomResponse {
      id: number;
      statut: string;
    }
    const rooms = roomsRes.body as RoomResponse[];
    const expectedCount = rooms.filter((r) => r.statut === 'A_NETTOYER').length;
    const resume = dashboardRes.body as DashboardResume;

    expect(resume.chambresANettoyer).toBe(expectedCount);
    expect(expectedCount).toBeGreaterThan(0);
  });

  it("l'encaissé du jour reflète la somme des paiements créés aujourd'hui", async () => {
    // Note : ne compare pas un "avant" / "après" sur deux appels séquentiels
    // au dashboard — la suite billing.e2e-spec.ts tourne en parallèle
    // (Jest, un worker par fichier) et crée elle-même des paiements dans la
    // même fenêtre "aujourd'hui", ce qui rendrait un delta séquentiel
    // instable. On calcule plutôt une somme de référence indépendante
    // (Prisma) quasi simultanément à l'appel du dashboard, et on compare les
    // deux chiffres pris au même instant.
    const idempotencyKey = `test-dashboard-payment-${Date.now()}`;
    await client.post('/api/payments').send({
      moyen: 'ESPECES',
      montant: '123.45',
      idempotencyKey,
    });

    const { today, tomorrow } = (() => {
      const t = new Date();
      t.setUTCHours(0, 0, 0, 0);
      const tmrw = new Date(t);
      tmrw.setUTCDate(tmrw.getUTCDate() + 1);
      return { today: t, tomorrow: tmrw };
    })();

    const [dashboardRes, expectedSum] = await Promise.all([
      client.get('/api/dashboard/resume'),
      prisma.payment.aggregate({
        where: { createdAt: { gte: today, lt: tomorrow } },
        _sum: { montant: true },
      }),
    ]);

    const resume = dashboardRes.body as DashboardResume;
    const expectedAmount = (expectedSum._sum.montant ?? 0).toString();

    expect(Number(resume.encaisseAujourdhui)).toBeCloseTo(
      Number(expectedAmount),
      2,
    );
    // Vérifie explicitement que notre propre paiement de test est bien
    // inclus dans le total (pas juste une coïncidence de compteurs à zéro).
    expect(Number(resume.encaisseAujourdhui)).toBeGreaterThanOrEqual(123.45);

    // Nettoyer : sans ça, le paiement de test resterait en base et fausserait
    // durablement l'encaissé du jour affiché dans le dashboard.
    await prisma.payment.deleteMany({ where: { idempotencyKey } });
  });
});
