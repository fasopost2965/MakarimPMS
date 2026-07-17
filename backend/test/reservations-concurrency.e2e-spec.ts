import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

// Preuve du verrouillage anti-double-réservation (docs/plan-execution-claude-code.md
// §8) : deux requêtes de création concurrentes sur la MÊME chambre et les
// MÊMES dates ne doivent jamais réussir toutes les deux. Ce test tape le vrai
// endpoint HTTP contre une vraie base MySQL (voir docker-compose.yml) —
// aucun mock — pour prouver que la contrainte unique RoomNight(roomId, date)
// protège réellement contre la race condition, pas seulement en apparence.
describe('Reservations — verrouillage anti-double-réservation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roomId: number;

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

    const roomType = await prisma.roomType.create({
      data: { nom: 'TEST-CONCURRENCY-TYPE', prixBase: 100, capacite: 2 },
    });
    const room = await prisma.room.create({
      data: { numero: `TEST-CONC-${Date.now()}`, roomTypeId: roomType.id },
    });
    roomId = room.id;
  });

  afterAll(async () => {
    await prisma.roomNight.deleteMany({ where: { roomId } });
    await prisma.reservation.deleteMany({ where: { roomId } });
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (room) {
      await prisma.room.delete({ where: { id: roomId } });
      await prisma.roomType.delete({ where: { id: room.roomTypeId } });
    }
    await app.close();
  });

  it("ne laisse réussir qu'une seule des deux créations concurrentes sur la même chambre/dates", async () => {
    const dateArrivee = '2027-01-10';
    const dateDepart = '2027-01-13'; // 3 nuits

    const payload = (nom: string) => ({
      roomId,
      dateArrivee,
      dateDepart,
      guest: { nom, prenom: 'Concurrence' },
    });

    const server = app.getHttpServer();

    const [resA, resB] = await Promise.all([
      request(server).post('/api/reservations').send(payload('Poste-A')),
      request(server).post('/api/reservations').send(payload('Poste-B')),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // Une des deux requêtes doit réussir (201), l'autre doit être rejetée
    // par le verrou (409 Conflict — contrainte unique RoomNight violée).
    expect(statuses).toEqual([201, 409]);

    // Vérification au niveau base : aucune nuit en double, une seule
    // réservation confirmée sur cette chambre pour ces dates.
    const nights = await prisma.roomNight.findMany({ where: { roomId } });
    expect(nights).toHaveLength(3);
    expect(new Set(nights.map((n) => n.date.toISOString())).size).toBe(3);

    const confirmedReservations = await prisma.reservation.findMany({
      where: { roomId, statut: 'CONFIRMEE' },
    });
    expect(confirmedReservations).toHaveLength(1);
  });
});
