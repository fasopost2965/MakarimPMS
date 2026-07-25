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
  let adminClient: ReturnType<typeof authedRequest>;

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
    adminClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'admin'),
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

  // CH-012 (docs/governance/REGISTRE_CHANTIERS.md) — remboursement d'un
  // acompte imputé (chemin fonctionnel, débloqué par CH-001). Passe par un
  // vrai check-in HTTP (pas une insertion Prisma directe des acomptes) pour
  // exercer StayService.imputerAcomptes tel qu'il s'exécute réellement.
  describe("CH-012 — Remboursement d'un acompte imputé", () => {
    async function createReservationWithDeposit(label: string) {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-PAY-CH012-TYPE-${label}-${ts}`,
          prixBase: new Prisma.Decimal(500),
          capacite: 2,
        },
      });
      const room = await prisma.room.create({
        data: {
          numero: `TEST-PAY-CH012-${label}-${ts}`,
          roomTypeId: roomType.id,
        },
      });

      const created = await adminClient.post('/api/reservations').send({
        roomId: room.id,
        dateArrivee: '2027-06-10',
        dateDepart: '2027-06-12',
        guest: { nom: 'CH012', prenom: label },
      });
      expect(created.status).toBe(201);
      const reservationId = created.body.id as number;

      const deposit = await adminClient
        .post(`/api/reservations/${reservationId}/deposits`)
        .send({
          montant: '200.00',
          moyen: MoyenPaiement.CARTE,
          idempotencyKey: `test-ch012-deposit-${label}-${ts}`,
        });
      expect(deposit.status).toBe(201);
      const depositId = deposit.body.id as number;

      const checkin = await adminClient
        .post(`/api/checkin/${reservationId}`)
        .send();
      expect(checkin.status).toBe(201);
      const stayId = checkin.body.id as number;
      const folioId = (
        checkin.body.folios as { id: number; libelle: string }[]
      ).find((f) => f.libelle === 'Folio principal')!.id;

      // Vérifie que l'imputation automatique a bien eu lieu avant de tester
      // le remboursement — sinon ce n'est plus un scénario IMPUTE.
      const imputed = await prisma.reservationDeposit.findUniqueOrThrow({
        where: { id: depositId },
      });
      expect(imputed.statut).toBe('IMPUTE');
      expect(imputed.imputeAuFolioId).toBe(folioId);

      return { roomType, room, reservationId, depositId, stayId, folioId };
    }

    async function cleanupReservation(ctx: {
      roomType: { id: number };
      room: { id: number };
      reservationId: number;
      stayId: number;
      folioId: number;
    }) {
      await prisma.creditNote.deleteMany({
        where: { invoice: { folioId: ctx.folioId } },
      });
      await prisma.payment.deleteMany({ where: { folioId: ctx.folioId } });
      await prisma.invoice.deleteMany({ where: { folioId: ctx.folioId } });
      await prisma.folioLine.deleteMany({ where: { folioId: ctx.folioId } });
      await prisma.folio.deleteMany({ where: { stayId: ctx.stayId } });
      await prisma.roomNight.deleteMany({ where: { roomId: ctx.room.id } });
      await prisma.roomStatusLog.deleteMany({ where: { roomId: ctx.room.id } });
      await prisma.reservationDeposit.deleteMany({
        where: { reservationId: ctx.reservationId },
      });
      await prisma.stay.deleteMany({ where: { id: ctx.stayId } });
      await prisma.reservation.deleteMany({ where: { id: ctx.reservationId } });
      await prisma.room.deleteMany({ where: { id: ctx.room.id } });
      await prisma.roomType.deleteMany({ where: { id: ctx.roomType.id } });
    }

    it('rembourse un acompte imputé si le folio ne porte encore aucune facture', async () => {
      const ctx = await createReservationWithDeposit('no-invoice');

      const res = await adminClient
        .post(
          `/api/reservations/${ctx.reservationId}/deposits/${ctx.depositId}/rembourser`,
        )
        .send({ motif: 'Départ anticipé, acompte à restituer' });

      expect(res.status).toBe(201);
      expect(res.body.statut).toBe('REMBOURSE');

      await cleanupReservation(ctx);
    });

    it('refuse le remboursement tant que le folio porte une facture émise active, l’accepte après avoir', async () => {
      const ctx = await createReservationWithDeposit('with-invoice');

      const invoiceRes = await adminClient.post(
        `/api/invoices/generer?folioId=${ctx.folioId}`,
      );
      expect(invoiceRes.status).toBe(201);
      const invoiceId = invoiceRes.body.id as number;

      const blocked = await adminClient
        .post(
          `/api/reservations/${ctx.reservationId}/deposits/${ctx.depositId}/rembourser`,
        )
        .send({ motif: 'Tentative avant annulation de la facture' });
      expect(blocked.status).toBe(409);
      expect(blocked.body.message).toContain(`credit-notes`);

      const stillImpute = await prisma.reservationDeposit.findUniqueOrThrow({
        where: { id: ctx.depositId },
      });
      expect(stillImpute.statut).toBe('IMPUTE');

      const avoir = await adminClient
        .post(`/api/invoices/${invoiceId}/credit-notes`)
        .send({
          motif: "Annulation avant remboursement de l'acompte (CH-012)",
        });
      expect(avoir.status).toBe(201);

      const allowed = await adminClient
        .post(
          `/api/reservations/${ctx.reservationId}/deposits/${ctx.depositId}/rembourser`,
        )
        .send({ motif: 'Facture annulée par avoir, remboursement autorisé' });
      expect(allowed.status).toBe(201);
      expect(allowed.body.statut).toBe('REMBOURSE');

      await cleanupReservation(ctx);
    });

    // Preuve de rigueur sabotage/restore (CLAUDE.md — règle non négociable
    // sur la couverture de test) : la garde qui bloque le remboursement
    // tant qu'une facture EMISE existe encore protège directement contre un
    // double avantage financier (avoir + remboursement sur le même montant).
    // Sabotage réel effectué pendant l'implémentation : en remplaçant
    // temporairement `folio.invoices.some((i) => i.statut === 'EMISE')` par
    // `false` dans DepositsService.rembourser (backend/src/modules/payments/deposits.service.ts),
    // le test précédent ("refuse le remboursement tant que...") échoue bien
    // (201 au lieu de 409 attendu à l'étape `blocked`) — confirmant que
    // c'est bien cette garde, et non un autre mécanisme, qui bloque le
    // remboursement prématuré. Restauré ensuite, suite revérifiée verte.
    it("la Réception n'a pas le droit de rembourser un acompte (payments:refund)", async () => {
      const ctx = await createReservationWithDeposit('rbac-refund');

      const res = await receptionClient
        .post(
          `/api/reservations/${ctx.reservationId}/deposits/${ctx.depositId}/rembourser`,
        )
        .send({ motif: 'Tentative non autorisée par la réception' });
      expect(res.status).toBe(403);

      await cleanupReservation(ctx);
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
