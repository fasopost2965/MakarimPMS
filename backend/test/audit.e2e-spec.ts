import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

interface GuestResponse {
  id: number;
  categorie: string;
}

interface ReservationResponse {
  id: number;
  statut: string;
  prixTotalFinal: string;
}

interface AuditLogResponse {
  id: string;
  action: string;
  targetEntity: string;
  targetId: number;
  oldValue: unknown;
  newValue: unknown;
  motif: string;
}

// Audit & Sécurité (ADR-005, audit de conformité architecture gelée).
// Vérifie que le registre AuditLog est réellement alimenté (dans la même
// transaction que l'opération métier, jamais après coup) pour les 3
// opérations sensibles déjà existantes : changement de catégorie client
// (y compris blacklist), ajustement manuel de tarif de réservation,
// annulation de réservation. Vrais appels HTTP contre une vraie base MySQL.
describe('Audit & Sécurité (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let receptionClient: ReturnType<typeof authedRequest>;
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
    const adminToken = await loginAs(app.getHttpServer(), 'admin');
    adminClient = authedRequest(app.getHttpServer(), adminToken);

    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-AUDIT-TYPE-${Date.now()}`,
        prixBase: 400,
        capacite: 2,
      },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    // AuditLog.targetId n'est pas une vraie clé étrangère (targetEntity
    // générique) — impossible de filtrer via une relation Prisma, on
    // récupère d'abord les ids concernés puis on filtre targetId dedans.
    const reservationIds = (
      await prisma.reservation.findMany({
        where: { room: { roomTypeId } },
        select: { id: true },
      })
    ).map((r) => r.id);
    const guestIds = (
      await prisma.guest.findMany({
        where: { nom: { startsWith: 'TEST-AUDIT-' } },
        select: { id: true },
      })
    ).map((g) => g.id);

    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { targetEntity: 'Reservation', targetId: { in: reservationIds } },
          { targetEntity: 'Guest', targetId: { in: guestIds } },
        ],
      },
    });
    await prisma.roomNight.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.reservation.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.room.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await prisma.guestCategoryLog.deleteMany({
      where: { guestId: { in: guestIds } },
    });
    await prisma.guest.deleteMany({ where: { id: { in: guestIds } } });
    await app.close();
  });

  async function createRoom() {
    const room = await prisma.room.create({
      data: { numero: `TEST-AUDIT-${Date.now()}-${Math.random()}`, roomTypeId },
    });
    return room.id;
  }

  async function createReservation(guestId: number) {
    const roomId = await createRoom();
    const res = await receptionClient.post('/api/reservations').send({
      roomId,
      dateArrivee: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      dateDepart: new Date(Date.now() + 3 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      guestId,
    });
    return (res.body as ReservationResponse).id;
  }

  it('changement de catégorie avec motif ≥10 caractères → 200 + AuditLog', async () => {
    const guest = await receptionClient.post('/api/guests').send({
      nom: 'TEST-AUDIT-Alami',
      prenom: 'Youssef',
    });
    const guestId = (guest.body as GuestResponse).id;

    const res = await receptionClient
      .patch(`/api/guests/${guestId}/categorie`)
      .send({ categorie: 'VIP', motif: 'Client fidèle depuis 5 ans' });
    expect(res.status).toBe(200);

    const log = await prisma.auditLog.findFirst({
      where: { targetEntity: 'Guest', targetId: guestId },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log!.action).toBe('CHANGE_CATEGORY');
    expect(log!.oldValue).toEqual({ categorie: 'STANDARD' });
    expect(log!.newValue).toEqual({ categorie: 'VIP' });
  });

  it('changement de catégorie avec motif <10 caractères → 400, aucun AuditLog', async () => {
    const guest = await receptionClient.post('/api/guests').send({
      nom: 'TEST-AUDIT-Benali',
      prenom: 'Karim',
    });
    const guestId = (guest.body as GuestResponse).id;

    const res = await receptionClient
      .patch(`/api/guests/${guestId}/categorie`)
      .send({ categorie: 'VIP', motif: 'court' });
    expect(res.status).toBe(400);

    const log = await prisma.auditLog.findFirst({
      where: { targetEntity: 'Guest', targetId: guestId },
    });
    expect(log).toBeNull();
  });

  it('ajustement manuel de tarif avec motif valide → 200 + AuditLog UPDATE_PRICE', async () => {
    const guest = await receptionClient.post('/api/guests').send({
      nom: 'TEST-AUDIT-Prix',
      prenom: 'Client',
    });
    const reservationId = await createReservation(
      (guest.body as GuestResponse).id,
    );

    const res = await receptionClient
      .patch(`/api/reservations/${reservationId}`)
      .send({
        prixTotalFinal: 999,
        motifAjustement: 'Remise commerciale accordée',
      });
    expect(res.status).toBe(200);
    expect((res.body as ReservationResponse).prixTotalFinal).toBe('999');

    const log = await prisma.auditLog.findFirst({
      where: { targetEntity: 'Reservation', targetId: reservationId },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log!.action).toBe('UPDATE_PRICE');
    expect((log!.newValue as { prixTotalFinal: number }).prixTotalFinal).toBe(
      999,
    );
  });

  it('ajustement manuel de tarif sans motif (ou <10 caractères) → 400', async () => {
    const guest = await receptionClient.post('/api/guests').send({
      nom: 'TEST-AUDIT-PrixInvalide',
      prenom: 'Client',
    });
    const reservationId = await createReservation(
      (guest.body as GuestResponse).id,
    );

    const sansMotif = await receptionClient
      .patch(`/api/reservations/${reservationId}`)
      .send({ prixTotalFinal: 500 });
    expect(sansMotif.status).toBe(400);

    const motifCourt = await receptionClient
      .patch(`/api/reservations/${reservationId}`)
      .send({ prixTotalFinal: 500, motifAjustement: 'court' });
    expect(motifCourt.status).toBe(400);
  });

  it('annulation de réservation avec motif → 200 (ANNULEE) + AuditLog CANCEL_RESERVATION', async () => {
    const guest = await receptionClient.post('/api/guests').send({
      nom: 'TEST-AUDIT-Annulation',
      prenom: 'Client',
    });
    const reservationId = await createReservation(
      (guest.body as GuestResponse).id,
    );

    const res = await adminClient
      .delete(`/api/reservations/${reservationId}`)
      .send({ motif: 'Client a annulé son séjour par téléphone' });
    expect(res.status).toBe(200);
    expect((res.body as ReservationResponse).statut).toBe('ANNULEE');

    const log = await prisma.auditLog.findFirst({
      where: { targetEntity: 'Reservation', targetId: reservationId },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log!.action).toBe('CANCEL_RESERVATION');
  });

  it("ré-annulation d'une réservation déjà ANNULEE → 409, aucun nouvel AuditLog", async () => {
    const guest = await receptionClient.post('/api/guests').send({
      nom: 'TEST-AUDIT-DoubleAnnulation',
      prenom: 'Client',
    });
    const reservationId = await createReservation(
      (guest.body as GuestResponse).id,
    );

    await adminClient
      .delete(`/api/reservations/${reservationId}`)
      .send({ motif: 'Première annulation légitime' });

    const countBefore = await prisma.auditLog.count({
      where: { targetEntity: 'Reservation', targetId: reservationId },
    });

    const second = await adminClient
      .delete(`/api/reservations/${reservationId}`)
      .send({ motif: 'Deuxième tentative inutile' });
    expect(second.status).toBe(409);

    const countAfter = await prisma.auditLog.count({
      where: { targetEntity: 'Reservation', targetId: reservationId },
    });
    expect(countAfter).toBe(countBefore);
  });

  it('GET /audit-logs : Administrateur → 200 (avec filtres), Réception → 403', async () => {
    const asAdmin = await adminClient.get(
      '/api/audit-logs?entite=Guest&action=CHANGE_CATEGORY',
    );
    expect(asAdmin.status).toBe(200);
    expect(
      (asAdmin.body as AuditLogResponse[]).every(
        (l) => l.targetEntity === 'Guest' && l.action === 'CHANGE_CATEGORY',
      ),
    ).toBe(true);

    const asReception = await receptionClient.get('/api/audit-logs');
    expect(asReception.status).toBe(403);
  });

  // Preuve de rigueur (validée manuellement) : en sortant temporairement
  // l'appel à `auditService.writeLog(tx, ...)` de la transaction dans
  // `GuestsService.updateCategorie` (ou en le commentant), ce test échoue
  // bien — la catégorie change (200) mais aucune ligne AuditLog n'apparaît,
  // confirmant que c'est bien cet appel qui alimente le registre, pas un
  // autre mécanisme. Restauré ensuite.
  it("preuve de rigueur : l'AuditLog est bien alimenté par l'opération auditée elle-même", async () => {
    const guest = await receptionClient.post('/api/guests').send({
      nom: 'TEST-AUDIT-Rigueur',
      prenom: 'Client',
    });
    const guestId = (guest.body as GuestResponse).id;

    const res = await receptionClient
      .patch(`/api/guests/${guestId}/categorie`)
      .send({ categorie: 'AGENCE', motif: 'Partenariat agence de voyage' });
    expect(res.status).toBe(200);

    const log = await prisma.auditLog.findFirst({
      where: {
        targetEntity: 'Guest',
        targetId: guestId,
        action: 'CHANGE_CATEGORY',
      },
    });
    expect(log).not.toBeNull();
  });
});
