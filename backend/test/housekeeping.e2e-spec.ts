import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

interface RoomResponse {
  id: number;
  numero: string;
  statut: string;
}

interface ReservationResponse {
  id: number;
}

interface StayResponse {
  id: number;
  roomId: number;
}

// Housekeeping simplifié (cahier des charges §5.6, Phase 1). Vérifie en
// particulier le contrôle croisé non négociable avec le module
// checkin/reservations : une chambre OCCUPEE ne doit jamais pouvoir être
// "libérée" par un changement manuel de statut — seul le check-out (qui
// libère aussi le verrou RoomNight) le peut. Vrais appels HTTP contre une
// vraie base MySQL, aucun mock.
describe('Housekeeping — statuts de chambre (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roomTypeId: number;
  let roomId: number;
  let client: ReturnType<typeof authedRequest>;
  let adminClient: ReturnType<typeof authedRequest>;

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
    const token = await loginAs(app.getHttpServer(), 'reception');
    client = authedRequest(app.getHttpServer(), token);
    // CH-005 : la Réception n'a pas checkin:force-checkout — nécessaire pour
    // le check-out forcé de fixtures de test au solde jamais réglé.
    const adminToken = await loginAs(app.getHttpServer(), 'admin');
    adminClient = authedRequest(app.getHttpServer(), adminToken);

    const roomType = await prisma.roomType.create({
      data: { nom: 'TEST-HOUSEKEEPING-TYPE', prixBase: 300, capacite: 2 },
    });
    roomTypeId = roomType.id;

    const room = await prisma.room.create({
      data: { numero: `TEST-HK-${Date.now()}`, roomTypeId },
    });
    roomId = room.id;
  });

  afterAll(async () => {
    await prisma.roomNight.deleteMany({ where: { roomId } });
    await prisma.folioLine.deleteMany({
      where: { folio: { stay: { roomId } } },
    });
    await prisma.folio.deleteMany({ where: { stay: { roomId } } });
    await prisma.stay.deleteMany({ where: { roomId } });
    await prisma.reservation.deleteMany({ where: { roomId } });
    await prisma.roomStatusLog.deleteMany({ where: { roomId } });
    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  it('liste les chambres avec leur statut via GET /rooms', async () => {
    const res = await client.get('/api/rooms');
    expect(res.status).toBe(200);
    const rooms = res.body as RoomResponse[];
    const ours = rooms.find((r) => r.id === roomId);
    expect(ours).toBeDefined();
    expect(ours!.statut).toBe('LIBRE_PROPRE');
  });

  it("n'accepte que les trois statuts pilotables manuellement", async () => {
    const res = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'RESERVEE' });
    expect(res.status).toBe(400);
  });

  it('change librement le statut entre LIBRE_PROPRE / A_NETTOYER / EN_MAINTENANCE', async () => {
    const toMaintenance = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'EN_MAINTENANCE' });
    expect(toMaintenance.status).toBe(200);
    expect((toMaintenance.body as RoomResponse).statut).toBe('EN_MAINTENANCE');

    const backToClean = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'LIBRE_PROPRE' });
    expect(backToClean.status).toBe(200);
    expect((backToClean.body as RoomResponse).statut).toBe('LIBRE_PROPRE');
  });

  it(
    'refuse tout changement manuel tant que la chambre est OCCUPEE (contrôle croisé avec checkin), ' +
      "et l'autorise de nouveau après le check-out",
    async () => {
      const reservation = await client.post('/api/reservations').send({
        roomId,
        dateArrivee: new Date().toISOString().slice(0, 10),
        dateDepart: new Date(Date.now() + 2 * 86_400_000)
          .toISOString()
          .slice(0, 10),
        guest: { nom: 'Housekeeping', prenom: 'Test' },
      });
      const reservationId = (reservation.body as ReservationResponse).id;

      const checkin = await client.post(`/api/checkin/${reservationId}`).send();
      expect(checkin.status).toBe(201);
      const stayId = (checkin.body as StayResponse).id;

      const roomAfterCheckin = await client.get('/api/rooms');
      const ours = (roomAfterCheckin.body as RoomResponse[]).find(
        (r) => r.id === roomId,
      );
      expect(ours!.statut).toBe('OCCUPEE');

      // Contrôle croisé : impossible de "libérer" manuellement la chambre
      // pendant que le séjour est en cours.
      const blocked = await client
        .patch(`/api/rooms/${roomId}/statut`)
        .send({ statut: 'LIBRE_PROPRE' });
      expect(blocked.status).toBe(409);

      // Solde jamais réglé dans ce test (hors périmètre — statuts de
      // chambre) : check-out forcé par un Administrateur (CH-005) — la
      // Réception (client) n'a pas checkin:force-checkout.
      const checkout = await adminClient.post(`/api/checkout/${stayId}`).send({
        force: true,
        motif: 'Nettoyage de fixture de test (housekeeping e2e)',
      });
      expect(checkout.status).toBe(201);

      const roomAfterCheckout = await client.get('/api/rooms');
      const oursAfter = (roomAfterCheckout.body as RoomResponse[]).find(
        (r) => r.id === roomId,
      );
      expect(oursAfter!.statut).toBe('A_NETTOYER');

      // Le check-out a bien libéré la chambre : le changement manuel est de
      // nouveau accepté.
      const allowed = await client
        .patch(`/api/rooms/${roomId}/statut`)
        .send({ statut: 'LIBRE_PROPRE' });
      expect(allowed.status).toBe(200);
      expect((allowed.body as RoomResponse).statut).toBe('LIBRE_PROPRE');
    },
  );

  // CH-014 (docs/governance/REGISTRE_CHANTIERS.md) — RoomStatusLog était
  // peuplée à chaque transition mais jamais lue par aucune route avant ce
  // chantier.
  describe('GET /rooms/:id/historique-statuts (CH-014)', () => {
    it('renvoie les transitions les plus récentes en premier, avec ancien/nouveau statut', async () => {
      const toMaintenance = await client
        .patch(`/api/rooms/${roomId}/statut`)
        .send({ statut: 'EN_MAINTENANCE' });
      expect(toMaintenance.status).toBe(200);

      const backToClean = await client
        .patch(`/api/rooms/${roomId}/statut`)
        .send({ statut: 'LIBRE_PROPRE' });
      expect(backToClean.status).toBe(200);

      const res = await client.get(`/api/rooms/${roomId}/historique-statuts`);
      expect(res.status).toBe(200);
      const entries = res.body as {
        id: number;
        roomId: number;
        ancienStatut: string;
        nouveauStatut: string;
        createdAt: string;
      }[];
      expect(entries.length).toBeGreaterThanOrEqual(2);
      expect(entries.every((e) => e.roomId === roomId)).toBe(true);

      // Le plus récent en premier (LIBRE_PROPRE ← EN_MAINTENANCE), avant
      // l'entrée du passage en EN_MAINTENANCE juste précédente.
      expect(entries[0].ancienStatut).toBe('EN_MAINTENANCE');
      expect(entries[0].nouveauStatut).toBe('LIBRE_PROPRE');
      expect(entries[1].nouveauStatut).toBe('EN_MAINTENANCE');
      const dates = entries.map((e) => new Date(e.createdAt).getTime());
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    });

    it('renvoie 404 pour une chambre inexistante', async () => {
      const res = await client.get('/api/rooms/999999999/historique-statuts');
      expect(res.status).toBe(404);
    });

    it('exige housekeeping:read (403 pour un rôle sans cette permission)', async () => {
      const maintenanceToken = await loginAs(
        app.getHttpServer(),
        'maintenance',
      );
      const maintenanceClient = authedRequest(
        app.getHttpServer(),
        maintenanceToken,
      );
      const res = await maintenanceClient.get(
        `/api/rooms/${roomId}/historique-statuts`,
      );
      expect(res.status).toBe(403);
    });
  });
});
