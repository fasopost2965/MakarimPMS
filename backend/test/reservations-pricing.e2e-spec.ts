import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

interface ReservationResponse {
  id: number;
  prixTotalCalcule: string;
  prixTotalFinal: string;
  ajustementManuel: boolean;
  motifAjustement: string | null;
}

type ApiReservationBody = ReservationResponse & { id: number };
type ApiErrorBody = { message: string | string[] };
type ApiAvailabilityBody = { prixTotalEstime: string }[];

// Tarification saisonnière (cahier des charges §5.1/§5.4) : vérifie le calcul
// nuit par nuit contre une vraie base MySQL (docker-compose), avec des
// tarifs saisonniers isolés (pas ceux du seed) pour un test reproductible.
describe('Reservations — tarification saisonnière (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roomTypeId: number;
  let roomId: number;
  let client: ReturnType<typeof authedRequest>;

  const PRIX_BASE = 500;
  const PRIX_SAISON_1 = 600;
  const PRIX_SAISON_2 = 700;

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
    const token = await loginAs(app.getHttpServer(), 'reception');
    client = authedRequest(app.getHttpServer(), token);

    const roomType = await prisma.roomType.create({
      data: { nom: 'TEST-PRICING-TYPE', prixBase: PRIX_BASE, capacite: 2 },
    });
    roomTypeId = roomType.id;

    await prisma.seasonRate.createMany({
      data: [
        {
          roomTypeId,
          libelle: 'Haute saison 1',
          dateDebut: new Date('2026-07-01'),
          dateFin: new Date('2026-07-19'),
          prixNuit: PRIX_SAISON_1,
        },
        {
          roomTypeId,
          libelle: 'Haute saison 2',
          dateDebut: new Date('2026-07-20'),
          dateFin: new Date('2026-08-31'),
          prixNuit: PRIX_SAISON_2,
        },
      ],
    });

    const room = await prisma.room.create({
      data: { numero: `TEST-PRICING-${Date.now()}`, roomTypeId },
    });
    roomId = room.id;
  });

  afterAll(async () => {
    await prisma.roomNight.deleteMany({ where: { roomId } });
    await prisma.reservation.deleteMany({ where: { roomId } });
    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.seasonRate.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  it('calcule le prix nuit par nuit pour une réservation à cheval sur deux saisons', async () => {
    // 18, 19 juillet -> Haute saison 1 (600) ; 20, 21 juillet -> Haute
    // saison 2 (700). dateDepart = 22 (exclue, jour de départ non facturé).
    const res = await client.post('/api/reservations').send({
      roomId,
      dateArrivee: '2026-07-18',
      dateDepart: '2026-07-22',
      guest: { nom: 'Cheval', prenom: 'Saisons' },
    });
    const body = res.body as ReservationResponse;

    expect(res.status).toBe(201);
    expect(Number(body.prixTotalCalcule)).toBe(
      2 * PRIX_SAISON_1 + 2 * PRIX_SAISON_2,
    );
    expect(Number(body.prixTotalFinal)).toBe(
      2 * PRIX_SAISON_1 + 2 * PRIX_SAISON_2,
    );
    expect(body.ajustementManuel).toBe(false);

    await prisma.roomNight.deleteMany({ where: { reservationId: body.id } });
    await prisma.reservation.delete({ where: { id: body.id } });
  });

  it('retombe sur RoomType.prixBase pour une nuit hors de toute plage SeasonRate', async () => {
    // 28, 29, 30 juin -> aucune plage ne couvre ces dates (la première
    // commence le 1er juillet) -> tarif de base.
    const res = await client.post('/api/reservations').send({
      roomId,
      dateArrivee: '2026-06-28',
      dateDepart: '2026-07-01',
      guest: { nom: 'Hors', prenom: 'Saison' },
    });
    const body = res.body as ReservationResponse;

    expect(res.status).toBe(201);
    expect(Number(body.prixTotalCalcule)).toBe(3 * PRIX_BASE);

    await prisma.roomNight.deleteMany({ where: { reservationId: body.id } });
    await prisma.reservation.delete({ where: { id: body.id } });
  });

  it('marque ajustementManuel à true quand la réception modifie prixTotalFinal, sans jamais recalculer prixTotalCalcule', async () => {
    const created = await client.post('/api/reservations').send({
      roomId,
      dateArrivee: '2026-07-18',
      dateDepart: '2026-07-20',
      guest: { nom: 'Ajustement', prenom: 'Manuel' },
    });
    const createdBody = created.body as ReservationResponse;
    const reservationId = createdBody.id;
    const prixCalculeInitial = createdBody.prixTotalCalcule;

    const patched = await client
      .patch(`/api/reservations/${reservationId}`)
      .send({ prixTotalFinal: 1000, motifAjustement: 'Geste commercial' });
    const patchedBody = patched.body as ReservationResponse;

    expect(patched.status).toBe(200);
    expect(patchedBody.prixTotalCalcule).toBe(prixCalculeInitial);
    expect(Number(patchedBody.prixTotalFinal)).toBe(1000);
    expect(patchedBody.ajustementManuel).toBe(true);
    expect(patchedBody.motifAjustement).toBe('Geste commercial');

    // Déplacer la réservation (chambre inchangée mais dates décalées) ne
    // doit pas écraser silencieusement l'ajustement manuel déjà en place.
    const moved = await client
      .patch(`/api/reservations/${reservationId}`)
      .send({ dateArrivee: '2026-07-19', dateDepart: '2026-07-21' });
    const movedBody = moved.body as ReservationResponse;

    expect(moved.status).toBe(200);
    expect(Number(movedBody.prixTotalFinal)).toBe(1000);
    expect(movedBody.ajustementManuel).toBe(true);
    // prixTotalCalcule, lui, reflète toujours la période courante.
    expect(Number(movedBody.prixTotalCalcule)).toBe(
      PRIX_SAISON_1 + PRIX_SAISON_2,
    );

    await prisma.roomNight.deleteMany({ where: { reservationId } });
    await prisma.reservation.delete({ where: { id: reservationId } });
  });

  // CH-061 (Lot #3 design) — GET /reservations/estimation-prix expose la
  // même fonction de calcul (calculatePrixTotal) sans créer de réservation,
  // pour un aperçu de prix en direct côté formulaire réception.
  describe('GET /reservations/estimation-prix', () => {
    it('estime le prix nuit par nuit à cheval sur deux saisons, sans créer de réservation', async () => {
      const res = await client.get('/api/reservations/estimation-prix').query({
        roomTypeId,
        dateArrivee: '2026-07-18',
        dateDepart: '2026-07-22',
      });

      expect(res.status).toBe(200);
      expect(Number((res.body as { prixEstime: string }).prixEstime)).toBe(
        2 * PRIX_SAISON_1 + 2 * PRIX_SAISON_2,
      );
      // Preuve de rigueur (aucune réservation/RoomNight créée) : la table
      // reste vide pour ce type de chambre isolé du seed.
      const count = await prisma.reservation.count({
        where: { roomId },
      });
      expect(count).toBe(0);
    });

    it('renvoie 404 pour un type de chambre inexistant', async () => {
      const res = await client.get('/api/reservations/estimation-prix').query({
        roomTypeId: 999999,
        dateArrivee: '2026-07-18',
        dateDepart: '2026-07-20',
      });
      expect(res.status).toBe(404);
    });

    it('renvoie 400 si dateDepart n’est pas postérieure à dateArrivee', async () => {
      const res = await client.get('/api/reservations/estimation-prix').query({
        roomTypeId,
        dateArrivee: '2026-07-20',
        dateDepart: '2026-07-18',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('PRICING-001C — Occupancy-Aware Pricing', () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    let roomTypeId: number;
    let roomId: number;
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
      const token = await loginAs(app.getHttpServer(), 'reception');
      client = authedRequest(app.getHttpServer(), token);

      const roomType = await prisma.roomType.create({
        data: {
          nom: 'TEST-PRICING-001C',
          prixBase: 400,
          capacite: 2,
          prixDemiPension: 150,
          prixPensionComplete: 200,
          prixPetitDejeuner: 50,
        },
      });
      roomTypeId = roomType.id;

      const room = await prisma.room.create({
        data: { numero: `TEST-PRICING-001C-${Date.now()}`, roomTypeId },
      });
      roomId = room.id;
    });

    afterAll(async () => {
      await prisma.roomNight.deleteMany({ where: { roomId } });
      await prisma.reservation.deleteMany({ where: { roomId } });
      await prisma.room.deleteMany({ where: { id: roomId } });
      await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
      await app.close();
    });

    it('400 DH, capacité 2, 1 occupant, ROOM_ONLY => 400', async () => {
      const res = await client.post('/api/reservations').send({
        roomId,
        dateArrivee: '2026-09-01',
        dateDepart: '2026-09-02',
        formule: 'ROOM_ONLY',
        nombreOccupants: 1,
        guest: { nom: 'Test', prenom: '1' },
      });
      const body = res.body as ApiReservationBody;
      expect(res.status).toBe(201);
      expect(Number(body.prixTotalFinal)).toBe(400);
      await prisma.roomNight.deleteMany({
        where: { reservationId: body.id },
      });
      await prisma.reservation.delete({ where: { id: body.id } });
    });

    it('400 DH, capacité 2, 1 occupant, BED_AND_BREAKFAST => 400', async () => {
      const res = await client.post('/api/reservations').send({
        roomId,
        dateArrivee: '2026-09-01',
        dateDepart: '2026-09-02',
        formule: 'BED_AND_BREAKFAST',
        nombreOccupants: 1,
        guest: { nom: 'Test', prenom: '2' },
      });
      const body = res.body as ApiReservationBody;
      expect(res.status).toBe(201);
      expect(Number(body.prixTotalFinal)).toBe(400);
      await prisma.roomNight.deleteMany({
        where: { reservationId: body.id },
      });
      await prisma.reservation.delete({ where: { id: body.id } });
    });

    it('400 DH, capacité 2, 1 occupant, HALF_BOARD 150 => 550', async () => {
      const res = await client.post('/api/reservations').send({
        roomId,
        dateArrivee: '2026-09-01',
        dateDepart: '2026-09-02',
        formule: 'HALF_BOARD',
        nombreOccupants: 1,
        guest: { nom: 'Test', prenom: '3' },
      });
      const body = res.body as ApiReservationBody;
      expect(res.status).toBe(201);
      expect(Number(body.prixTotalFinal)).toBe(550);
      await prisma.roomNight.deleteMany({
        where: { reservationId: body.id },
      });
      await prisma.reservation.delete({ where: { id: body.id } });
    });

    it('même chambre, 2 occupants, HALF_BOARD 150 => 700', async () => {
      const res = await client.post('/api/reservations').send({
        roomId,
        dateArrivee: '2026-09-01',
        dateDepart: '2026-09-02',
        formule: 'HALF_BOARD',
        nombreOccupants: 2,
        guest: { nom: 'Test', prenom: '4' },
      });
      const body = res.body as ApiReservationBody;
      expect(res.status).toBe(201);
      expect(Number(body.prixTotalFinal)).toBe(700);
      await prisma.roomNight.deleteMany({
        where: { reservationId: body.id },
      });
      await prisma.reservation.delete({ where: { id: body.id } });
    });

    it('HB sans nombreOccupants => rejet validation', async () => {
      const res = await client.post('/api/reservations').send({
        roomId,
        dateArrivee: '2026-09-01',
        dateDepart: '2026-09-02',
        formule: 'HALF_BOARD',
        guest: { nom: 'Test', prenom: '5' },
      });
      const body = res.body as ApiErrorBody;
      expect(res.status).toBe(400);
      expect(body.message).toContain(
        'nombreOccupants est obligatoire pour les formules HALF_BOARD et FULL_BOARD',
      );
    });

    it('FB sans nombreOccupants => rejet validation', async () => {
      const res = await client.post('/api/reservations').send({
        roomId,
        dateArrivee: '2026-09-01',
        dateDepart: '2026-09-02',
        formule: 'FULL_BOARD',
        guest: { nom: 'Test', prenom: '6' },
      });
      const body = res.body as ApiErrorBody;
      expect(res.status).toBe(400);
      expect(body.message).toContain(
        'nombreOccupants est obligatoire pour les formules HALF_BOARD et FULL_BOARD',
      );
    });

    it('RO sans nombreOccupants => comportement existant conservé', async () => {
      const res = await client.post('/api/reservations').send({
        roomId,
        dateArrivee: '2026-09-01',
        dateDepart: '2026-09-02',
        formule: 'ROOM_ONLY',
        guest: { nom: 'Test', prenom: '7' },
      });
      const body = res.body as ApiReservationBody;
      expect(res.status).toBe(201);
      expect(Number(body.prixTotalFinal)).toBe(400);
      await prisma.roomNight.deleteMany({
        where: { reservationId: body.id },
      });
      await prisma.reservation.delete({ where: { id: body.id } });
    });

    it('B&B sans nombreOccupants => comportement existant conservé', async () => {
      const res = await client.post('/api/reservations').send({
        roomId,
        dateArrivee: '2026-09-01',
        dateDepart: '2026-09-02',
        formule: 'BED_AND_BREAKFAST',
        guest: { nom: 'Test', prenom: '8' },
      });
      const body = res.body as ApiReservationBody;
      expect(res.status).toBe(201);
      expect(Number(body.prixTotalFinal)).toBe(400);
      await prisma.roomNight.deleteMany({
        where: { reservationId: body.id },
      });
      await prisma.reservation.delete({ where: { id: body.id } });
    });

    it('Booking Engine : même logique que réception', async () => {
      // Pour une disponibilité publique en HB sans nombreOccupants => 400
      const getRes = await client.get('/api/booking/availability').query({
        dateArrivee: '2026-09-01',
        dateDepart: '2026-09-02',
        roomTypeId,
        formule: 'HALF_BOARD',
      });
      const getResBody = getRes.body as ApiErrorBody;
      expect(getRes.status).toBe(400);
      expect(getResBody.message).toContain(
        'nombreOccupants est obligatoire pour les formules HALF_BOARD et FULL_BOARD',
      );

      // Pour une disponibilité publique en HB avec 1 occupant => 550
      const getResOk = await client.get('/api/booking/availability').query({
        dateArrivee: '2026-09-01',
        dateDepart: '2026-09-02',
        roomTypeId,
        formule: 'HALF_BOARD',
        nombreOccupants: 1,
      });
      const getResOkBody = getResOk.body as ApiAvailabilityBody;
      expect(getResOk.status).toBe(200);
      expect(Number(getResOkBody[0].prixTotalEstime)).toBe(550);

      // Création publique en HB sans nombreOccupants => 400
      const postRes = await client.post('/api/booking/reservations').send({
        dateArrivee: '2026-09-01',
        dateDepart: '2026-09-02',
        roomTypeId,
        formule: 'HALF_BOARD',
        guest: {
          nom: 'Public',
          prenom: 'Test',
          email: 'test@example.com',
          telephone: '0600000000',
        },
      });
      const postResBody = postRes.body as ApiErrorBody;
      expect(postRes.status).toBe(400);
      expect(postResBody.message).toContain(
        'nombreOccupants est obligatoire pour les formules HALF_BOARD et FULL_BOARD',
      );
    });

    it('vérifier qu’une réservation existante n’est jamais recalculée automatiquement', async () => {
      // Simule une réservation legacy (créée en BD sans nombreOccupants)
      const res1 = await client.post('/api/reservations').send({
        roomId,
        dateArrivee: '2026-09-10',
        dateDepart: '2026-09-11',
        formule: 'ROOM_ONLY', // Permet de passer la validation
        guest: { nom: 'Legacy', prenom: 'Test' },
      });
      const body1 = res1.body as ApiReservationBody;
      const reservationId = body1.id;

      // On la met à jour en BD pour simuler un historique corrompu (formule=HALF_BOARD, prixTotalCalcule=700, prixTotalFinal=700, nombreOccupants=null)
      await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          formule: 'HALF_BOARD',
          prixTotalCalcule: 700,
          prixTotalFinal: 700,
          nombreOccupants: null,
          ajustementManuel: false,
        },
      });

      // La réception modifie les dates
      const patchRes = await client
        .patch(`/api/reservations/${reservationId}`)
        .send({
          dateArrivee: '2026-09-11',
          dateDepart: '2026-09-12',
        });

      const patchBody = patchRes.body as ApiReservationBody;
      expect(patchRes.status).toBe(200);
      // Le prix final d'une réservation HB legacy (nombreOccupants = null)
      // ne doit jamais être écrasé à la baisse même lors d'un recalcul.
      expect(Number(patchBody.prixTotalFinal)).toBe(700);
      expect(Number(patchBody.prixTotalCalcule)).toBe(700);

      await prisma.roomNight.deleteMany({ where: { reservationId } });
      await prisma.reservation.delete({ where: { id: reservationId } });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PRICING-001E.1 — GET /reservations/estimation-prix + nombreOccupants
  // Vérifie que le bridge contrôleur → service transmet correctement les
  // occupants et que le DTO rejette HB/FB sans valeur.
  // ─────────────────────────────────────────────────────────────────────────
  describe('PRICING-001E.1 — estimation-prix avec nombreOccupants', () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    let roomTypeId: number;
    let client: ReturnType<typeof authedRequest>;

    const PRIX_BASE_E1 = 400;
    const PRIX_HB = 150;
    const PRIX_FB = 200;

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
      const token = await loginAs(app.getHttpServer(), 'reception');
      client = authedRequest(app.getHttpServer(), token);

      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-PRICING-001E1-${Date.now()}`,
          prixBase: PRIX_BASE_E1,
          capacite: 3,
          prixDemiPension: PRIX_HB,
          prixPensionComplete: PRIX_FB,
          prixPetitDejeuner: 50,
        },
      });
      roomTypeId = roomType.id;
    });

    afterAll(async () => {
      await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
      await app.close();
    });

    it('HB + 1 occupant => prixEstime = base + 1×prixDemiPension', async () => {
      const res = await client
        .get('/api/reservations/estimation-prix')
        .query({
          roomTypeId,
          dateArrivee: '2026-10-01',
          dateDepart: '2026-10-02',
          formule: 'HALF_BOARD',
          nombreOccupants: 1,
        });
      expect(res.status).toBe(200);
      expect(Number((res.body as { prixEstime: string }).prixEstime)).toBe(
        PRIX_BASE_E1 + 1 * PRIX_HB,
      );
    });

    it('HB + 2 occupants => prixEstime = base + 2×prixDemiPension', async () => {
      const res = await client
        .get('/api/reservations/estimation-prix')
        .query({
          roomTypeId,
          dateArrivee: '2026-10-01',
          dateDepart: '2026-10-02',
          formule: 'HALF_BOARD',
          nombreOccupants: 2,
        });
      expect(res.status).toBe(200);
      expect(Number((res.body as { prixEstime: string }).prixEstime)).toBe(
        PRIX_BASE_E1 + 2 * PRIX_HB,
      );
    });

    it('FB + 2 occupants => prixEstime = base + 2×prixPensionComplete', async () => {
      const res = await client
        .get('/api/reservations/estimation-prix')
        .query({
          roomTypeId,
          dateArrivee: '2026-10-01',
          dateDepart: '2026-10-02',
          formule: 'FULL_BOARD',
          nombreOccupants: 2,
        });
      expect(res.status).toBe(200);
      expect(Number((res.body as { prixEstime: string }).prixEstime)).toBe(
        PRIX_BASE_E1 + 2 * PRIX_FB,
      );
    });

    it('HB sans nombreOccupants => 400 (validation DTO)', async () => {
      const res = await client
        .get('/api/reservations/estimation-prix')
        .query({
          roomTypeId,
          dateArrivee: '2026-10-01',
          dateDepart: '2026-10-02',
          formule: 'HALF_BOARD',
          // nombreOccupants intentionnellement absent
        });
      expect(res.status).toBe(400);
      const body = res.body as ApiErrorBody;
      const messages = Array.isArray(body.message)
        ? body.message
        : [body.message];
      expect(messages.some((m) => /nombreOccupants/i.test(m))).toBe(true);
    });
  });
});
