/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import {
  MoyenPaiement,
  Prisma,
  StatutChambre,
  StatutSejour,
  TypeLigneFolio,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

describe('Payments Module', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let comptableClient: ReturnType<typeof authedRequest>;
  let receptionClient: ReturnType<typeof authedRequest>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    comptableClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'comptable'),
    );
    receptionClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'reception'),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  // Crée un séjour EN_COURS avec un folio principal et une ligne HEBERGEMENT
  // de 500 MAD — socle réutilisé par tous les scénarios ci-dessous.
  async function createStayWithFolio(label: string) {
    const ts = Date.now();
    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-PAY-TYPE-${label}-${ts}`,
        prixBase: new Prisma.Decimal(500),
        capacite: 2,
      },
    });
    const room = await prisma.room.create({
      data: {
        numero: `TEST-PAY-${label}-${ts}`,
        roomTypeId: roomType.id,
        statut: StatutChambre.OCCUPEE,
      },
    });
    const guest = await prisma.guest.create({
      data: { nom: 'Test', prenom: label },
    });
    const stay = await prisma.stay.create({
      data: {
        roomId: room.id,
        guestId: guest.id,
        dateCheckin: new Date(),
        dateCheckoutPrevue: new Date(),
      },
    });
    const folio = await prisma.folio.create({
      data: { stayId: stay.id, libelle: 'Folio principal' },
    });
    await prisma.folioLine.create({
      data: {
        folioId: folio.id,
        type: TypeLigneFolio.HEBERGEMENT,
        libelle: 'Hébergement — 1 nuit',
        montant: new Prisma.Decimal(500),
      },
    });
    return { roomType, room, guest, stay, folio };
  }

  async function cleanup(ctx: {
    roomType: { id: number };
    room: { id: number };
    guest: { id: number };
    stay: { id: number };
    folio: { id: number };
  }) {
    await prisma.payment.deleteMany({ where: { folioId: ctx.folio.id } });
    await prisma.folioLine.deleteMany({ where: { folioId: ctx.folio.id } });
    await prisma.folio.deleteMany({ where: { stayId: ctx.stay.id } });
    await prisma.roomNight.deleteMany({ where: { stayId: ctx.stay.id } });
    await prisma.stay.deleteMany({ where: { id: ctx.stay.id } });
    await prisma.room.deleteMany({ where: { id: ctx.room.id } });
    await prisma.roomType.deleteMany({ where: { id: ctx.roomType.id } });
    await prisma.guest.deleteMany({ where: { id: ctx.guest.id } });
  }

  it("crédite automatiquement le folio (ligne PAIEMENT) lors d'un règlement", async () => {
    const ctx = await createStayWithFolio('credit');

    const res = await comptableClient.post('/api/payments').send({
      folioId: ctx.folio.id,
      moyen: MoyenPaiement.CARTE,
      montant: '200.00',
      idempotencyKey: `test-credit-${Date.now()}`,
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');

    const lignes = await prisma.folioLine.findMany({
      where: { folioId: ctx.folio.id, type: TypeLigneFolio.PAIEMENT },
    });
    expect(lignes).toHaveLength(1);
    expect(Number(lignes[0].montant)).toBe(200);

    await cleanup(ctx);
  });

  it('un rejeu avec la même idempotencyKey ne crée pas une deuxième ligne créditrice', async () => {
    const ctx = await createStayWithFolio('idem');
    const idempotencyKey = `test-idem-${Date.now()}`;

    const first = await comptableClient.post('/api/payments').send({
      folioId: ctx.folio.id,
      moyen: MoyenPaiement.ESPECES,
      montant: '100.00',
      idempotencyKey,
    });
    expect(first.status).toBe(201);

    const second = await comptableClient.post('/api/payments').send({
      folioId: ctx.folio.id,
      moyen: MoyenPaiement.ESPECES,
      montant: '100.00',
      idempotencyKey,
    });
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    const paymentCount = await prisma.payment.count({
      where: { idempotencyKey },
    });
    expect(paymentCount).toBe(1);

    const lignes = await prisma.folioLine.findMany({
      where: { folioId: ctx.folio.id, type: TypeLigneFolio.PAIEMENT },
    });
    expect(lignes).toHaveLength(1);

    await cleanup(ctx);
  });

  it("refuse un règlement sur le folio d'un séjour déjà clôturé", async () => {
    const ctx = await createStayWithFolio('closed');
    await prisma.stay.update({
      where: { id: ctx.stay.id },
      data: { statut: StatutSejour.CHECKOUT },
    });

    const res = await comptableClient.post('/api/payments').send({
      folioId: ctx.folio.id,
      moyen: MoyenPaiement.CARTE,
      montant: '50.00',
      idempotencyKey: `test-closed-${Date.now()}`,
    });

    expect(res.status).toBe(409);
    const paymentCount = await prisma.payment.count({
      where: { folioId: ctx.folio.id },
    });
    expect(paymentCount).toBe(0);

    await cleanup(ctx);
  });

  describe('Permissions', () => {
    it("la Réception n'a pas le droit d'enregistrer un règlement (payments:write)", async () => {
      const ctx = await createStayWithFolio('rbac-write');

      const res = await receptionClient.post('/api/payments').send({
        folioId: ctx.folio.id,
        moyen: MoyenPaiement.ESPECES,
        montant: '10.00',
        idempotencyKey: `test-rbac-write-${Date.now()}`,
      });
      expect(res.status).toBe(403);

      await cleanup(ctx);
    });

    it('la Réception peut consulter un règlement (payments:read)', async () => {
      const ctx = await createStayWithFolio('rbac-read');
      const created = await comptableClient.post('/api/payments').send({
        folioId: ctx.folio.id,
        moyen: MoyenPaiement.CARTE,
        montant: '10.00',
        idempotencyKey: `test-rbac-read-${Date.now()}`,
      });

      const res = await receptionClient.get(`/api/payments/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);

      await cleanup(ctx);
    });
  });
});

// Preuve de rigueur (CLAUDE.md — convention sabotage/restore) : effectuée à
// la vérification de cette PR, pas conservée en code. En commentant
// temporairement l'appel à `this.billingService.creditFolioLine(...)` dans
// PaymentsService.createPayment (backend/src/modules/payments/payments.service.ts),
// le test "crédite automatiquement le folio (ligne PAIEMENT) lors d'un
// règlement" ci-dessus échoue bien (0 ligne PAIEMENT trouvée au lieu de 1) —
// confirmant qu'il est discriminant et détecterait une régression sur ce
// trou fonctionnel précis. Rétabli avant commit, suite revérifiée verte.
