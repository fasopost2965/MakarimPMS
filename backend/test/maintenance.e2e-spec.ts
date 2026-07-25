import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

interface TicketResponse {
  id: number;
  roomId: number | null;
  resoluAt: string | null;
}

interface StayResponse {
  id: number;
  roomId: number;
}

// Maintenance & Incidents (cahier des charges §5.8, Phase 2). Vérifie en
// particulier la connexion automatique au statut chambre (EN_MAINTENANCE à
// la création, libération vers A_NETTOYER à la résolution) et le
// non-négociable "un ticket ouvert restant garde la chambre bloquée". Vrais
// appels HTTP contre une vraie base MySQL, aucun mock.
describe('Maintenance — tickets et connexion au statut chambre (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let maintenanceClient: ReturnType<typeof authedRequest>;
  let gouvernanteClient: ReturnType<typeof authedRequest>;
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
    const maintenanceToken = await loginAs(app.getHttpServer(), 'maintenance');
    maintenanceClient = authedRequest(app.getHttpServer(), maintenanceToken);
    const gouvernanteToken = await loginAs(app.getHttpServer(), 'gouvernante');
    gouvernanteClient = authedRequest(app.getHttpServer(), gouvernanteToken);
    const adminToken = await loginAs(app.getHttpServer(), 'admin');
    adminClient = authedRequest(app.getHttpServer(), adminToken);

    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-MAINT-TYPE-${Date.now()}`,
        prixBase: 300,
        capacite: 2,
      },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    await prisma.maintenanceTicket.deleteMany({
      where: { room: { roomTypeId } },
    });
    // Le ticket sans chambre (test "sans chambre associée") n'a pas de
    // roomId : il n'est pas couvert par le filtre ci-dessus.
    await prisma.maintenanceTicket.deleteMany({
      where: { roomId: null, typePanne: 'Ascenseur en panne' },
    });
    await prisma.roomStatusLog.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.folioLine.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.folio.deleteMany({
      where: { stay: { room: { roomTypeId } } },
    });
    await prisma.roomNight.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.stay.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.reservation.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.room.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  async function createRoom() {
    const room = await prisma.room.create({
      data: {
        numero: `TEST-MAINT-${Date.now()}-${Math.random()}`,
        roomTypeId,
      },
    });
    return room.id;
  }

  it('crée un ticket sans chambre associée, sans effet sur aucun statut de chambre', async () => {
    const res = await maintenanceClient.post('/api/maintenance-tickets').send({
      typePanne: 'Ascenseur en panne',
      priorite: 'HAUTE',
    });
    expect(res.status).toBe(201);
    const ticket = res.body as TicketResponse;
    expect(ticket.roomId).toBeNull();
    expect(ticket.resoluAt).toBeNull();
  });

  it(
    'la création avec roomId bloque automatiquement la chambre en EN_MAINTENANCE, ' +
      'et la résolution la libère vers A_NETTOYER',
    async () => {
      const roomId = await createRoom();

      const created = await maintenanceClient
        .post('/api/maintenance-tickets')
        .send({ roomId, typePanne: 'Climatisation', priorite: 'MOYENNE' });
      expect(created.status).toBe(201);
      const ticketId = (created.body as TicketResponse).id;

      const roomAfterCreate = await prisma.room.findUniqueOrThrow({
        where: { id: roomId },
      });
      expect(roomAfterCreate.statut).toBe('EN_MAINTENANCE');

      const log = await prisma.roomStatusLog.findFirst({
        where: { roomId, nouveauStatut: 'EN_MAINTENANCE' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toBeDefined();
      expect(log!.motif).toBe('Climatisation');

      const resolved = await maintenanceClient.patch(
        `/api/maintenance-tickets/${ticketId}/resoudre`,
      );
      expect(resolved.status).toBe(200);
      expect((resolved.body as TicketResponse).resoluAt).not.toBeNull();

      const roomAfterResolve = await prisma.room.findUniqueOrThrow({
        where: { id: roomId },
      });
      expect(roomAfterResolve.statut).toBe('A_NETTOYER');
    },
  );

  it(
    'un ticket créé sur une chambre OCCUPEE est bien enregistré, mais le blocage automatique ' +
      "est sauté (un séjour est en cours, l'invariant existant reste respecté)",
    async () => {
      const roomId = await createRoom();

      const checkin = await adminClient.post('/api/checkin/walk-in').send({
        roomId,
        dateCheckoutPrevue: new Date(Date.now() + 2 * 86_400_000)
          .toISOString()
          .slice(0, 10),
        guest: { nom: 'Maintenance', prenom: 'Occupee' },
      });
      expect(checkin.status).toBe(201);
      const stayId = (checkin.body as StayResponse).id;

      const roomBefore = await prisma.room.findUniqueOrThrow({
        where: { id: roomId },
      });
      expect(roomBefore.statut).toBe('OCCUPEE');

      const ticket = await maintenanceClient
        .post('/api/maintenance-tickets')
        .send({ roomId, typePanne: 'Fuite robinet', priorite: 'BASSE' });
      expect(ticket.status).toBe(201);

      const roomAfter = await prisma.room.findUniqueOrThrow({
        where: { id: roomId },
      });
      expect(roomAfter.statut).toBe('OCCUPEE');

      // Solde jamais réglé dans ce test (hors périmètre — maintenance) :
      // check-out forcé (CH-005, adminClient = Administrateur).
      await adminClient.post(`/api/checkout/${stayId}`).send({
        force: true,
        motif: 'Nettoyage de fixture de test (maintenance e2e)',
      });
    },
  );

  it(
    'deux tickets ouverts sur la même chambre : résoudre le premier ne libère pas la chambre, ' +
      'résoudre le second la libère',
    async () => {
      const roomId = await createRoom();

      const ticketA = await maintenanceClient
        .post('/api/maintenance-tickets')
        .send({ roomId, typePanne: 'Panne A', priorite: 'MOYENNE' });
      const ticketAId = (ticketA.body as TicketResponse).id;

      const ticketB = await maintenanceClient
        .post('/api/maintenance-tickets')
        .send({ roomId, typePanne: 'Panne B', priorite: 'MOYENNE' });
      const ticketBId = (ticketB.body as TicketResponse).id;

      const roomAfterBoth = await prisma.room.findUniqueOrThrow({
        where: { id: roomId },
      });
      expect(roomAfterBoth.statut).toBe('EN_MAINTENANCE');

      const resolveA = await maintenanceClient.patch(
        `/api/maintenance-tickets/${ticketAId}/resoudre`,
      );
      expect(resolveA.status).toBe(200);

      const roomAfterA = await prisma.room.findUniqueOrThrow({
        where: { id: roomId },
      });
      expect(roomAfterA.statut).toBe('EN_MAINTENANCE');

      const resolveB = await maintenanceClient.patch(
        `/api/maintenance-tickets/${ticketBId}/resoudre`,
      );
      expect(resolveB.status).toBe(200);

      const roomAfterB = await prisma.room.findUniqueOrThrow({
        where: { id: roomId },
      });
      expect(roomAfterB.statut).toBe('A_NETTOYER');
    },
  );

  it("le rôle Gouvernante peut lister les tickets (read) mais reçoit 403 en tentant d'en créer un", async () => {
    const list = await gouvernanteClient.get('/api/maintenance-tickets');
    expect(list.status).toBe(200);

    const create = await gouvernanteClient
      .post('/api/maintenance-tickets')
      .send({ typePanne: 'Test permission', priorite: 'BASSE' });
    expect(create.status).toBe(403);
  });
});
