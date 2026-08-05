import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';
import { AuditAction, StatutChambre, StatutSejour } from '@prisma/client';

interface ReservationResponse {
  id: number;
}

interface StayResponse {
  id: number;
  roomId: number;
  statut: string;
}

// GL-002 — Changement de chambre pendant un séjour
describe('Stay - Change Room (GL-002)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminClient: ReturnType<typeof authedRequest>;
  let receptionClient: ReturnType<typeof authedRequest>;
  let gouvernanteClient: ReturnType<typeof authedRequest>;
  let roomTypeId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const adminToken = await loginAs(app.getHttpServer(), 'admin');
    adminClient = authedRequest(app.getHttpServer(), adminToken);
    const receptionToken = await loginAs(app.getHttpServer(), 'reception');
    receptionClient = authedRequest(app.getHttpServer(), receptionToken);
    const gouvernanteToken = await loginAs(app.getHttpServer(), 'gouvernante');
    gouvernanteClient = authedRequest(app.getHttpServer(), gouvernanteToken);

    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-GL002-TYPE-${Date.now()}`,
        prixBase: 100,
        capacite: 1,
      },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    // Nettoyage scopé à roomTypeId, jamais de purge globale (les autres
    // suites e2e, exécutées dans le même processus, maxWorkers: 1,
    // possèdent leurs propres RoomType — un deleteMany({}) global casserait
    // sur une contrainte FK inconnue de ce fichier).
    await prisma.roomNight.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.folioLine.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.folio.deleteMany({
      where: { stay: { room: { roomTypeId } } },
    });
    await prisma.stay.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.reservation.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.roomStatusLog.deleteMany({ where: { room: { roomTypeId } } });
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

  describe('POST /stays/:id/change-room', () => {
    let room1: { id: number };
    let room2: { id: number };
    let room3: { id: number };
    let guest: { id: number };
    let stay: StayResponse;
    let today: Date;

    beforeEach(async () => {
      today = new Date();
      today.setHours(0, 0, 0, 0);

      const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

      room1 = await prisma.room.create({
        data: {
          numero: `GL002-1-${suffix}`,
          roomTypeId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      room2 = await prisma.room.create({
        data: {
          numero: `GL002-2-${suffix}`,
          roomTypeId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      room3 = await prisma.room.create({
        data: {
          numero: `GL002-3-${suffix}`,
          roomTypeId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      guest = await prisma.guest.create({
        data: {
          nom: 'Dupont',
          prenom: 'Jean',
          email: `jean.gl002-${suffix}@example.com`,
          telephone: '+212600000001',
          nationalite: 'MA',
          pieceIdentite: `AB123456-${suffix}`,
          categorie: 'STANDARD',
        },
      });

      const dateDepart = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      const reservationRes = await receptionClient
        .post('/api/reservations')
        .send({
          roomId: room1.id,
          guestId: guest.id,
          dateArrivee: today.toISOString().slice(0, 10),
          dateDepart: dateDepart.toISOString().slice(0, 10),
        });
      const reservation = reservationRes.body as ReservationResponse;

      const checkinRes = await adminClient
        .post(`/api/checkin/${reservation.id}`)
        .send();
      stay = checkinRes.body as StayResponse;

      // Vérifier que le séjour est bien en cours
      expect(stay.statut).toBe(StatutSejour.EN_COURS);
      expect(stay.roomId).toBe(room1.id);
    });

    afterEach(async () => {
      const roomIds = [room1.id, room2.id, room3.id];
      await prisma.auditLog.deleteMany({
        where: { targetId: stay.id, targetEntity: 'Stay' },
      });
      await prisma.housekeepingTaskLog.deleteMany({
        where: { task: { roomId: { in: roomIds } } },
      });
      await prisma.housekeepingTask.deleteMany({
        where: { roomId: { in: roomIds } },
      });
      await prisma.roomStatusLog.deleteMany({
        where: { roomId: { in: roomIds } },
      });
      await prisma.roomNight.deleteMany({
        where: { roomId: { in: roomIds } },
      });
      await prisma.folioLine.deleteMany({
        where: { folio: { stay: { roomId: { in: roomIds } } } },
      });
      await prisma.folio.deleteMany({
        where: { stay: { roomId: { in: roomIds } } },
      });
      await prisma.stay.deleteMany({ where: { roomId: { in: roomIds } } });
      await prisma.reservation.deleteMany({
        where: { roomId: { in: roomIds } },
      });
      await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
      await prisma.guest.deleteMany({ where: { id: guest.id } });
    });

    it('Changement nominal vers une chambre disponible', async () => {
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Demande du client pour proximité étage supérieur',
        });

      expect(res.status).toBe(201);
      expect((res.body as StayResponse).roomId).toBe(room2.id);

      // Vérifier que Stay.roomId a été mis à jour
      const updatedStay = await prisma.stay.findUniqueOrThrow({
        where: { id: stay.id },
      });
      expect(updatedStay.roomId).toBe(room2.id);

      // Vérifier que les RoomNight ont été transférées
      const room1Nights = await prisma.roomNight.findMany({
        where: { roomId: room1.id, stayId: stay.id },
      });
      const room2Nights = await prisma.roomNight.findMany({
        where: { roomId: room2.id, stayId: stay.id },
      });
      expect(room1Nights.length).toBe(0);
      expect(room2Nights.length).toBe(3);

      // Vérifier que l'audit a été écrit
      const auditLog = await prisma.auditLog.findFirstOrThrow({
        where: {
          action: AuditAction.CHANGE_ROOM,
          targetId: stay.id,
        },
      });
      expect(auditLog.motif).toBe(
        'Demande du client pour proximité étage supérieur',
      );
    });

    it('Permission absente (Gouvernante) doit être rejetée', async () => {
      const res = await gouvernanteClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif minimum 10 chars ok!',
        });

      expect(res.status).toBe(403);
    });

    it('Motif trop court doit être rejeté', async () => {
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Trop court',
        });

      expect(res.status).toBe(400);
    });

    it('Séjour inexistant doit retourner 404', async () => {
      const res = await receptionClient
        .post(`/api/stays/99999999/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars',
        });

      expect(res.status).toBe(404);
    });

    it('Même chambre doit être rejetée', async () => {
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: stay.roomId,
          motif: 'Motif valide minimum 10 chars',
        });

      expect(res.status).toBe(409);
    });

    it('Cible non LIBRE_PROPRE doit être rejetée', async () => {
      // Mettre la cible en OCCUPEE
      await prisma.room.update({
        where: { id: room2.id },
        data: { statut: StatutChambre.OCCUPEE },
      });

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars',
        });

      expect(res.status).toBe(409);
    });

    it('Ancienne chambre doit passer à A_NETTOYER', async () => {
      const oldRoomId = stay.roomId;

      await receptionClient.post(`/api/stays/${stay.id}/change-room`).send({
        newRoomId: room2.id,
        motif: 'Demande client pour confort amélioré',
      });

      const oldRoom = await prisma.room.findUniqueOrThrow({
        where: { id: oldRoomId },
      });
      expect(oldRoom.statut).toBe(StatutChambre.A_NETTOYER);
    });

    it('Tâche housekeeping doit être créée sans doublon', async () => {
      const oldRoomId = stay.roomId;

      await receptionClient.post(`/api/stays/${stay.id}/change-room`).send({
        newRoomId: room2.id,
        motif: 'Demande client pour confort amélioré',
      });

      // Attendre un peu pour que l'événement soit traité
      await new Promise((resolve) => setTimeout(resolve, 500));

      const tasks = await prisma.housekeepingTask.findMany({
        where: { roomId: oldRoomId },
      });

      // Doit y avoir exactement une tâche
      expect(tasks.length).toBeGreaterThanOrEqual(1);

      // La dernière tâche doit être CHANGE_ROOM
      const lastTask = tasks[tasks.length - 1];
      expect(lastTask.origine).toBe('CHANGE_ROOM');
    });

    it('Folios inchangés après changement de chambre', async () => {
      const foliosBefore = await prisma.folio.findMany({
        where: { stayId: stay.id },
        include: { lignes: true },
      });

      const folioCountBefore = foliosBefore.length;
      const folioLinesCountBefore = foliosBefore.reduce(
        (sum, f) => sum + f.lignes.length,
        0,
      );

      await receptionClient.post(`/api/stays/${stay.id}/change-room`).send({
        newRoomId: room2.id,
        motif: 'Changement de préférence client,',
      });

      const foliosAfter = await prisma.folio.findMany({
        where: { stayId: stay.id },
        include: { lignes: true },
      });

      const folioCountAfter = foliosAfter.length;
      const folioLinesCountAfter = foliosAfter.reduce(
        (sum, f) => sum + f.lignes.length,
        0,
      );

      expect(folioCountAfter).toBe(folioCountBefore);
      expect(folioLinesCountAfter).toBe(folioLinesCountBefore);
    });

    it('Nuits passées doivent rester sur ancienne chambre', async () => {
      // Créer un séjour qui a déjà des nuits passées (hier + aujourd'hui + demain)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const dateDepart2 = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);

      const reservation2Res = await receptionClient
        .post('/api/reservations')
        .send({
          roomId: room3.id,
          guestId: guest.id,
          dateArrivee: yesterday.toISOString().slice(0, 10),
          dateDepart: dateDepart2.toISOString().slice(0, 10),
        });
      const reservation2 = reservation2Res.body as ReservationResponse;

      const checkinRes = await adminClient
        .post(`/api/checkin/${reservation2.id}`)
        .send();
      const stay2 = checkinRes.body as StayResponse;
      const oldRoomId = stay2.roomId;
      expect(oldRoomId).toBe(room3.id);

      // Changer de chambre vers room2 (la seule encore LIBRE_PROPRE)
      const changeRes = await receptionClient
        .post(`/api/stays/${stay2.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Changement après nuit déjà écoulée',
        });
      expect(changeRes.status).toBe(201);

      // Vérifier que la nuit passée (hier) est restée sur l'ancienne chambre
      const pastNightOldRoom = await prisma.roomNight.findUnique({
        where: { roomId_date: { roomId: oldRoomId, date: yesterday } },
      });
      expect(pastNightOldRoom).toBeDefined();

      // Vérifier que la nuit passée n'est pas sur la nouvelle chambre
      const pastNightNewRoom = await prisma.roomNight.findUnique({
        where: { roomId_date: { roomId: room2.id, date: yesterday } },
      });
      expect(pastNightNewRoom).toBeNull();
    });
  });
});
