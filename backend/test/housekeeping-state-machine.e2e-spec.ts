import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

interface RoomResponse {
  id: number;
  numero: string;
  statut: string;
}

interface StayResponse {
  id: number;
  roomId: number;
}

interface ReservationResponse {
  id: number;
}

// Machine à états complète du module housekeeping (cahier des charges §5.6
// Phase 2) : Libre&propre › Réservée › Occupée › Départ prévu › À nettoyer ›
// En nettoyage › Libre&propre, plus la branche En maintenance. Vrais appels
// HTTP contre une vraie base MySQL, aucun mock.
describe('Housekeeping — machine à états complète (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let client: ReturnType<typeof authedRequest>;
  let roomTypeId: number;

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
        nom: `TEST-HK-SM-TYPE-${Date.now()}`,
        prixBase: 350,
        capacite: 2,
      },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    await prisma.roomStatusLog.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.folioLine.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.folio.deleteMany({
      where: { stay: { room: { roomTypeId } } },
    });
    await prisma.roomNight.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.stay.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.reservation.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.room.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  async function createRoom() {
    const room = await prisma.room.create({
      data: { numero: `TEST-HK-SM-${Date.now()}-${Math.random()}`, roomTypeId },
    });
    return room.id;
  }

  it(
    "l'événement checkout.effectue fait passer automatiquement la chambre en À nettoyer " +
      '(sans PATCH manuel), et journalise la transition dans RoomStatusLog',
    async () => {
      const roomId = await createRoom();

      const checkin = await client.post('/api/checkin/walk-in').send({
        roomId,
        dateCheckoutPrevue: new Date(Date.now() + 2 * 86_400_000)
          .toISOString()
          .slice(0, 10),
        guest: { nom: 'Machine', prenom: 'Etats' },
      });
      expect(checkin.status).toBe(201);
      const stayId = (checkin.body as StayResponse).id;

      const roomsAfterCheckin = await client.get('/api/rooms');
      const ours = (roomsAfterCheckin.body as RoomResponse[]).find(
        (r) => r.id === roomId,
      );
      expect(ours!.statut).toBe('OCCUPEE');

      const checkout = await client.post(`/api/checkout/${stayId}`).send();
      expect(checkout.status).toBe(201);

      // Aucun appel PATCH manuel n'a eu lieu : la transition vient
      // uniquement de l'événement checkout.effectue émis par checkout().
      const room = await prisma.room.findUniqueOrThrow({
        where: { id: roomId },
      });
      expect(room.statut).toBe('A_NETTOYER');

      const log = await prisma.roomStatusLog.findFirst({
        where: { roomId, nouveauStatut: 'A_NETTOYER' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toBeDefined();
      expect(log!.ancienStatut).toBe('OCCUPEE');
      expect(log!.motif).toContain('Check-out');
    },
  );

  it('déroule le cycle de nettoyage manuel complet : À nettoyer → En nettoyage → Libre&propre', async () => {
    const roomId = await createRoom();

    const toDirty = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'A_NETTOYER' });
    expect(toDirty.status).toBe(200);

    const toCleaning = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'EN_NETTOYAGE' });
    expect(toCleaning.status).toBe(200);
    expect((toCleaning.body as RoomResponse).statut).toBe('EN_NETTOYAGE');

    const toClean = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'LIBRE_PROPRE' });
    expect(toClean.status).toBe(200);
    expect((toClean.body as RoomResponse).statut).toBe('LIBRE_PROPRE');
  });

  it(
    "une réservation arrivant aujourd'hui fait passer la chambre en Réservée au prochain " +
      'GET /rooms (rattrapage), puis en Occupée au check-in',
    async () => {
      const roomId = await createRoom();
      const today = new Date().toISOString().slice(0, 10);
      const departLater = new Date(Date.now() + 2 * 86_400_000)
        .toISOString()
        .slice(0, 10);

      const reservation = await client.post('/api/reservations').send({
        roomId,
        dateArrivee: today,
        dateDepart: departLater,
        guest: { nom: 'Rattrapage', prenom: 'Reservee' },
      });
      expect(reservation.status).toBe(201);
      const reservationId = (reservation.body as ReservationResponse).id;

      const roomsAfterCreate = await client.get('/api/rooms');
      const ours = (roomsAfterCreate.body as RoomResponse[]).find(
        (r) => r.id === roomId,
      );
      expect(ours!.statut).toBe('RESERVEE');

      const checkin = await client.post(`/api/checkin/${reservationId}`).send();
      expect(checkin.status).toBe(201);

      const room = await prisma.room.findUniqueOrThrow({
        where: { id: roomId },
      });
      expect(room.statut).toBe('OCCUPEE');
    },
  );

  it(
    "l'annulation d'une réservation du jour pendant qu'elle est Réservée fait revenir " +
      'la chambre à Libre&propre au prochain GET /rooms',
    async () => {
      const roomId = await createRoom();
      const today = new Date().toISOString().slice(0, 10);
      const departLater = new Date(Date.now() + 2 * 86_400_000)
        .toISOString()
        .slice(0, 10);

      const reservation = await client.post('/api/reservations').send({
        roomId,
        dateArrivee: today,
        dateDepart: departLater,
        guest: { nom: 'Annulation', prenom: 'MemeJour' },
      });
      const reservationId = (reservation.body as ReservationResponse).id;

      const roomsReserved = await client.get('/api/rooms');
      const reserved = (roomsReserved.body as RoomResponse[]).find(
        (r) => r.id === roomId,
      );
      expect(reserved!.statut).toBe('RESERVEE');

      const cancel = await client
        .delete(`/api/reservations/${reservationId}`)
        .send({ motif: 'Annulation test housekeeping e2e' });
      expect(cancel.status).toBe(200);

      const roomsAfterCancel = await client.get('/api/rooms');
      const freed = (roomsAfterCancel.body as RoomResponse[]).find(
        (r) => r.id === roomId,
      );
      expect(freed!.statut).toBe('LIBRE_PROPRE');
    },
  );

  it('refuse (409) tout changement manuel tant que la chambre est en Départ prévu', async () => {
    const roomId = await createRoom();

    const checkin = await client.post('/api/checkin/walk-in').send({
      roomId,
      dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
        .toISOString()
        .slice(0, 10),
      guest: { nom: 'Depart', prenom: 'Prevu' },
    });
    const stayId = (checkin.body as StayResponse).id;

    // Ramène artificiellement dateCheckoutPrevue à aujourd'hui pour simuler
    // "le jour du départ" — la validation métier interdit de le faire dès
    // la création (dateCheckoutPrevue doit être postérieure à aujourd'hui).
    await prisma.stay.update({
      where: { id: stayId },
      data: { dateCheckoutPrevue: new Date() },
    });

    const roomsAfterReconcile = await client.get('/api/rooms');
    const ours = (roomsAfterReconcile.body as RoomResponse[]).find(
      (r) => r.id === roomId,
    );
    expect(ours!.statut).toBe('DEPART_PREVU');

    // A_NETTOYER est une cible valide de la matrice depuis DEPART_PREVU
    // (c'est le chemin du check-out) : si ce PATCH est bloqué, c'est
    // uniquement grâce au garde-fou explicite d'updateStatus, pas à la
    // matrice — un test avec LIBRE_PROPRE comme cible serait bloqué par la
    // matrice de toute façon (LIBRE_PROPRE n'est pas atteignable depuis
    // DEPART_PREVU) et ne prouverait donc rien sur ce garde-fou spécifique.
    const blocked = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'A_NETTOYER' });
    expect(blocked.status).toBe(409);

    // Nettoyage : check-out réel pour ne pas laisser un séjour actif orphelin.
    await client.post(`/api/checkout/${stayId}`).send();
  });
});
