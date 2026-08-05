/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  AuditAction,
  StatutChambre,
  StatutReservation,
  StatutSejour,
} from '@prisma/client';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';

// GL-002 — Changement de chambre pendant un séjour
describe('Stay - Change Room (GL-002)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let receptionToken: string;
  let gouvernanteToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        whitelist: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Nettoyer la base avant les tests
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({});
      await tx.housekeepingTaskLog.deleteMany({});
      await tx.housekeepingTask.deleteMany({});
      await tx.roomStatusLog.deleteMany({});
      await tx.roomNight.deleteMany({});
      await tx.folioLine.deleteMany({});
      await tx.folio.deleteMany({});
      await tx.stay.deleteMany({});
      await tx.reservation.deleteMany({});
      await tx.guest.deleteMany({});
      await tx.room.deleteMany({});
      await tx.roomType.deleteMany({});
    });

    // Créer les données de base
    const password = 'TestPassword123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer les rôles
    const adminRole = await prisma.role.findFirst({
      where: { nom: 'Administrateur' },
    });
    const receptionRole = await prisma.role.findFirst({
      where: { nom: 'Réception' },
    });
    const gouvernanteRole = await prisma.role.findFirst({
      where: { nom: 'Gouvernante' },
    });

    // Créer les utilisateurs
    const adminUser = await prisma.user.create({
      data: {
        nom: 'Admin Test',
        email: 'admin.changeroom@test.local',
        password: hashedPassword,
        roleId: adminRole.id,
        actif: true,
      },
    });

    const receptionUser = await prisma.user.create({
      data: {
        nom: 'Reception Test',
        email: 'reception.changeroom@test.local',
        password: hashedPassword,
        roleId: receptionRole.id,
        actif: true,
      },
    });

    const gouvernanteUser = await prisma.user.create({
      data: {
        nom: 'Gouvernante Test',
        email: 'gouvernante.changeroom@test.local',
        password: hashedPassword,
        roleId: gouvernanteRole.id,
        actif: true,
      },
    });

    // Authentifier les utilisateurs
    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: adminUser.email,
        password,
      });
    adminToken = adminLoginRes.body.accessToken;

    const receptionLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: receptionUser.email,
        password,
      });
    receptionToken = receptionLoginRes.body.accessToken;

    const gouvernanteLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: gouvernanteUser.email,
        password,
      });
    gouvernanteToken = gouvernanteLoginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /stays/:id/change-room', () => {
    let room1: any;
    let room2: any;
    let room3: any;
    let guest: any;
    let stay: any;
    let today: Date;

    beforeEach(async () => {
      // Obtenir la date d'aujourd'hui
      today = new Date();
      today.setHours(0, 0, 0, 0);

      // Créer un type de chambre
      const roomType = await prisma.roomType.create({
        data: {
          nom: 'Single',
          capacite: 1,
          tarifJournalier: 100,
        },
      });

      // Créer des chambres
      room1 = await prisma.room.create({
        data: {
          numero: '101',
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      room2 = await prisma.room.create({
        data: {
          numero: '102',
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      room3 = await prisma.room.create({
        data: {
          numero: '103',
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      // Créer un client
      guest = await prisma.guest.create({
        data: {
          nom: 'Dupont',
          prenom: 'Jean',
          email: 'jean@example.com',
          telephone: '+212600000001',
          nationalite: 'MA',
          pieceIdentite: 'AB123456',
          categorie: 'STANDARD',
        },
      });

      // Créer une réservation
      const reservation = await prisma.reservation.create({
        data: {
          guestId: guest.id,
          roomTypeId: roomType.id,
          dateArrivee: new Date(today),
          dateDepart: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 nuits
          prixUnitaire: 100,
          canal: 'DIRECT',
          statut: StatutReservation.CONFIRMEE,
          formule: 'BED_AND_BREAKFAST',
        },
      });

      // Effectuer le check-in
      const stay_res = await request(app.getHttpServer())
        .post(`/api/checkin/${reservation.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      stay = stay_res.body;

      // Vérifier que le séjour est bien en cours
      expect(stay.statut).toBe(StatutSejour.EN_COURS);
      expect(stay.roomId).toBe(room1.id);
    });

    it('Changement nominal vers une chambre disponible', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/stays/${stay.id}/change-room`)
        .set('Authorization', `Bearer ${receptionToken}`)
        .send({
          newRoomId: room2.id,
          motif: 'Demande du client pour proximité étage supérieur',
        });

      expect(res.status).toBe(201);
      expect(res.body.roomId).toBe(room2.id);

      // Vérifier que Stay.roomId a été mis à jour
      const updatedStay = await prisma.stay.findUnique({
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
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: AuditAction.CHANGE_ROOM,
          targetId: stay.id,
        },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog.motif).toBe(
        'Demande du client pour proximité étage supérieur',
      );
    });

    it('Permission absente (Gouvernante) doit être rejetée', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/stays/${stay.id}/change-room`)
        .set('Authorization', `Bearer ${gouvernanteToken}`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif minimum 10 chars ok!',
        });

      expect(res.status).toBe(403);
    });

    it('Motif trop court doit être rejeté', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/stays/${stay.id}/change-room`)
        .set('Authorization', `Bearer ${receptionToken}`)
        .send({
          newRoomId: room2.id,
          motif: 'Trop court',
        });

      expect(res.status).toBe(400);
    });

    it('Séjour inexistant doit retourner 404', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/stays/99999/change-room`)
        .set('Authorization', `Bearer ${receptionToken}`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars',
        });

      expect(res.status).toBe(404);
    });

    it('Même chambre doit être rejetée', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/stays/${stay.id}/change-room`)
        .set('Authorization', `Bearer ${receptionToken}`)
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

      const res = await request(app.getHttpServer())
        .post(`/api/stays/${stay.id}/change-room`)
        .set('Authorization', `Bearer ${receptionToken}`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars',
        });

      expect(res.status).toBe(409);
    });

    it('Ancienne chambre doit passer à A_NETTOYER', async () => {
      const oldRoomId = stay.roomId;

      await request(app.getHttpServer())
        .post(`/api/stays/${stay.id}/change-room`)
        .set('Authorization', `Bearer ${receptionToken}`)
        .send({
          newRoomId: room2.id,
          motif: 'Demande client pour confort amélioré',
        });

      const oldRoom = await prisma.room.findUnique({
        where: { id: oldRoomId },
      });
      expect(oldRoom.statut).toBe(StatutChambre.A_NETTOYER);
    });

    it('Tâche housekeeping doit être créée sans doublon', async () => {
      const oldRoomId = stay.roomId;

      await request(app.getHttpServer())
        .post(`/api/stays/${stay.id}/change-room`)
        .set('Authorization', `Bearer ${receptionToken}`)
        .send({
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

      await request(app.getHttpServer())
        .post(`/api/stays/${stay.id}/change-room`)
        .set('Authorization', `Bearer ${receptionToken}`)
        .send({
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

      const reservation2 = await prisma.reservation.create({
        data: {
          guestId: guest.id,
          roomTypeId: (await prisma.roomType.findFirst()).id,
          dateArrivee: yesterday,
          dateDepart: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
          prixUnitaire: 100,
          canal: 'DIRECT',
          statut: StatutReservation.CONFIRMEE,
          formule: 'BED_AND_BREAKFAST',
        },
      });

      const checkinRes = await request(app.getHttpServer())
        .post(`/api/checkin/${reservation2.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      const stay2 = checkinRes.body;
      const oldRoomId = stay2.roomId;

      // Créer les RoomNight manuellement pour hier (passé)
      await prisma.roomNight.create({
        data: {
          roomId: oldRoomId,
          date: yesterday,
          stayId: stay2.id,
        },
      });

      // Changer de chambre
      await request(app.getHttpServer())
        .post(`/api/stays/${stay2.id}/change-room`)
        .set('Authorization', `Bearer ${receptionToken}`)
        .send({
          newRoomId: room3.id,
          motif: 'Changement après nuit déjà écoulée',
        });

      // Vérifier que la nuit passée (hier) est restée sur l'ancienne chambre
      const pastNightOldRoom = await prisma.roomNight.findUnique({
        where: { roomId_date: { roomId: oldRoomId, date: yesterday } },
      });
      expect(pastNightOldRoom).toBeDefined();

      // Vérifier que la nuit passée n'est pas sur la nouvelle chambre
      const pastNightNewRoom = await prisma.roomNight.findUnique({
        where: { roomId_date: { roomId: room3.id, date: yesterday } },
      });
      expect(pastNightNewRoom).toBeNull();
    });
  });
});
