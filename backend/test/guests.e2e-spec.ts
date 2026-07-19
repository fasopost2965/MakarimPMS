import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

interface GuestResponse {
  id: number;
  nom: string;
  prenom: string;
  categorie: string;
  telephone: string | null;
}

interface ReservationResponse {
  id: number;
  guestId: number;
}

interface StayResponse {
  id: number;
  guestId: number;
}

interface FolioResponse {
  id: number;
  stayId: number;
}

interface InvoiceResponse {
  id: number;
  numero: string;
}

// Guests / CRM (cahier des charges §5.7, Phase 2). Vérifie le CRUD client,
// le changement de catégorie audité (GuestCategoryLog, CLAUDE.md règle 4) et
// surtout le blocage BLACKLIST réellement applicable via la réutilisation
// de client (guestId) dans réservations/check-in. Vrais appels HTTP contre
// une vraie base MySQL, aucun mock.
describe('Guests / CRM (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let receptionClient: ReturnType<typeof authedRequest>;
  let comptableClient: ReturnType<typeof authedRequest>;
  let adminClient: ReturnType<typeof authedRequest>;
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
    const receptionToken = await loginAs(app.getHttpServer(), 'reception');
    receptionClient = authedRequest(app.getHttpServer(), receptionToken);
    const comptableToken = await loginAs(app.getHttpServer(), 'comptable');
    comptableClient = authedRequest(app.getHttpServer(), comptableToken);
    const adminToken = await loginAs(app.getHttpServer(), 'admin');
    adminClient = authedRequest(app.getHttpServer(), adminToken);

    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-GUEST-TYPE-${Date.now()}`,
        prixBase: 300,
        capacite: 2,
      },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({
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
    await prisma.roomNight.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.roomStatusLog.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.stay.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.reservation.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.room.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await prisma.guestCategoryLog.deleteMany({
      where: { guest: { nom: { startsWith: 'TEST-GUEST-' } } },
    });
    await prisma.guest.deleteMany({
      where: { nom: { startsWith: 'TEST-GUEST-' } },
    });
    await app.close();
  });

  async function createRoom() {
    const room = await prisma.room.create({
      data: {
        numero: `TEST-GUEST-${Date.now()}-${Math.random()}`,
        roomTypeId,
      },
    });
    return room.id;
  }

  it('POST /guests crée un client en STANDARD par défaut', async () => {
    const res = await receptionClient.post('/api/guests').send({
      nom: 'TEST-GUEST-Alaoui',
      prenom: 'Yassine',
    });
    expect(res.status).toBe(201);
    const guest = res.body as GuestResponse;
    expect(guest.categorie).toBe('STANDARD');
  });

  it('GET /guests?q= retrouve un client par recherche multi-critères', async () => {
    const created = await receptionClient.post('/api/guests').send({
      nom: 'TEST-GUEST-Bennani',
      prenom: 'Salma',
      telephone: '0612345678',
    });
    expect(created.status).toBe(201);
    const createdId = (created.body as GuestResponse).id;

    const byNom = await receptionClient.get('/api/guests?q=Bennani');
    expect(byNom.status).toBe(200);
    expect(
      (byNom.body as GuestResponse[]).some((g) => g.id === createdId),
    ).toBe(true);

    const byTelephone = await receptionClient.get('/api/guests?q=0612345678');
    expect(
      (byTelephone.body as GuestResponse[]).some((g) => g.id === createdId),
    ).toBe(true);
  });

  it('PATCH /guests/:id met à jour les champs non sensibles', async () => {
    const created = await receptionClient.post('/api/guests').send({
      nom: 'TEST-GUEST-Idrissi',
      prenom: 'Karim',
    });
    const id = (created.body as GuestResponse).id;

    const updated = await receptionClient
      .patch(`/api/guests/${id}`)
      .send({ telephone: '0700000000' });
    expect(updated.status).toBe(200);
    expect((updated.body as GuestResponse).telephone).toBe('0700000000');
  });

  it('PATCH /guests/:id/categorie sans motif renvoie 400', async () => {
    const created = await receptionClient.post('/api/guests').send({
      nom: 'TEST-GUEST-Fassi',
      prenom: 'Omar',
    });
    const id = (created.body as GuestResponse).id;

    const res = await receptionClient
      .patch(`/api/guests/${id}/categorie`)
      .send({ categorie: 'VIP' });
    expect(res.status).toBe(400);
  });

  it('PATCH /guests/:id/categorie avec motif change la catégorie et journalise (GuestCategoryLog)', async () => {
    const created = await receptionClient.post('/api/guests').send({
      nom: 'TEST-GUEST-Tazi',
      prenom: 'Nadia',
    });
    const id = (created.body as GuestResponse).id;

    const res = await receptionClient
      .patch(`/api/guests/${id}/categorie`)
      .send({ categorie: 'VIP', motif: 'Client fidèle, 10e séjour' });
    expect(res.status).toBe(200);
    expect((res.body as GuestResponse).categorie).toBe('VIP');

    const log = await prisma.guestCategoryLog.findFirst({
      where: { guestId: id },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log!.ancienneCategorie).toBe('STANDARD');
    expect(log!.nouvelleCategorie).toBe('VIP');
    expect(log!.motif).toBe('Client fidèle, 10e séjour');
  });

  // Preuve de rigueur (validée manuellement) : en remplaçant temporairement
  // `touchesBlacklist` par `false` dans `GuestsService.updateCategorie`
  // (contournant le contrôle guests:blacklist), ce test échoue bien (200 au
  // lieu de 403 attendu pour Réception) — confirmant que c'est bien ce
  // contrôle, et non le décorateur @RequirePermission('guests','write')
  // statique, qui bloque la transition. Restauré ensuite.
  it('PATCH .../categorie vers BLACKLIST : 403 pour Réception (guests:write ne suffit pas), 200 pour Administrateur', async () => {
    const created = await receptionClient.post('/api/guests').send({
      nom: 'TEST-GUEST-Permission',
      prenom: 'Blacklist',
    });
    const id = (created.body as GuestResponse).id;

    const asReception = await receptionClient
      .patch(`/api/guests/${id}/categorie`)
      .send({ categorie: 'BLACKLIST', motif: 'Tentative non autorisée' });
    expect(asReception.status).toBe(403);

    const stillStandard = await prisma.guest.findUniqueOrThrow({
      where: { id },
    });
    expect(stillStandard.categorie).toBe('STANDARD');

    const asAdmin = await adminClient
      .patch(`/api/guests/${id}/categorie`)
      .send({ categorie: 'BLACKLIST', motif: 'Fraude confirmée au comptoir' });
    expect(asAdmin.status).toBe(200);
    expect((asAdmin.body as GuestResponse).categorie).toBe('BLACKLIST');
  });

  it('PATCH .../categorie pour sortir un client de BLACKLIST exige aussi guests:blacklist', async () => {
    const created = await receptionClient.post('/api/guests').send({
      nom: 'TEST-GUEST-Debloque',
      prenom: 'Client',
    });
    const id = (created.body as GuestResponse).id;
    await adminClient
      .patch(`/api/guests/${id}/categorie`)
      .send({ categorie: 'BLACKLIST', motif: 'Mise en liste noire initiale' });

    const asReception = await receptionClient
      .patch(`/api/guests/${id}/categorie`)
      .send({ categorie: 'STANDARD', motif: 'Tentative de déblocage' });
    expect(asReception.status).toBe(403);

    const asAdmin = await adminClient
      .patch(`/api/guests/${id}/categorie`)
      .send({
        categorie: 'STANDARD',
        motif: 'Malentendu résolu avec le client',
      });
    expect(asAdmin.status).toBe(200);
  });

  // Preuve de rigueur (validée manuellement) : en remplaçant temporairement
  // l'appel à `guestsService.assertNotBlacklisted` dans
  // `ReservationsService.create` par une simple lecture du client
  // (`tx.guest.findUniqueOrThrow`), ce test échoue bien (201 au lieu de 409
  // attendu) — confirmant que c'est cet appel, et non un autre mécanisme,
  // qui bloque la réservation d'un client blacklisté. Restauré ensuite.
  it('réservation avec guestId BLACKLIST → 409, aucune réservation créée', async () => {
    const guest = await receptionClient.post('/api/guests').send({
      nom: 'TEST-GUEST-Blacklisted',
      prenom: 'Reservation',
    });
    const guestId = (guest.body as GuestResponse).id;
    // Blacklister exige guests:blacklist (Administrateur uniquement, voir
    // test dédié plus bas) — Réception n'a plus ce droit depuis l'arbitrage
    // RBAC du 2026-07-19.
    await adminClient
      .patch(`/api/guests/${guestId}/categorie`)
      .send({ categorie: 'BLACKLIST', motif: 'Test e2e blacklist' });

    const roomId = await createRoom();
    const reservationsBefore = await prisma.reservation.count({
      where: { guestId },
    });

    const res = await receptionClient.post('/api/reservations').send({
      roomId,
      dateArrivee: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      dateDepart: new Date(Date.now() + 3 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      guestId,
    });
    expect(res.status).toBe(409);

    const reservationsAfter = await prisma.reservation.count({
      where: { guestId },
    });
    expect(reservationsAfter).toBe(reservationsBefore);
  });

  it('réservation avec guestId STANDARD → 201, réutilise le client existant (pas de nouveau Guest créé)', async () => {
    const guest = await receptionClient.post('/api/guests').send({
      nom: 'TEST-GUEST-Reuse',
      prenom: 'Reservation',
    });
    const guestId = (guest.body as GuestResponse).id;
    const roomId = await createRoom();
    const guestCountBefore = await prisma.guest.count();

    const res = await receptionClient.post('/api/reservations').send({
      roomId,
      dateArrivee: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      dateDepart: new Date(Date.now() + 3 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      guestId,
    });
    expect(res.status).toBe(201);
    expect((res.body as ReservationResponse).guestId).toBe(guestId);

    const guestCountAfter = await prisma.guest.count();
    expect(guestCountAfter).toBe(guestCountBefore);
  });

  it('check-in walk-in avec guestId BLACKLIST → 409', async () => {
    const guest = await receptionClient.post('/api/guests').send({
      nom: 'TEST-GUEST-Blacklisted',
      prenom: 'Checkin',
    });
    const guestId = (guest.body as GuestResponse).id;
    // Blacklister exige guests:blacklist (Administrateur uniquement, voir
    // test dédié plus bas) — Réception n'a plus ce droit depuis l'arbitrage
    // RBAC du 2026-07-19.
    await adminClient
      .patch(`/api/guests/${guestId}/categorie`)
      .send({ categorie: 'BLACKLIST', motif: 'Test e2e blacklist' });

    const roomId = await createRoom();
    const res = await receptionClient.post('/api/checkin/walk-in').send({
      roomId,
      dateCheckoutPrevue: new Date(Date.now() + 2 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      guestId,
    });
    expect(res.status).toBe(409);
  });

  it('GET /guests/:id/historique retourne les séjours du client', async () => {
    const guest = await receptionClient.post('/api/guests').send({
      nom: 'TEST-GUEST-Historique',
      prenom: 'Client',
    });
    const guestId = (guest.body as GuestResponse).id;
    const roomId = await createRoom();

    const checkin = await receptionClient.post('/api/checkin/walk-in').send({
      roomId,
      dateCheckoutPrevue: new Date(Date.now() + 2 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      guestId,
    });
    expect(checkin.status).toBe(201);
    const stayId = (checkin.body as StayResponse).id;

    const historique = await receptionClient.get(
      `/api/guests/${guestId}/historique`,
    );
    expect(historique.status).toBe(200);
    expect(
      (historique.body as StayResponse[]).some((s) => s.id === stayId),
    ).toBe(true);
  });

  it('GET /guests/:id/factures retourne les factures liées aux folios du client', async () => {
    const guest = await receptionClient.post('/api/guests').send({
      nom: 'TEST-GUEST-Facture',
      prenom: 'Client',
    });
    const guestId = (guest.body as GuestResponse).id;
    const roomId = await createRoom();

    const checkin = await receptionClient.post('/api/checkin/walk-in').send({
      roomId,
      dateCheckoutPrevue: new Date(Date.now() + 2 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      guestId,
    });
    expect(checkin.status).toBe(201);
    const stayId = (checkin.body as StayResponse).id;

    const foliosRes = await comptableClient.get(`/api/stays/${stayId}/folios`);
    expect(foliosRes.status).toBe(200);
    const folioId = (foliosRes.body as FolioResponse[])[0].id;

    const invoiceRes = await comptableClient
      .post(`/api/invoices/generer?folioId=${folioId}`)
      .send({});
    expect(invoiceRes.status).toBe(201);
    const invoiceId = (invoiceRes.body as InvoiceResponse).id;

    const factures = await receptionClient.get(
      `/api/guests/${guestId}/factures`,
    );
    expect(factures.status).toBe(200);
    expect(
      (factures.body as InvoiceResponse[]).some((f) => f.id === invoiceId),
    ).toBe(true);
  });
});
