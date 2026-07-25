/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AuditAction, AuditEntity, Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

// Paramétrage de l'hôtel (identité, TVA/taxes, grille saisonnière) — module
// dédié parameters (docs/modules/parameters.md), Administrateur seul en
// écriture. billing/reservations le consomment en façade (voir
// billing.service.ts generateInvoice, reservations.service.ts
// calculatePrixTotal) — non testé ici, déjà couvert par billing.e2e-spec.ts
// et les tests de tarification saisonnière existants.
describe('Parameters', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminClient: ReturnType<typeof authedRequest>;
  let comptableClient: ReturnType<typeof authedRequest>;
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
    comptableClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'comptable'),
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

  describe('Lecture (parameters:read — Comptable/Réception, pas Gouvernante)', () => {
    it('le Comptable et la Réception peuvent lire hotel-config/tax-rates/season-rates', async () => {
      for (const client of [comptableClient, receptionClient]) {
        expect((await client.get('/api/hotel-config')).status).toBe(200);
        expect((await client.get('/api/tax-rates')).status).toBe(200);
        expect((await client.get('/api/season-rates')).status).toBe(200);
      }
    });

    it("la Gouvernante n'a accès à rien (pas de parameters:read)", async () => {
      expect((await gouvernanteClient.get('/api/hotel-config')).status).toBe(
        403,
      );
      expect((await gouvernanteClient.get('/api/tax-rates')).status).toBe(403);
      expect((await gouvernanteClient.get('/api/season-rates')).status).toBe(
        403,
      );
    });
  });

  describe('Écriture (parameters:write — Administrateur uniquement)', () => {
    it("le Comptable et la Réception n'ont pas le droit d'écrire (403)", async () => {
      const payload = { adresse: 'Test', motif: 'Tentative non autorisée' };
      for (const client of [comptableClient, receptionClient]) {
        const res = await client.patch('/api/hotel-config').send(payload);
        expect(res.status).toBe(403);
      }
    });

    it('un motif < 10 caractères est rejeté (400)', async () => {
      const res = await adminClient
        .patch('/api/hotel-config')
        .send({ adresse: 'Test', motif: 'court' });
      expect(res.status).toBe(400);
    });

    it("l'Administrateur peut modifier l'identité de l'hôtel — écrit AuditLog", async () => {
      const before = await adminClient.get('/api/hotel-config');
      const originalAdresse = before.body.adresse;

      const testAdresse = `Nouvelle adresse — test e2e ${Date.now()}`;
      const res = await adminClient.patch('/api/hotel-config').send({
        adresse: testAdresse,
        motif: 'Correction e2e de test — déménagement fictif',
      });
      expect(res.status).toBe(200);
      expect(res.body.adresse).toBe(testAdresse);

      const logs = await prisma.auditLog.findMany({
        where: {
          targetEntity: AuditEntity.HotelConfig,
          action: AuditAction.UPDATE_HOTEL_CONFIG,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      expect(logs).toHaveLength(1);
      expect((logs[0].newValue as { adresse: string }).adresse).toBe(
        testAdresse,
      );

      // Restaurer.
      await adminClient.patch('/api/hotel-config').send({
        adresse: originalAdresse,
        motif: 'Restauration après test e2e',
      });
    });

    it("l'Administrateur peut modifier un taux de taxe — écrit AuditLog", async () => {
      const listRes = await adminClient.get('/api/tax-rates');
      const tva = listRes.body.find(
        (r: { type: string }) => r.type === 'TVA_HEBERGEMENT',
      );
      const originalTaux = tva.taux;

      // Compte AVANT (des exécutions précédentes de ce test ont pu laisser
      // des entrées — table append-only, jamais nettoyée) : le test doit
      // vérifier un delta, pas juste "au moins une ligne existe".
      const countBefore = await prisma.auditLog.count({
        where: {
          targetEntity: AuditEntity.TaxRateConfig,
          targetId: tva.id,
          action: AuditAction.UPDATE_TAX_RATE,
        },
      });

      const res = await adminClient
        .patch(`/api/tax-rates/${tva.id}`)
        .send({ taux: '12.50', motif: 'Ajustement e2e du taux de TVA' });
      expect(res.status).toBe(200);
      expect(Number(res.body.taux)).toBe(12.5);

      const countAfter = await prisma.auditLog.count({
        where: {
          targetEntity: AuditEntity.TaxRateConfig,
          targetId: tva.id,
          action: AuditAction.UPDATE_TAX_RATE,
        },
      });
      expect(countAfter).toBe(countBefore + 1);

      await adminClient
        .patch(`/api/tax-rates/${tva.id}`)
        .send({ taux: originalTaux, motif: 'Restauration après test e2e' });
    });
  });

  describe('Grille tarifaire saisonnière', () => {
    async function createTestRoomType() {
      const ts = Date.now();
      return prisma.roomType.create({
        data: {
          nom: `TEST-PARAMS-TYPE-${ts}`,
          prixBase: new Prisma.Decimal(500),
          capacite: 2,
        },
      });
    }

    it("l'Administrateur peut créer, modifier et supprimer un tarif saisonnier — écrit AuditLog à chaque étape", async () => {
      const roomType = await createTestRoomType();

      const createRes = await adminClient.post('/api/season-rates').send({
        roomTypeId: roomType.id,
        libelle: 'Test saison',
        dateDebut: '2027-01-01',
        dateFin: '2027-01-31',
        prixNuit: '800.00',
        motif: 'Ouverture grille test e2e',
      });
      expect(createRes.status).toBe(201);
      const id = createRes.body.id;

      const patchRes = await adminClient
        .patch(`/api/season-rates/${id}`)
        .send({ prixNuit: '850.00', motif: 'Ajustement tarif test e2e' });
      expect(patchRes.status).toBe(200);
      expect(Number(patchRes.body.prixNuit)).toBe(850);

      const deleteRes = await adminClient
        .delete(`/api/season-rates/${id}`)
        .send({ motif: 'Suppression fin de test e2e' });
      expect(deleteRes.status).toBe(200);

      const logs = await prisma.auditLog.findMany({
        where: { targetEntity: AuditEntity.SeasonRate, targetId: id },
      });
      const actions = logs.map((l) => l.action).sort();
      expect(actions).toEqual(
        [
          AuditAction.CREATE_SEASON_RATE,
          AuditAction.DELETE_SEASON_RATE,
          AuditAction.UPDATE_SEASON_RATE,
        ].sort(),
      );

      await prisma.roomType.delete({ where: { id: roomType.id } });
    });

    it('refuse une période qui chevauche un tarif saisonnier existant du même type', async () => {
      const roomType = await createTestRoomType();

      const first = await adminClient.post('/api/season-rates').send({
        roomTypeId: roomType.id,
        libelle: 'Première période',
        dateDebut: '2027-06-01',
        dateFin: '2027-06-30',
        prixNuit: '700.00',
        motif: 'Première période test e2e',
      });
      expect(first.status).toBe(201);

      const overlapping = await adminClient.post('/api/season-rates').send({
        roomTypeId: roomType.id,
        libelle: 'Période chevauchante',
        dateDebut: '2027-06-15',
        dateFin: '2027-07-15',
        prixNuit: '720.00',
        motif: 'Période chevauchante test e2e',
      });
      expect(overlapping.status).toBe(409);

      await prisma.seasonRate.deleteMany({
        where: { roomTypeId: roomType.id },
      });
      await prisma.roomType.delete({ where: { id: roomType.id } });
    });

    it("la Réception ne peut pas créer/modifier/supprimer de tarif saisonnier (parameters:write réservé à l'Admin)", async () => {
      const roomType = await createTestRoomType();

      const res = await receptionClient.post('/api/season-rates').send({
        roomTypeId: roomType.id,
        libelle: 'Test RBAC',
        dateDebut: '2027-09-01',
        dateFin: '2027-09-30',
        prixNuit: '600.00',
        motif: 'Tentative non autorisée test e2e',
      });
      expect(res.status).toBe(403);

      await prisma.roomType.delete({ where: { id: roomType.id } });
    });
  });
});

// Preuve de rigueur (CLAUDE.md — convention sabotage/restore) : effectuée à
// la vérification de cette PR, pas conservée en code. En commentant
// temporairement l'appel à `this.auditService.writeLog(...)` dans
// ParametersService.updateTaxRate (backend/src/modules/parameters/parameters.service.ts),
// le test "l'Administrateur peut modifier un taux de taxe — écrit AuditLog"
// ci-dessus échoue bien (compte AuditLog inchangé au lieu de +1) —
// confirmant qu'il est discriminant. Rétabli avant commit, suite revérifiée
// verte.
