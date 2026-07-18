import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

// Preuve des deux verrous de concurrence du module checkin
// (docs/plan-execution-claude-code.md §8) : aucun des deux ne doit jamais
// laisser réussir deux requêtes concurrentes qui se disputent la même
// ressource. Vrais appels HTTP contre une vraie base MySQL, aucun mock.
describe('Checkin — verrouillages de concurrence (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roomTypeId: number;
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
      data: { nom: 'TEST-CHECKIN-CONC-TYPE', prixBase: 300, capacite: 2 },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    await prisma.roomNight.deleteMany({
      where: { room: { roomTypeId } },
    });
    await prisma.folioLine.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.folio.deleteMany({
      where: { stay: { room: { roomTypeId } } },
    });
    await prisma.stay.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.reservation.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.room.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  it("ne transforme qu'une seule fois une réservation en séjour même avec deux check-ins simultanés", async () => {
    const room = await prisma.room.create({
      data: { numero: `TEST-CHECKIN-CONC-${Date.now()}`, roomTypeId },
    });

    const createRes = await client.post('/api/reservations').send({
      roomId: room.id,
      dateArrivee: '2027-02-10',
      dateDepart: '2027-02-12',
      guest: { nom: 'Double', prenom: 'Checkin' },
    });
    const reservationId = (createRes.body as { id: number }).id;

    const [resA, resB] = await Promise.all([
      client.post(`/api/checkin/${reservationId}`).send(),
      client.post(`/api/checkin/${reservationId}`).send(),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const stays = await prisma.stay.findMany({ where: { reservationId } });
    expect(stays).toHaveLength(1);
  });

  it('ne laisse occuper la même chambre par deux walk-in concurrents que pour un seul', async () => {
    const room = await prisma.room.create({
      data: { numero: `TEST-CHECKIN-CONC-WI-${Date.now()}`, roomTypeId },
    });

    const payload = (nom: string) => ({
      roomId: room.id,
      dateCheckoutPrevue: '2027-03-15',
      guest: { nom, prenom: 'WalkIn' },
    });

    const [resA, resB] = await Promise.all([
      client.post('/api/checkin/walk-in').send(payload('Poste-A')),
      client.post('/api/checkin/walk-in').send(payload('Poste-B')),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const activeStays = await prisma.stay.findMany({
      where: { roomId: room.id, statut: 'EN_COURS' },
    });
    expect(activeStays).toHaveLength(1);

    const nights = await prisma.roomNight.findMany({
      where: { roomId: room.id },
    });
    // Une seule des deux réservations de nuits doit avoir réussi : pas de
    // doublon sur (roomId, date).
    expect(new Set(nights.map((n) => n.date.toISOString())).size).toBe(
      nights.length,
    );
    expect(nights.length).toBeGreaterThan(0);
  });
});
