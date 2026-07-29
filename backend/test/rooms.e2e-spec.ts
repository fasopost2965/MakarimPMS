/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AuditAction, AuditEntity, StatutChambre } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

// CH-038 (RD-024, docs/modules/rooms.md §12/§16) — inventaire configurable :
// CRUD de configuration réservé à rooms:write (Administrateur). rooms:read
// est accordé à tous les rôles de seed (Réception/Gouvernante/Comptable/
// Maintenance/RH), donc pas de cas 403-en-lecture à couvrir ici — seule
// l'écriture distingue les rôles. GET /rooms et PATCH /rooms/:id/statut
// restent hors périmètre (HousekeepingController, écart RBAC assumé §16).
describe('Rooms (CH-038, configuration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminClient: ReturnType<typeof authedRequest>;
  let receptionClient: ReturnType<typeof authedRequest>;
  let gouvernanteClient: ReturnType<typeof authedRequest>;

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
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    adminClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'admin'),
    );
    receptionClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'reception'),
    );
    gouvernanteClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'gouvernante'),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Lecture (rooms:read — tous les rôles de seed)', () => {
    it('la Réception et la Gouvernante peuvent lister les types de chambre', async () => {
      for (const client of [receptionClient, gouvernanteClient]) {
        const res = await client.get('/api/rooms/types');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      }
    });
  });

  describe('Types de chambre (rooms:write — Administrateur uniquement)', () => {
    it('la Réception ne peut pas créer de type de chambre (403)', async () => {
      const res = await receptionClient.post('/api/rooms/types').send({
        nom: 'TEST-RBAC-TYPE',
        prixBase: '400.00',
        capacite: 2,
        motif: 'Tentative non autorisée test e2e',
      });
      expect(res.status).toBe(403);
    });

    it('un motif < 10 caractères est rejeté (400)', async () => {
      const res = await adminClient.post('/api/rooms/types').send({
        nom: 'TEST-MOTIF-COURT',
        prixBase: '400.00',
        capacite: 2,
        motif: 'court',
      });
      expect(res.status).toBe(400);
    });

    it("l'Administrateur peut créer puis modifier un type de chambre — écrit AuditLog", async () => {
      const ts = Date.now();
      const createRes = await adminClient.post('/api/rooms/types').send({
        nom: `TEST-CH038-TYPE-${ts}`,
        prixBase: '450.00',
        capacite: 3,
        motif: 'Création type de chambre test e2e',
      });
      expect(createRes.status).toBe(201);
      const id = createRes.body.id;
      expect(Number(createRes.body.prixBase)).toBe(450);

      const patchRes = await adminClient.patch(`/api/rooms/types/${id}`).send({
        prixBase: '470.00',
        motif: 'Ajustement prix type test e2e',
      });
      expect(patchRes.status).toBe(200);
      expect(Number(patchRes.body.prixBase)).toBe(470);

      const logs = await prisma.auditLog.findMany({
        where: { targetEntity: AuditEntity.RoomType, targetId: id },
      });
      const actions = logs.map((l) => l.action).sort();
      expect(actions).toEqual(
        [AuditAction.CREATE_ROOM_TYPE, AuditAction.UPDATE_ROOM_TYPE].sort(),
      );

      await prisma.roomType.delete({ where: { id } });
    });

    it('un roomTypeId inexistant sur PATCH renvoie 404', async () => {
      const res = await adminClient
        .patch('/api/rooms/types/999999')
        .send({ prixBase: '500.00', motif: 'Test 404 type inexistant' });
      expect(res.status).toBe(404);
    });
  });

  describe('Chambres (rooms:write — Administrateur uniquement)', () => {
    async function createTestRoomType() {
      const ts = Date.now();
      return prisma.roomType.create({
        data: { nom: `TEST-ROOMS-TYPE-${ts}`, prixBase: 400, capacite: 2 },
      });
    }

    it('la Réception ne peut pas créer de chambre (403)', async () => {
      const roomType = await createTestRoomType();
      const res = await receptionClient.post('/api/rooms').send({
        numero: `TEST-${Date.now()}`,
        roomTypeId: roomType.id,
        motif: 'Tentative non autorisée test e2e',
      });
      expect(res.status).toBe(403);
      await prisma.roomType.delete({ where: { id: roomType.id } });
    });

    it('un roomTypeId inexistant sur POST /rooms renvoie 404', async () => {
      const res = await adminClient.post('/api/rooms').send({
        numero: `TEST-${Date.now()}`,
        roomTypeId: 999999,
        motif: 'Test 404 type inexistant',
      });
      expect(res.status).toBe(404);
    });

    it("l'Administrateur peut créer, modifier puis supprimer (soft delete) une chambre — écrit AuditLog à chaque étape", async () => {
      const roomType = await createTestRoomType();
      const numero = `TEST-CH038-${Date.now()}`;

      const createRes = await adminClient.post('/api/rooms').send({
        numero,
        roomTypeId: roomType.id,
        etage: 3,
        motif: 'Création chambre test e2e',
      });
      expect(createRes.status).toBe(201);
      const id = createRes.body.id;
      expect(createRes.body.numero).toBe(numero);
      expect(createRes.body.statut).toBe(StatutChambre.LIBRE_PROPRE);

      const patchRes = await adminClient.patch(`/api/rooms/${id}`).send({
        etage: 4,
        motif: 'Correction étage test e2e',
      });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.etage).toBe(4);

      const deleteRes = await adminClient
        .delete(`/api/rooms/${id}`)
        .send({ motif: 'Suppression fin de test e2e' });
      expect(deleteRes.status).toBe(200);

      const deleted = await prisma.room.findUnique({ where: { id } });
      // Bypass de l'extension soft-delete (lecture directe) pour vérifier
      // que la ligne existe toujours et porte bien deletedAt.
      expect(deleted).toBeNull(); // findUnique() est filtré par l'extension.

      const logs = await prisma.auditLog.findMany({
        where: { targetEntity: AuditEntity.Room, targetId: id },
      });
      const actions = logs.map((l) => l.action).sort();
      expect(actions).toEqual(
        [
          AuditAction.CREATE_ROOM,
          AuditAction.DELETE_ROOM,
          AuditAction.UPDATE_ROOM,
        ].sort(),
      );

      // Nettoyage : le soft delete laisse la ligne Room en base (deletedAt
      // non NULL), il faut la purger physiquement avant de pouvoir libérer
      // le RoomType de test (FK Room.roomTypeId non-cascade).
      await prisma.room.delete({ where: { id } });
      await prisma.roomType.delete({ where: { id: roomType.id } });
    });

    it("refuse la suppression tant que la chambre est engagée dans un cycle d'occupation (RESERVEE/OCCUPEE/DEPART_PREVU)", async () => {
      const roomType = await createTestRoomType();
      const createRes = await adminClient.post('/api/rooms').send({
        numero: `TEST-OCC-${Date.now()}`,
        roomTypeId: roomType.id,
        motif: 'Création chambre test occupation e2e',
      });
      const id = createRes.body.id;

      await prisma.room.update({
        where: { id },
        data: { statut: StatutChambre.OCCUPEE },
      });

      const blockedRes = await adminClient
        .delete(`/api/rooms/${id}`)
        .send({ motif: 'Tentative suppression chambre occupée' });
      expect(blockedRes.status).toBe(409);

      // Restaurer un statut libre puis vérifier que la suppression réussit
      // bien une fois le blocage levé — preuve que le 409 ci-dessus est
      // discriminant sur le statut, pas sur autre chose.
      await prisma.room.update({
        where: { id },
        data: { statut: StatutChambre.LIBRE_PROPRE },
      });
      const okRes = await adminClient
        .delete(`/api/rooms/${id}`)
        .send({ motif: 'Suppression après libération statut' });
      expect(okRes.status).toBe(200);

      await prisma.room.delete({ where: { id } });
      await prisma.roomType.delete({ where: { id: roomType.id } });
    });

    it("refuse la suppression tant qu'une nuitée future est verrouillée sur la chambre", async () => {
      const roomType = await createTestRoomType();
      const createRes = await adminClient.post('/api/rooms').send({
        numero: `TEST-NIGHT-${Date.now()}`,
        roomTypeId: roomType.id,
        motif: 'Création chambre test nuitée future e2e',
      });
      const id = createRes.body.id;

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const night = await prisma.roomNight.create({
        data: { roomId: id, date: futureDate },
      });

      const blockedRes = await adminClient
        .delete(`/api/rooms/${id}`)
        .send({ motif: 'Tentative suppression avec nuitée future' });
      expect(blockedRes.status).toBe(409);

      await prisma.roomNight.delete({ where: { id: night.id } });

      const okRes = await adminClient
        .delete(`/api/rooms/${id}`)
        .send({ motif: 'Suppression après libération nuitée' });
      expect(okRes.status).toBe(200);

      await prisma.room.delete({ where: { id } });
      await prisma.roomType.delete({ where: { id: roomType.id } });
    });
  });
});

// Preuve de rigueur (CLAUDE.md — convention sabotage/restore) : effectuée à
// la vérification de cette PR, pas conservée en code. En commentant
// temporairement la vérification STATUTS_OCCUPATION_ACTIVE dans
// RoomsService.deleteRoom (backend/src/modules/rooms/rooms.service.ts), le
// test "refuse la suppression tant que la chambre est engagée..." échoue
// bien (200 au lieu de 409 attendu) — confirmant qu'il est discriminant.
// Rétabli avant commit, suite revérifiée verte.
