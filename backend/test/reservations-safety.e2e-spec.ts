import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

interface ReservationResponse {
  id: number;
  roomId: number;
  statut: string;
}

describe('Reservations — sécurité des déplacements (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roomTypeId: number;
  let roomAId: number;
  let roomBId: number;
  let reception: ReturnType<typeof authedRequest>;
  let admin: ReturnType<typeof authedRequest>;

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
    reception = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'reception'),
    );
    admin = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'admin'),
    );

    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-RES-SAFETY-${Date.now()}`,
        prixBase: 300,
        capacite: 2,
      },
    });
    roomTypeId = roomType.id;
    const [roomA, roomB] = await Promise.all([
      prisma.room.create({
        data: { numero: `TEST-SAFE-A-${Date.now()}`, roomTypeId },
      }),
      prisma.room.create({
        data: { numero: `TEST-SAFE-B-${Date.now()}`, roomTypeId },
      }),
    ]);
    roomAId = roomA.id;
    roomBId = roomB.id;
  });

  afterAll(async () => {
    const reservations = await prisma.reservation.findMany({
      where: { room: { roomTypeId } },
      select: { id: true, guestId: true },
    });
    const reservationIds = reservations.map(({ id }) => id);
    const guestIds = reservations.map(({ guestId }) => guestId);
    await prisma.notificationLog.deleteMany({
      where: { reservationId: { in: reservationIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { targetEntity: 'Reservation', targetId: { in: reservationIds } },
    });
    await prisma.roomNight.deleteMany({
      where: { reservationId: { in: reservationIds } },
    });
    await prisma.reservation.deleteMany({
      where: { id: { in: reservationIds } },
    });
    await prisma.guest.deleteMany({ where: { id: { in: guestIds } } });
    await prisma.room.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.delete({ where: { id: roomTypeId } });
    await app.close();
  });

  async function createReservation(day: number) {
    const response = await reception.post('/api/reservations').send({
      roomId: roomAId,
      dateArrivee: `2028-01-${String(day).padStart(2, '0')}`,
      dateDepart: `2028-01-${String(day + 2).padStart(2, '0')}`,
      guest: { nom: `Safety-${day}`, prenom: 'Test' },
    });
    expect(response.status).toBe(201);
    return response.body as ReservationResponse;
  }

  async function expectMoveForbidden(reservationId: number) {
    const response = await reception
      .patch(`/api/reservations/${reservationId}`)
      .send({
        roomId: roomBId,
        dateArrivee: '2028-02-01',
        dateDepart: '2028-02-03',
      });
    expect(response.status).toBe(409);
  }

  it('déplace une réservation CONFIRMEE lorsque les autres règles l’autorisent', async () => {
    const reservation = await createReservation(2);
    const response = await reception
      .patch(`/api/reservations/${reservation.id}`)
      .send({
        roomId: roomBId,
        dateArrivee: '2028-01-03',
        dateDepart: '2028-01-05',
      });

    expect(response.status).toBe(200);
    expect((response.body as ReservationResponse).roomId).toBe(roomBId);
    const nights = await prisma.roomNight.findMany({
      where: { reservationId: reservation.id },
    });
    expect(nights).toHaveLength(2);
    expect(nights.every(({ roomId }) => roomId === roomBId)).toBe(true);
  });

  it('refuse le déplacement d’une réservation NO_SHOW', async () => {
    const reservation = await createReservation(8);
    const noShow = await admin
      .post(`/api/reservations/${reservation.id}/no-show`)
      .send({ motif: 'Client absent sans prévenir' });
    expect(noShow.status).toBe(201);
    await expectMoveForbidden(reservation.id);
  });

  it('annule avec un motif valide puis refuse le déplacement ANNULEE', async () => {
    const reservation = await createReservation(14);

    const forbidden = await reception
      .delete(`/api/reservations/${reservation.id}`)
      .send({ motif: 'Demande explicite du client' });
    expect(forbidden.status).toBe(403);

    const cancelled = await admin
      .delete(`/api/reservations/${reservation.id}`)
      .send({ motif: 'Demande explicite du client' });
    expect(cancelled.status).toBe(200);
    expect((cancelled.body as ReservationResponse).statut).toBe('ANNULEE');
    await expectMoveForbidden(reservation.id);
  });
});
