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
  let receptionUserId: number;

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
    // Assigné des tâches de fixture à Réception (jamais à l'Administrateur
    // lui-même) : validate() interdit explicitement l'auto-validation
    // (actorId === assignedUserId) — assigner puis valider avec le même
    // compte admin serait rejeté en 409, pas un bug du garde-fou.
    receptionUserId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'reception@makarim.test' },
        select: { id: true },
      })
    ).id;

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
    await prisma.maintenanceTicket.deleteMany({ where: { roomId } });
    await prisma.stockMovement.deleteMany({
      where: { housekeepingStockConsumption: { housekeepingTask: { roomId } } },
    });
    await prisma.housekeepingStockConsumption.deleteMany({
      where: { housekeepingTask: { roomId } },
    });
    await prisma.housekeepingTaskLog.deleteMany({
      where: { task: { roomId } },
    });
    await prisma.housekeepingTask.deleteMany({ where: { roomId } });
    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  // Remet une chambre A_NETTOYER/EN_NETTOYAGE à LIBRE_PROPRE via le cycle
  // HousekeepingTask complet (seul chemin restant, B0.4A) : création,
  // assignation à Réception — jamais à l'Administrateur qui exécute ensuite
  // start()/complete()/validate() via housekeeping:control (bypass de
  // l'exigence "agent assigné"), ce qui exige un assigné distinct de
  // l'acteur : valider sa propre tâche est explicitement interdit
  // (auto-validation, voir HousekeepingTaskService.validate).
  async function runFullTaskCycle(motif: string) {
    const task = await adminClient
      .post('/api/housekeeping/tasks')
      .send({ roomId, motif });
    expect(task.status).toBe(201);
    const taskId = (task.body as { id: number }).id;

    const assign = await adminClient
      .patch(`/api/housekeeping/tasks/${taskId}/assignment`)
      .send({ assignedUserId: receptionUserId });
    expect(assign.status).toBe(200);

    const start = await adminClient.post(
      `/api/housekeeping/tasks/${taskId}/start`,
    );
    expect(start.status).toBe(201);
    const complete = await adminClient.post(
      `/api/housekeeping/tasks/${taskId}/complete`,
    );
    expect(complete.status).toBe(201);
    const validate = await adminClient
      .post(`/api/housekeeping/tasks/${taskId}/validate`)
      .send({ motif });
    expect(validate.status).toBe(201);
    return taskId;
  }

  // Variante pour une tâche déjà créée (ex. origine CHECKOUT, auto-créée
  // par le listener checkout.effectue) : assignation + cycle complet, sans
  // recréer de tâche (create() échouerait, activeRoomKey déjà pris).
  async function assignAndRunExistingTask(taskId: number, motif: string) {
    const assign = await adminClient
      .patch(`/api/housekeeping/tasks/${taskId}/assignment`)
      .send({ assignedUserId: receptionUserId });
    expect(assign.status).toBe(200);

    const start = await adminClient.post(
      `/api/housekeeping/tasks/${taskId}/start`,
    );
    expect(start.status).toBe(201);
    const complete = await adminClient.post(
      `/api/housekeeping/tasks/${taskId}/complete`,
    );
    expect(complete.status).toBe(201);
    const validate = await adminClient
      .post(`/api/housekeeping/tasks/${taskId}/validate`)
      .send({ motif });
    expect(validate.status).toBe(201);
  }

  it('liste les chambres avec leur statut via GET /rooms', async () => {
    const res = await client.get('/api/rooms');
    expect(res.status).toBe(200);
    const rooms = res.body as RoomResponse[];
    const ours = rooms.find((r) => r.id === roomId);
    expect(ours).toBeDefined();
    expect(ours!.statut).toBe('LIBRE_PROPRE');
  });

  it("n'accepte que A_NETTOYER comme cible manuelle (B0.4A, confinement legacy)", async () => {
    const res = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'RESERVEE' });
    expect(res.status).toBe(400);
  });

  // B0.4A (DESIGN-004B, Finding 1/2) — LIBRE_PROPRE ne peut plus provenir
  // que de HousekeepingTaskService.validate() (contrôle Gouvernante
  // obligatoire), EN_MAINTENANCE que de MaintenanceService.createTicket()
  // (un vrai MaintenanceTicket doit exister). Le PATCH manuel legacy doit
  // rejeter les deux en 400, avant même d'atteindre la logique métier.
  it('rejette LIBRE_PROPRE et EN_MAINTENANCE en 400 via le PATCH manuel legacy', async () => {
    const toLibre = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'LIBRE_PROPRE' });
    expect(toLibre.status).toBe(400);

    const toMaintenance = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'EN_MAINTENANCE' });
    expect(toMaintenance.status).toBe(400);

    const toNettoyage = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'EN_NETTOYAGE' });
    expect(toNettoyage.status).toBe(400);

    // La chambre n'a bougé sur aucune des trois tentatives rejetées.
    const rooms = await client.get('/api/rooms');
    const ours = (rooms.body as RoomResponse[]).find((r) => r.id === roomId);
    expect(ours!.statut).toBe('LIBRE_PROPRE');
  });

  // B0.4A (DESIGN-004B, Finding 1) — preuve directe de sabotage/restore du
  // garde-fou HIGH ("A_NETTOYER + tâche active => 409 sans écriture
  // Room/RoomStatusLog") : sans le garde-fou (contournable en spécifiant
  // n'importe quelle cible historiquement acceptée), une HousekeepingTask
  // active pouvait devenir orpheline et bloquer un check-out ultérieur —
  // voir housekeeping-task.service.ts createOrReuseCheckoutTask.
  it('refuse en 409 un PATCH manuel A_NETTOYER quand une HousekeepingTask active existe déjà, sans écrire Room/RoomStatusLog', async () => {
    // Fixture : la chambre doit être A_NETTOYER pour créer une tâche
    // manuelle valide (même contrainte que createTask origine MANUELLE).
    const toDirty = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'A_NETTOYER' });
    expect(toDirty.status).toBe(200);

    const task = await client
      .post('/api/housekeeping/tasks')
      .send({ roomId, motif: 'Tâche de test B0.4A (garde-fou legacy)' });
    expect(task.status).toBe(201);

    const logsBefore = await prisma.roomStatusLog.count({
      where: { roomId },
    });

    // Le message assert ci-dessous distingue explicitement la cause du 409 :
    // sans le garde-fou dédié, PATCH A_NETTOYER alors que la chambre est
    // déjà A_NETTOYER échouerait de toute façon (canTransition ne définit
    // pas de boucle A_NETTOYER -> A_NETTOYER), mais avec un message
    // "Transition de statut invalide" — pas le message du garde-fou. Vérifié
    // par sabotage/restore : le garde-fou (housekeeping.service.ts,
    // recherche activeRoomKey) a été temporairement commenté pendant le
    // développement de ce lot, ce test échouait alors sur un message
    // "Transition de statut invalide" au lieu de "tâche de ménage active"
    // (409 obtenu par une cause différente, donc non discriminant) ; garde-fou
    // restauré, test revérifié vert avec le bon message ci-dessous.
    const conflict = await client
      .patch(`/api/rooms/${roomId}/statut`)
      .send({ statut: 'A_NETTOYER' });
    expect(conflict.status).toBe(409);
    expect((conflict.body as { message?: string }).message).toMatch(
      /tâche de ménage active/i,
    );

    const logsAfter = await prisma.roomStatusLog.count({ where: { roomId } });
    expect(logsAfter).toBe(logsBefore);

    const roomsAfter = await client.get('/api/rooms');
    const oursAfter = (roomsAfter.body as RoomResponse[]).find(
      (r) => r.id === roomId,
    );
    expect(oursAfter!.statut).toBe('A_NETTOYER');

    // Nettoyage de fixture : annule la tâche (libère activeRoomKey), puis
    // remet la chambre à LIBRE_PROPRE via le seul chemin restant
    // (HousekeepingTask complet, via adminClient : housekeeping:control est
    // requis pour valider et pour démarrer/compléter une tâche non
    // assignée, permission que Réception n'a pas) — les tests suivants du
    // fichier partagent le même roomId et présupposent une chambre
    // LIBRE_PROPRE au départ.
    const taskId = (task.body as { id: number }).id;
    await client
      .post(`/api/housekeeping/tasks/${taskId}/cancel`)
      .send({ motif: 'Nettoyage de fixture de test (housekeeping e2e)' });

    await runFullTaskCycle('Remise en état de fixture (housekeeping e2e)');

    const roomsClean = await client.get('/api/rooms');
    const oursClean = (roomsClean.body as RoomResponse[]).find(
      (r) => r.id === roomId,
    );
    expect(oursClean!.statut).toBe('LIBRE_PROPRE');
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

      const checkin = await client
        .post(`/api/checkin/${reservationId}`)
        .send({ nombreOccupants: 1 });
      expect(checkin.status).toBe(201);
      const stayId = (checkin.body as StayResponse).id;

      const roomAfterCheckin = await client.get('/api/rooms');
      const ours = (roomAfterCheckin.body as RoomResponse[]).find(
        (r) => r.id === roomId,
      );
      expect(ours!.statut).toBe('OCCUPEE');

      // Contrôle croisé : impossible de "libérer" manuellement la chambre
      // pendant que le séjour est en cours. Cible A_NETTOYER (seule cible
      // DTO-valide depuis B0.4A) — LIBRE_PROPRE ne discriminerait plus rien
      // ici puisqu'elle est désormais rejetée en 400 par le DTO quel que
      // soit le statut de la chambre.
      const blocked = await client
        .patch(`/api/rooms/${roomId}/statut`)
        .send({ statut: 'A_NETTOYER' });
      expect(blocked.status).toBe(409);
      expect((blocked.body as { message?: string }).message).toMatch(
        /occupée ou en départ prévu/i,
      );

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

      // Le check-out a bien libéré le blocage OCCUPEE/DEPART_PREVU — mais
      // le check-out a aussi créé sa propre HousekeepingTask (origine
      // CHECKOUT, listener checkout.effectue) : le PATCH manuel reste donc
      // bloqué, cette fois par le garde-fou "tâche active" (B0.4A), pas par
      // le contrôle croisé OCCUPEE. Seul le cycle HousekeepingTask complet
      // ramène la chambre à LIBRE_PROPRE désormais.
      const stillBlocked = await client
        .patch(`/api/rooms/${roomId}/statut`)
        .send({ statut: 'A_NETTOYER' });
      expect(stillBlocked.status).toBe(409);
      expect((stillBlocked.body as { message?: string }).message).toMatch(
        /tâche de ménage active/i,
      );

      const task = await prisma.housekeepingTask.findFirstOrThrow({
        where: { roomId, activeRoomKey: roomId },
      });
      await assignAndRunExistingTask(
        task.id,
        'Nettoyage de fixture de test (housekeeping e2e)',
      );

      const roomsFinal = await client.get('/api/rooms');
      const oursFinal = (roomsFinal.body as RoomResponse[]).find(
        (r) => r.id === roomId,
      );
      expect(oursFinal!.statut).toBe('LIBRE_PROPRE');
    },
  );

  // CH-014 (docs/governance/REGISTRE_CHANTIERS.md) — RoomStatusLog était
  // peuplée à chaque transition mais jamais lue par aucune route avant ce
  // chantier.
  describe('GET /rooms/:id/historique-statuts (CH-014)', () => {
    it('renvoie les transitions les plus récentes en premier, avec ancien/nouveau statut', async () => {
      // B0.4A (confinement legacy) — EN_MAINTENANCE ne peut plus être
      // atteint par PATCH manuel : fixture reconstruite via un vrai
      // MaintenanceTicket (seul chemin canonique restant), résolu ensuite
      // pour générer la seconde transition (EN_MAINTENANCE -> A_NETTOYER,
      // getRoomStatusAfterMaintenance sans tâche active).
      const ticket = await adminClient.post('/api/maintenance-tickets').send({
        roomId,
        typePanne: 'Fixture de test CH-014 (B0.4A)',
      });
      expect(ticket.status).toBe(201);
      const ticketId = (ticket.body as { id: number }).id;

      const resolved = await adminClient.patch(
        `/api/maintenance-tickets/${ticketId}/resoudre`,
      );
      expect(resolved.status).toBe(200);

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

      // Le plus récent en premier (A_NETTOYER ← EN_MAINTENANCE, résolution
      // du ticket), avant l'entrée du passage en EN_MAINTENANCE (ouverture
      // du ticket) juste précédente.
      expect(entries[0].ancienStatut).toBe('EN_MAINTENANCE');
      expect(entries[0].nouveauStatut).toBe('A_NETTOYER');
      expect(entries[1].nouveauStatut).toBe('EN_MAINTENANCE');
      const dates = entries.map((e) => new Date(e.createdAt).getTime());
      expect(dates).toEqual([...dates].sort((a, b) => b - a));

      // Remise en état pour la suite (chambre A_NETTOYER -> LIBRE_PROPRE
      // via le cycle HousekeepingTask complet, seul chemin restant).
      await runFullTaskCycle('Remise en état CH-014 (B0.4A)');
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
