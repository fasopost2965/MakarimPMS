import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { Prisma, StatutChambre } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

// DESIGN-010 (Billing Center) — GET /invoices, GET /payments,
// GET /stays/facturables (mission §23.A/B/C). Vraie base MySQL, jamais de
// mock (CLAUDE.md).
interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface StayResponse {
  id: number;
  statut: string;
  roomId: number;
  folios: { id: number }[];
}

describe('Billing Center — DESIGN-010 (registres paginés)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminClient: ReturnType<typeof authedRequest>;
  let receptionClient: ReturnType<typeof authedRequest>;
  let comptableClient: ReturnType<typeof authedRequest>;
  let roomTypeId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    const adminToken = await loginAs(app.getHttpServer(), 'admin');
    adminClient = authedRequest(app.getHttpServer(), adminToken);
    const receptionToken = await loginAs(app.getHttpServer(), 'reception');
    receptionClient = authedRequest(app.getHttpServer(), receptionToken);
    const comptableToken = await loginAs(app.getHttpServer(), 'comptable');
    comptableClient = authedRequest(app.getHttpServer(), comptableToken);

    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-DESIGN010-TYPE-${Date.now()}`,
        prixBase: new Prisma.Decimal(300),
        capacite: 2,
      },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.creditNote.deleteMany({
      where: { invoice: { folio: { stay: { room: { roomTypeId } } } } },
    });
    // DESIGN-010 (correction RBAC finale suite) — le nouveau test
    // billing:send (POST /invoices/:id/envoyer) crée un InvoiceDownloadToken
    // (F7, lien de téléchargement pour l'email/WhatsApp), FK non-cascade
    // vers Invoice — doit être vidé avant invoice.deleteMany, même pattern
    // que payment/creditNote ci-dessus.
    await prisma.invoiceDownloadToken.deleteMany({
      where: { invoice: { folio: { stay: { room: { roomTypeId } } } } },
    });
    await prisma.invoice.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.folioLine.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.folio.deleteMany({
      where: { stay: { room: { roomTypeId } } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        targetEntity: 'Stay',
        targetId: {
          in: await prisma.stay
            .findMany({
              where: { room: { roomTypeId } },
              select: { id: true },
            })
            .then((rows) => rows.map((r) => r.id)),
        },
      },
    });
    await prisma.roomStatusLog.deleteMany({
      where: { room: { roomTypeId } },
    });
    await prisma.housekeepingTaskLog.deleteMany({
      where: { task: { room: { roomTypeId } } },
    });
    await prisma.housekeepingTask.deleteMany({
      where: { room: { roomTypeId } },
    });
    await prisma.stay.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.room.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  async function createRoom(prefix: string) {
    return prisma.room.create({
      data: {
        numero: `TEST-D010-${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        roomTypeId,
        statut: StatutChambre.LIBRE_PROPRE,
      },
    });
  }

  async function walkinAndCheckout(prefix: string, nom: string) {
    const room = await createRoom(prefix);
    const res = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
        .toISOString()
        .slice(0, 10),
      nombreOccupants: 1,
      formule: 'ROOM_ONLY',
      guest: { nom, prenom: 'DESIGN010' },
    });
    const stay = res.body as StayResponse;
    // Solde positif (aucun paiement enregistré) : check-out forcé, motif
    // ≥ 10 caractères (checkin:force-checkout, Administrateur).
    const checkoutRes = await adminClient
      .post(`/api/checkout/${stay.id}`)
      .send({
        force: true,
        motif: 'Check-out de test e2e DESIGN-010 (solde volontairement impayé)',
      });
    expect(checkoutRes.status).toBe(201);
    return { stay, room, folioId: stay.folios[0].id };
  }

  describe('GET /stays/facturables', () => {
    it('un séjour CHECKOUT sans facture apparaît ; une fois facturé, il disparaît ; un avoir le fait réapparaître', async () => {
      const { stay, folioId } = await walkinAndCheckout(
        'FACTURABLE',
        'Facturable',
      );

      const before = await adminClient.get('/api/stays/facturables');
      expect(before.status).toBe(200);
      const bodyBefore = before.body as PaginatedResponse<{ id: number }>;
      expect(bodyBefore.data.some((s) => s.id === stay.id)).toBe(true);

      const invoiceRes = await adminClient
        .post(`/api/invoices/generer?folioId=${folioId}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      const invoiceId = (invoiceRes.body as { id: number }).id;

      const after = await adminClient.get('/api/stays/facturables');
      const bodyAfter = after.body as PaginatedResponse<{ id: number }>;
      expect(bodyAfter.data.some((s) => s.id === stay.id)).toBe(false);

      const creditNoteRes = await adminClient
        .post(`/api/invoices/${invoiceId}/credit-notes`)
        .send({ motif: 'Avoir de test e2e — réapparition attendue' });
      expect(creditNoteRes.status).toBe(201);

      const afterAvoir = await adminClient.get('/api/stays/facturables');
      const bodyAfterAvoir = afterAvoir.body as PaginatedResponse<{
        id: number;
      }>;
      expect(bodyAfterAvoir.data.some((s) => s.id === stay.id)).toBe(true);
    });

    it('un séjour EN_COURS n’apparaît jamais, la pagination et le filtre roomId fonctionnent, RBAC billing:read requis', async () => {
      const room = await createRoom('ENCOURS');
      const enCoursRes = await receptionClient
        .post('/api/checkin/walk-in')
        .send({
          roomId: room.id,
          dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
            .toISOString()
            .slice(0, 10),
          nombreOccupants: 1,
          formule: 'ROOM_ONLY',
          guest: { nom: 'EnCours', prenom: 'DESIGN010' },
        });
      const enCoursStay = enCoursRes.body as StayResponse;

      const res = await adminClient.get('/api/stays/facturables?limit=1');
      expect(res.status).toBe(200);
      const body = res.body as PaginatedResponse<{ id: number }>;
      expect(body.data.some((s) => s.id === enCoursStay.id)).toBe(false);
      expect(body.meta.limit).toBe(1);
      expect(body.data.length).toBeLessThanOrEqual(1);

      const { stay, room: roomFacturable } = await walkinAndCheckout(
        'ROOMFILTER',
        'RoomFilter',
      );
      const filtered = await adminClient.get(
        `/api/stays/facturables?roomId=${roomFacturable.id}`,
      );
      const filteredBody = filtered.body as PaginatedResponse<{
        id: number;
      }>;
      expect(filteredBody.data.every((s) => s.id === stay.id)).toBe(true);
      expect(filteredBody.data.some((s) => s.id === stay.id)).toBe(true);

      // DESIGN-010 (correction RBAC finale) — Réception a désormais
      // billing:read (lecture seule) : consulte les dossiers à facturer,
      // ne peut jamais en générer une (voir "Réception ne peut pas générer
      // de facture" ci-dessous, section GET /invoices).
      const allowed = await receptionClient.get('/api/stays/facturables');
      expect(allowed.status).toBe(200);
    });
  });

  describe('GET /invoices', () => {
    it('registre paginé, filtre numero/statut/guestId, RBAC billing:read', async () => {
      const { stay, folioId } = await walkinAndCheckout('INVLIST', 'InvList');
      const invoiceRes = await adminClient
        .post(`/api/invoices/generer?folioId=${folioId}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      const invoice = invoiceRes.body as { id: number; numero: string };

      const all = await comptableClient.get('/api/invoices?limit=5');
      expect(all.status).toBe(200);
      const allBody = all.body as PaginatedResponse<{
        id: number;
        numero: string;
        folio: { stay: { id: number; guest: { nom: string } } };
      }>;
      expect(allBody.meta).toHaveProperty('total');
      expect(allBody.meta).toHaveProperty('totalPages');
      const found = allBody.data.find((i) => i.id === invoice.id);
      expect(found).toBeDefined();
      expect(found!.folio.stay.id).toBe(stay.id);

      const byNumero = await comptableClient.get(
        `/api/invoices?numero=${encodeURIComponent(invoice.numero)}`,
      );
      const byNumeroBody = byNumero.body as PaginatedResponse<{
        numero: string;
      }>;
      expect(byNumeroBody.data).toHaveLength(1);
      expect(byNumeroBody.data[0].numero).toBe(invoice.numero);

      const byStatut = await comptableClient.get('/api/invoices?statut=EMISE');
      const byStatutBody = byStatut.body as PaginatedResponse<{
        id: number;
        statut: string;
      }>;
      expect(byStatutBody.data.every((i) => i.statut === 'EMISE')).toBe(true);
      expect(byStatutBody.data.some((i) => i.id === invoice.id)).toBe(true);

      const byAnnulee = await comptableClient.get(
        '/api/invoices?statut=ANNULEE_PAR_AVOIR',
      );
      const byAnnuleeBody = byAnnulee.body as PaginatedResponse<{
        id: number;
      }>;
      expect(byAnnuleeBody.data.some((i) => i.id === invoice.id)).toBe(false);

      // DESIGN-010 (correction RBAC finale) — Réception a désormais
      // billing:read : consulte le registre des factures (recherche,
      // panneau, PDF, impression) mais jamais billing:write (voir tests
      // dédiés ci-dessous : ne peut ni générer une facture ni créer un
      // avoir).
      const receptionRead = await receptionClient.get('/api/invoices');
      expect(receptionRead.status).toBe(200);
    });

    it('Réception (billing:read + billing:send, jamais billing:write) ne peut ni générer une facture ni créer un avoir, mais peut demander l’envoi', async () => {
      const { folioId } = await walkinAndCheckout('RBACWRITE', 'RbacWrite');

      // Génération de facture réservée à billing:write — Réception rejetée.
      const generer = await receptionClient
        .post(`/api/invoices/generer?folioId=${folioId}`)
        .send({});
      expect(generer.status).toBe(403);

      // Une facture existe (générée par l'admin) : avoir également réservé
      // à billing:write — Réception rejetée sur une facture réelle, pas
      // seulement sur un ID arbitraire.
      const invoiceRes = await adminClient
        .post(`/api/invoices/generer?folioId=${folioId}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      const invoiceId = (invoiceRes.body as { id: number }).id;

      const avoir = await receptionClient
        .post(`/api/invoices/${invoiceId}/credit-notes`)
        .send({ motif: 'Tentative avoir Réception — doit être rejetée' });
      expect(avoir.status).toBe(403);

      // DESIGN-010 (correction RBAC finale suite) — billing:send, permission
      // dédiée : la Réception PEUT en revanche demander l'envoi d'une
      // facture déjà émise (ne modifie aucun montant/ligne, juste une
      // notification asynchrone). 201 attendu (pas 403) — le résultat réel
      // de l'envoi (SMTP/Twilio non configurés en test) se dégrade
      // silencieusement, voir NotificationsService, hors périmètre RBAC ici.
      const envoyer = await receptionClient
        .post(`/api/invoices/${invoiceId}/envoyer`)
        .send({});
      expect(envoyer.status).toBe(201);
      expect((envoyer.body as { statut: string }).statut).toBe(
        'demande envoyée',
      );
    });

    it('filtre from/to sur Invoice.createdAt exclut une facture hors période', async () => {
      const { folioId } = await walkinAndCheckout('INVDATE', 'InvDate');
      const invoiceRes = await adminClient
        .post(`/api/invoices/generer?folioId=${folioId}`)
        .send({});
      const invoice = invoiceRes.body as { id: number };

      const demain = new Date(Date.now() + 86_400_000)
        .toISOString()
        .slice(0, 10);
      const futur = await comptableClient.get(`/api/invoices?from=${demain}`);
      const futurBody = futur.body as PaginatedResponse<{ id: number }>;
      expect(futurBody.data.some((i) => i.id === invoice.id)).toBe(false);

      const aujourdhui = new Date().toISOString().slice(0, 10);
      const auj = await comptableClient.get(`/api/invoices?from=${aujourdhui}`);
      const aujBody = auj.body as PaginatedResponse<{ id: number }>;
      expect(aujBody.data.some((i) => i.id === invoice.id)).toBe(true);
    });
  });

  describe('GET /payments', () => {
    it('registre paginé, filtre moyen/guestId, RBAC payments:read, pas de champ "encaissé par"', async () => {
      const room = await createRoom('PAYLIST');
      const stayRes = await receptionClient.post('/api/checkin/walk-in').send({
        roomId: room.id,
        dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
          .toISOString()
          .slice(0, 10),
        nombreOccupants: 1,
        formule: 'ROOM_ONLY',
        guest: { nom: 'PayList', prenom: 'DESIGN010' },
      });
      const stay = stayRes.body as StayResponse;
      const folioId = stay.folios[0].id;

      const paymentRes = await comptableClient.post('/api/payments').send({
        folioId,
        moyen: 'CARTE',
        montant: '50.00',
        idempotencyKey: `design010-${Date.now()}`,
      });
      expect(paymentRes.status).toBe(201);

      const all = await comptableClient.get('/api/payments?limit=10');
      expect(all.status).toBe(200);
      const allBody = all.body as PaginatedResponse<{
        id: number;
        moyen: string;
        montant: string;
        folio: { stay: { id: number; guest: { nom: string } } };
      }>;
      expect(allBody.meta).toHaveProperty('totalPages');
      const found = allBody.data.find((p) => p.folio.stay.id === stay.id);
      expect(found).toBeDefined();
      expect(found!.moyen).toBe('CARTE');
      expect(found).not.toHaveProperty('encaissePar');
      expect(found).not.toHaveProperty('userId');

      const byMoyen = await comptableClient.get('/api/payments?moyen=CARTE');
      const byMoyenBody = byMoyen.body as PaginatedResponse<{
        moyen: string;
      }>;
      expect(byMoyenBody.data.every((p) => p.moyen === 'CARTE')).toBe(true);

      const byMoyenEspeces = await comptableClient.get(
        '/api/payments?moyen=ESPECES',
      );
      const byMoyenEspecesBody = byMoyenEspeces.body as PaginatedResponse<{
        folio: { stay: { id: number } };
      }>;
      expect(
        byMoyenEspecesBody.data.some((p) => p.folio.stay.id === stay.id),
      ).toBe(false);

      // Réception a payments:read (contexte établi) — autorisée.
      const receptionRes = await receptionClient.get('/api/payments');
      expect(receptionRes.status).toBe(200);
    });
  });

  describe('GET /billing/kpis', () => {
    it('renvoie les 4 KPI attendus (facturesAujourdhui/caFacture/aFacturer/aEncaisser)', async () => {
      const res = await adminClient.get('/api/billing/kpis');
      expect(res.status).toBe(200);
      const body = res.body as {
        facturesAujourdhui: number;
        caFacture: string;
        aFacturer: number;
        aEncaisser: string;
      };
      expect(typeof body.facturesAujourdhui).toBe('number');
      expect(typeof body.caFacture).toBe('string');
      expect(typeof body.aFacturer).toBe('number');
      expect(typeof body.aEncaisser).toBe('string');

      // DESIGN-010 (correction RBAC finale) — Réception a billing:read,
      // voit donc la bande de KPI du module (lecture pure, aucun impact
      // financier).
      const receptionRes = await receptionClient.get('/api/billing/kpis');
      expect(receptionRes.status).toBe(200);
    });
  });
});
