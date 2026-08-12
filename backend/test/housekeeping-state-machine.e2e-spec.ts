import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { HousekeepingTaskService } from './../src/modules/housekeeping/housekeeping-task.service';
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
  let receptionUserId: number;

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
    receptionUserId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'reception@makarim.test' },
        select: { id: true },
      })
    ).id;

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
        nombreOccupants: 1,
        guest: { nom: 'Machine', prenom: 'Etats' },
      });
      expect(checkin.status).toBe(201);
      const stayId = (checkin.body as StayResponse).id;

      const roomsAfterCheckin = await client.get('/api/rooms');
      const ours = (roomsAfterCheckin.body as RoomResponse[]).find(
        (r) => r.id === roomId,
      );
      expect(ours!.statut).toBe('OCCUPEE');

      // Solde jamais réglé dans ce test (hors périmètre — machine à états
      // des chambres) : check-out forcé (CH-005, client = Administrateur ici).
      const checkout = await client.post(`/api/checkout/${stayId}`).send({
        force: true,
        motif: 'Nettoyage de fixture de test (housekeeping e2e)',
      });
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
      expect(log!.motif).toContain('Checkout');
    },
  );

  it('converge après une panne post-checkout sans doubler le séjour ni la tâche', async () => {
    const roomId = await createRoom();
    const taskService = app.get(HousekeepingTaskService);
    const checkin = await client.post('/api/checkin/walk-in').send({
      roomId,
      dateCheckoutPrevue: new Date(Date.now() + 2 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      nombreOccupants: 1,
      guest: { nom: 'Convergence', prenom: 'Checkout' },
    });
    const stayId = (checkin.body as StayResponse).id;

    const failure = jest
      .spyOn(taskService, 'handleCheckoutEffectue')
      .mockRejectedValueOnce(new Error('panne Housekeeping post-commit'));
    const checkout = await client.post(`/api/checkout/${stayId}`).send({
      force: true,
      motif: 'Preuve convergence checkout housekeeping',
    });
    expect(checkout.status).toBe(201);
    failure.mockRestore();

    const persistedStay = await prisma.stay.findUniqueOrThrow({
      where: { id: stayId },
    });
    expect(persistedStay.statut).toBe('CHECKOUT');
    expect(await prisma.roomNight.count({ where: { stayId } })).toBe(0);
    expect(
      (await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).statut,
    ).toBe('A_NETTOYER');
    expect(await prisma.housekeepingTask.count({ where: { roomId } })).toBe(0);

    await taskService.reconcileDirtyRooms(0);
    await taskService.handleCheckoutEffectue(stayId, roomId);
    await taskService.handleCheckoutEffectue(stayId, roomId);

    const tasks = await prisma.housekeepingTask.findMany({
      where: { roomId },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].activeRoomKey).toBe(roomId);
    expect(tasks[0].sourceEventKey).toBe(`checkout:${stayId}`);
    expect(
      await prisma.stay.count({ where: { id: stayId, statut: 'CHECKOUT' } }),
    ).toBe(1);
  });

  it("refuse de rattacher un checkout à la tâche active d'un autre événement", async () => {
    const roomId = await createRoom();
    const taskService = app.get(HousekeepingTaskService);
    await prisma.room.update({
      where: { id: roomId },
      data: { statut: 'A_NETTOYER' },
    });
    const foreignTask = await prisma.housekeepingTask.create({
      data: {
        roomId,
        statut: 'A_FAIRE',
        origine: 'CHECKOUT',
        sourceEventKey: 'checkout:999999',
        activeRoomKey: roomId,
      },
    });

    await expect(
      taskService.handleCheckoutEffectue(888888, roomId),
    ).rejects.toThrow('possède déjà une tâche active');

    const persisted = await prisma.housekeepingTask.findUniqueOrThrow({
      where: { id: foreignTask.id },
    });
    expect(persisted.sourceEventKey).toBe('checkout:999999');
    expect(persisted.origine).toBe('CHECKOUT');
  });

  // B0.4A (DESIGN-004B, confinement legacy) — le cycle À nettoyer → En
  // nettoyage → Libre&propre ne passe plus par un PATCH manuel répété :
  // EN_NETTOYAGE et LIBRE_PROPRE ont été retirés de MANUAL_TARGETS.
  // A_NETTOYER reste le seul déclencheur manuel légitime (signalement), le
  // reste du cycle passe exclusivement par HousekeepingTaskService
  // (start/complete/validate) — seul chemin restant vers LIBRE_PROPRE.
  it('rejette EN_NETTOYAGE et LIBRE_PROPRE via PATCH manuel ; seul HousekeepingTask mène à Libre&propre', async () => {
    const roomId = await createRoom();

    const toDirty = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'A_NETTOYER' });
    expect(toDirty.status).toBe(200);

    const toCleaningRejected = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'EN_NETTOYAGE' });
    expect(toCleaningRejected.status).toBe(400);

    const toCleanRejected = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'LIBRE_PROPRE' });
    expect(toCleanRejected.status).toBe(400);

    // La chambre reste A_NETTOYER : les deux tentatives ont bien été
    // rejetées avant toute écriture.
    const stillDirty = await prisma.room.findUniqueOrThrow({
      where: { id: roomId },
    });
    expect(stillDirty.statut).toBe('A_NETTOYER');

    // Seul chemin restant vers Libre&propre : HousekeepingTask complet.
    const task = await client
      .post('/api/housekeeping/tasks')
      .send({ roomId, motif: 'Tâche de test B0.4A (état machine)' });
    expect(task.status).toBe(201);
    const taskId = (task.body as { id: number }).id;

    // Assignation à Réception avant démarrage : start() exige task.statut
    // === AFFECTEE, quel que soit l'acteur (même housekeeping:control ne
    // dispense pas de cette assignation) — puis admin exécute le reste via
    // control, distinct de l'assigné pour ne pas heurter l'interdiction
    // d'auto-validation.
    const assign = await client
      .patch(`/api/housekeeping/tasks/${taskId}/assignment`)
      .send({ assignedUserId: receptionUserId });
    expect(assign.status).toBe(200);

    const start = await client.post(`/api/housekeeping/tasks/${taskId}/start`);
    expect(start.status).toBe(201);
    expect(
      (await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).statut,
    ).toBe('EN_NETTOYAGE');

    const complete = await client.post(
      `/api/housekeeping/tasks/${taskId}/complete`,
    );
    expect(complete.status).toBe(201);

    const validate = await client
      .post(`/api/housekeeping/tasks/${taskId}/validate`)
      .send({ motif: 'Contrôle admin (test B0.4A état machine)' });
    expect(validate.status).toBe(201);

    const toClean = await prisma.room.findUniqueOrThrow({
      where: { id: roomId },
    });
    expect(toClean.statut).toBe('LIBRE_PROPRE');
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

      const checkin = await client
        .post(`/api/checkin/${reservationId}`)
        .send({ nombreOccupants: 1 });
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
      nombreOccupants: 1,
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

    // Nettoyage : check-out réel pour ne pas laisser un séjour actif
    // orphelin. Solde jamais réglé : check-out forcé (CH-005, client =
    // Administrateur ici).
    await client.post(`/api/checkout/${stayId}`).send({
      force: true,
      motif: 'Nettoyage de fixture de test (housekeeping e2e)',
    });
  });
});
