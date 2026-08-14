import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  CanalReservation,
  OrigineTacheHousekeeping,
  StatutChambre,
  StatutReservation,
  StatutSejour,
  StatutTacheHousekeeping,
} from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { MaintenanceService } from './../src/modules/maintenance/maintenance.service';
import { ReservationsService } from './../src/modules/reservations/reservations.service';
import { StayService } from './../src/modules/stay/stay.service';
import { HousekeepingTaskService } from './../src/modules/housekeeping/housekeeping-task.service';
import { authedRequest, loginAs, SEED_USERS } from './helpers/auth';

jest.setTimeout(120_000);

interface TicketResponse {
  id: number;
  roomId: number | null;
  bloqueVente: boolean;
  resoluAt: string | null;
}

describe('B0.2 — panne Maintenance bloquant la vente (MySQL e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let maintenanceService: MaintenanceService;
  let reservationsService: ReservationsService;
  let stayService: StayService;
  let housekeepingTaskService: HousekeepingTaskService;
  let maintenanceClient: ReturnType<typeof authedRequest>;
  let gouvernanteClient: ReturnType<typeof authedRequest>;
  let receptionClient: ReturnType<typeof authedRequest>;
  let adminClient: ReturnType<typeof authedRequest>;
  let roomTypeId: number;
  let maintenanceUserId: number;
  let gouvernanteUserId: number;
  let receptionUserId: number;
  let adminUserId: number;
  let adminRoleId: number;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    maintenanceService = app.get(MaintenanceService);
    reservationsService = app.get(ReservationsService);
    stayService = app.get(StayService);
    housekeepingTaskService = app.get(HousekeepingTaskService);

    const [maintenanceToken, gouvernanteToken, receptionToken, adminToken] =
      await Promise.all([
        loginAs(app.getHttpServer(), 'maintenance'),
        loginAs(app.getHttpServer(), 'gouvernante'),
        loginAs(app.getHttpServer(), 'reception'),
        loginAs(app.getHttpServer(), 'admin'),
      ]);
    maintenanceClient = authedRequest(app.getHttpServer(), maintenanceToken);
    gouvernanteClient = authedRequest(app.getHttpServer(), gouvernanteToken);
    receptionClient = authedRequest(app.getHttpServer(), receptionToken);
    adminClient = authedRequest(app.getHttpServer(), adminToken);

    const users = await prisma.user.findMany({
      where: {
        email: {
          in: [
            SEED_USERS.maintenance,
            SEED_USERS.gouvernante,
            SEED_USERS.reception,
            SEED_USERS.admin,
          ],
        },
      },
      select: { id: true, email: true, roleId: true },
    });
    const byEmail = new Map(users.map((user) => [user.email, user]));
    maintenanceUserId = byEmail.get(SEED_USERS.maintenance)!.id;
    gouvernanteUserId = byEmail.get(SEED_USERS.gouvernante)!.id;
    receptionUserId = byEmail.get(SEED_USERS.reception)!.id;
    adminUserId = byEmail.get(SEED_USERS.admin)!.id;
    adminRoleId = byEmail.get(SEED_USERS.admin)!.roleId;

    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-B02-${suffix}`,
        prixBase: 350,
        capacite: 2,
      },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    if (prisma && roomTypeId) {
      const rooms = await prisma.room.findMany({
        where: { roomTypeId },
        select: { id: true },
      });
      const roomIds = rooms.map((room) => room.id);
      const stays = await prisma.stay.findMany({
        where: { roomId: { in: roomIds } },
        select: { id: true },
      });
      const stayIds = stays.map((stay) => stay.id);
      const reservations = await prisma.reservation.findMany({
        where: { roomId: { in: roomIds } },
        select: { id: true },
      });
      const reservationIds = reservations.map((reservation) => reservation.id);

      await prisma.notificationLog.deleteMany({
        where: {
          OR: [
            { reservationId: { in: reservationIds } },
            { guest: { email: { startsWith: `b02-${suffix}` } } },
          ],
        },
      });
      await prisma.stockMovement.deleteMany({
        where: { roomId: { in: roomIds } },
      });
      await prisma.maintenanceTicket.deleteMany({
        where: { roomId: { in: roomIds } },
      });
      await prisma.housekeepingTaskLog.deleteMany({
        where: { task: { roomId: { in: roomIds } } },
      });
      await prisma.stockMovement.deleteMany({
        where: {
          housekeepingStockConsumption: {
            housekeepingTask: { roomId: { in: roomIds } },
          },
        },
      });
      await prisma.housekeepingStockConsumption.deleteMany({
        where: { housekeepingTask: { roomId: { in: roomIds } } },
      });
      await prisma.housekeepingTask.deleteMany({
        where: { roomId: { in: roomIds } },
      });
      await prisma.folioLine.deleteMany({
        where: { folio: { stayId: { in: stayIds } } },
      });
      await prisma.folio.deleteMany({ where: { stayId: { in: stayIds } } });
      await prisma.roomNight.deleteMany({
        where: { roomId: { in: roomIds } },
      });
      await prisma.stay.deleteMany({ where: { id: { in: stayIds } } });
      await prisma.reservation.deleteMany({
        where: { id: { in: reservationIds } },
      });
      await prisma.roomStatusLog.deleteMany({
        where: { roomId: { in: roomIds } },
      });
      await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
      await prisma.roomType.delete({ where: { id: roomTypeId } });
      await prisma.guest.deleteMany({
        where: { email: { startsWith: `b02-${suffix}` } },
      });
    }
    if (app) await app.close();
  });

  async function createRoom(
    label: string,
    statut: StatutChambre = StatutChambre.LIBRE_PROPRE,
  ) {
    return prisma.room.create({
      data: {
        numero: `B02-${label}-${suffix}`,
        roomTypeId,
        statut,
      },
    });
  }

  function dateIn(days: number) {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  }

  function guest(label: string) {
    return {
      nom: `B02-${label}`,
      prenom: 'Test',
      email: `b02-${suffix}-${label}@example.test`,
    };
  }

  async function openBlocker(roomId: number, label: string) {
    return maintenanceService.createTicket(
      {
        roomId,
        typePanne: `B02 ${label}`,
        bloqueVente: true,
      },
      maintenanceUserId,
    );
  }

  async function createTaskForRace(
    label: string,
    taskStatus: StatutTacheHousekeeping,
  ) {
    const roomStatus =
      taskStatus === StatutTacheHousekeeping.AFFECTEE
        ? StatutChambre.A_NETTOYER
        : StatutChambre.EN_NETTOYAGE;
    const room = await createRoom(label, roomStatus);
    const task = await prisma.housekeepingTask.create({
      data: {
        roomId: room.id,
        assignedUserId: receptionUserId,
        statut: taskStatus,
        origine: OrigineTacheHousekeeping.MANUELLE,
        activeRoomKey: room.id,
        assignedAt: new Date(),
        startedAt:
          taskStatus === StatutTacheHousekeeping.AFFECTEE ? null : new Date(),
        completedAt:
          taskStatus === StatutTacheHousekeeping.TERMINEE ? new Date() : null,
      },
    });
    return { room, task };
  }

  function expectConcurrentConflict(result: PromiseSettledResult<unknown>) {
    if (result.status === 'rejected') {
      expect(result.reason).toBeInstanceOf(ConflictException);
    }
  }

  it('applique le défaut bloquant, mais un ticket explicitement non bloquant ne gêne ni disponibilité ni réservation', async () => {
    const blockedRoom = await createRoom('sales-blocked');
    const nonBlockingRoom = await createRoom('sales-nonblocking');

    const defaultTicket = await maintenanceService.createTicket(
      { roomId: blockedRoom.id, typePanne: 'Défaut bloquant' },
      maintenanceUserId,
    );
    expect(defaultTicket.bloqueVente).toBe(true);

    const nonBlockingTicket = await maintenanceService.createTicket(
      {
        roomId: nonBlockingRoom.id,
        typePanne: 'Rayure décorative',
        bloqueVente: false,
      },
      maintenanceUserId,
    );
    expect(nonBlockingTicket.bloqueVente).toBe(false);

    const availability = await reservationsService.checkAvailability({
      dateDebut: dateIn(2),
      dateFin: dateIn(4),
    });
    expect(availability.map((room) => room.id)).not.toContain(blockedRoom.id);
    expect(availability.map((room) => room.id)).toContain(nonBlockingRoom.id);

    const blockedCheck = await reservationsService.checkRoomAvailability({
      roomId: blockedRoom.id,
      dateArrivee: dateIn(2),
      dateDepart: dateIn(4),
    });
    expect(blockedCheck).toMatchObject({
      disponible: false,
      motifIndisponibilite: 'Panne de maintenance ouverte bloquant la vente.',
    });

    await expect(
      reservationsService.create({
        canal: CanalReservation.DIRECT,
        roomId: blockedRoom.id,
        dateArrivee: dateIn(2),
        dateDepart: dateIn(4),
        nombreOccupants: 1,
        guest: guest('reservation-blocked'),
      }),
    ).rejects.toThrow(ConflictException);

    await expect(
      stayService.checkinWalkIn({
        roomId: blockedRoom.id,
        dateCheckoutPrevue: dateIn(2),
        nombreOccupants: 1,
        guest: guest('walkin-blocked'),
      }),
    ).rejects.toThrow(ConflictException);

    const allowedReservation = await reservationsService.create({
      canal: CanalReservation.DIRECT,
      roomId: nonBlockingRoom.id,
      dateArrivee: dateIn(5),
      dateDepart: dateIn(7),
      nombreOccupants: 1,
      guest: guest('reservation-allowed'),
    });
    expect(allowedReservation.statut).toBe(StatutReservation.CONFIRMEE);

    await expect(
      reservationsService.update(
        allowedReservation.id,
        { roomId: blockedRoom.id },
        receptionUserId,
      ),
    ).rejects.toThrow(ConflictException);
    const reservationAfterRejectedMove =
      await prisma.reservation.findUniqueOrThrow({
        where: { id: allowedReservation.id },
      });
    expect(reservationAfterRejectedMove.roomId).toBe(nonBlockingRoom.id);
    expect(
      await prisma.roomNight.count({
        where: {
          reservationId: allowedReservation.id,
          roomId: nonBlockingRoom.id,
        },
      }),
    ).toBe(2);
  });

  it('conserve une réservation existante mais refuse son check-in tant que le bloqueur est ouvert', async () => {
    const room = await createRoom('existing-reservation');
    const reservation = await reservationsService.create({
      canal: CanalReservation.DIRECT,
      roomId: room.id,
      dateArrivee: dateIn(8),
      dateDepart: dateIn(10),
      nombreOccupants: 1,
      guest: guest('existing-reservation'),
    });
    await openBlocker(room.id, 'checkin existant');

    await expect(
      stayService.checkinFromReservation(
        reservation.id,
        { nombreOccupants: 1 },
        receptionUserId,
      ),
    ).rejects.toThrow(ConflictException);

    const freshReservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(freshReservation.statut).toBe(StatutReservation.CONFIRMEE);
    expect(
      await prisma.stay.count({ where: { reservationId: reservation.id } }),
    ).toBe(0);
  });

  it('autorise Maintenance, Gouvernante et Admin à reclassifier, mais jamais Réception', async () => {
    const room = await createRoom('classification');
    const created = await maintenanceClient
      .post('/api/maintenance-tickets')
      .send({
        roomId: room.id,
        typePanne: 'Défaut cosmétique',
        bloqueVente: false,
      });
    expect(created.status).toBe(201);
    const ticketId = (created.body as TicketResponse).id;

    const byMaintenance = await maintenanceClient
      .patch(`/api/maintenance-tickets/${ticketId}/classification`)
      .send({ bloqueVente: true });
    expect(byMaintenance.status).toBe(200);
    expect((byMaintenance.body as TicketResponse).bloqueVente).toBe(true);

    // B0.4A (DESIGN-004B, confinement legacy) — LIBRE_PROPRE a été retiré de
    // MANUAL_TARGETS : la tentative échoue désormais en 400 (rejet DTO,
    // avant même d'atteindre assertNoActiveSalesBlocker), pas en 409. La
    // garantie sous-jacente (aucune remise en vente manuelle possible tant
    // qu'un ticket bloque) reste vérifiée, à un niveau plus strict encore.
    const manualRelease = await gouvernanteClient
      .patch(`/api/rooms/${room.id}/statut`)
      .send({ statut: StatutChambre.LIBRE_PROPRE });
    expect(manualRelease.status).toBe(400);

    const byReception = await receptionClient
      .patch(`/api/maintenance-tickets/${ticketId}/classification`)
      .send({ bloqueVente: false });
    expect(byReception.status).toBe(403);

    const byGouvernante = await gouvernanteClient
      .patch(`/api/maintenance-tickets/${ticketId}/classification`)
      .send({ bloqueVente: false });
    expect(byGouvernante.status).toBe(200);
    expect((byGouvernante.body as TicketResponse).bloqueVente).toBe(false);

    const byAdmin = await adminClient
      .patch(`/api/maintenance-tickets/${ticketId}/classification`)
      .send({ bloqueVente: true });
    expect(byAdmin.status).toBe(200);
    expect((byAdmin.body as TicketResponse).bloqueVente).toBe(true);
  });

  it('sérialise deux ouvertures puis deux résolutions concurrentes et ne libère jamais vers LIBRE_PROPRE', async () => {
    const room = await createRoom('two-blockers');
    const [blockerA, blockerB] = await Promise.all([
      openBlocker(room.id, 'bloqueur A'),
      openBlocker(room.id, 'bloqueur B'),
    ]);

    const resolutions = await Promise.allSettled([
      maintenanceService.resolve(blockerA.id, maintenanceUserId),
      maintenanceService.resolve(blockerB.id, maintenanceUserId),
    ]);
    expect(resolutions.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
    ]);
    expect(
      await prisma.maintenanceTicket.count({
        where: {
          roomId: room.id,
          bloqueVente: true,
          resoluAt: null,
        },
      }),
    ).toBe(0);
    expect(
      (await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).statut,
    ).toBe(StatutChambre.A_NETTOYER);
  });

  it('relit le bloqueur en current read après un snapshot MySQL antérieur', async () => {
    const room = await createRoom('current-read');
    let signalSnapshotReady!: () => void;
    let signalBlockerCommitted!: () => void;
    const snapshotReady = new Promise<void>((resolve) => {
      signalSnapshotReady = resolve;
    });
    const blockerCommitted = new Promise<void>((resolve) => {
      signalBlockerCommitted = resolve;
    });

    const guardedDecision = prisma.$transaction(async (tx) => {
      // Établit volontairement un snapshot REPEATABLE READ avant le ticket.
      await tx.room.findUniqueOrThrow({ where: { id: room.id } });
      signalSnapshotReady();
      await blockerCommitted;
      await maintenanceService.assertNoActiveSalesBlocker(room.id, tx);
    });

    await snapshotReady;
    await openBlocker(room.id, 'current read');
    signalBlockerCommitted();
    await expect(guardedDecision).rejects.toThrow(ConflictException);
  });

  it('relit la projection Housekeeping après snapshot et attente du verrou Room', async () => {
    const { room, task } = await createTaskForRace(
      'projection-current-read',
      StatutTacheHousekeeping.TERMINEE,
    );
    const blocker = await openBlocker(room.id, 'projection current read');
    let signalRoomLocked!: () => void;
    let signalSnapshotReady!: () => void;
    const roomLocked = new Promise<void>((resolve) => {
      signalRoomLocked = resolve;
    });
    const snapshotReady = new Promise<void>((resolve) => {
      signalSnapshotReady = resolve;
    });

    const assignment = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM Room
        WHERE id = ${room.id}
        FOR UPDATE
      `;
      signalRoomLocked();
      await snapshotReady;
      await housekeepingTaskService.assign(
        task.id,
        receptionUserId,
        gouvernanteUserId,
        'Réaffectation concurrente pendant la résolution B0.2',
        tx,
      );
    });

    await roomLocked;
    const projection = prisma.$transaction(async (tx) => {
      // Même snapshot antérieur que le ticketHint de resolve()/classify().
      await tx.maintenanceTicket.findUniqueOrThrow({
        where: { id: blocker.id },
      });
      signalSnapshotReady();
      await tx.$queryRaw`
        SELECT id
        FROM Room
        WHERE id = ${room.id}
        FOR UPDATE
      `;
      return housekeepingTaskService.getRoomStatusAfterMaintenance(room.id, tx);
    });

    await expect(projection).resolves.toBe(StatutChambre.A_NETTOYER);
    await assignment;
  });

  it('sérialise démarrage Housekeeping ↔ ouverture bloqueur', async () => {
    const { room, task } = await createTaskForRace(
      'race-start',
      StatutTacheHousekeeping.AFFECTEE,
    );
    const [startResult, blockerResult] = await Promise.allSettled([
      housekeepingTaskService.start(task.id, receptionUserId),
      openBlocker(room.id, 'concurrence start'),
    ]);
    expect(blockerResult.status).toBe('fulfilled');
    expectConcurrentConflict(startResult);

    const freshRoom = await prisma.room.findUniqueOrThrow({
      where: { id: room.id },
    });
    const freshTask = await prisma.housekeepingTask.findUniqueOrThrow({
      where: { id: task.id },
    });
    expect(freshRoom.statut).toBe(StatutChambre.EN_MAINTENANCE);
    expect([
      StatutTacheHousekeeping.AFFECTEE,
      StatutTacheHousekeeping.EN_COURS,
    ]).toContain(freshTask.statut);
  });

  it('sérialise complétion Housekeeping ↔ ouverture bloqueur', async () => {
    const { room, task } = await createTaskForRace(
      'race-complete',
      StatutTacheHousekeeping.EN_COURS,
    );
    const [completeResult, blockerResult] = await Promise.allSettled([
      housekeepingTaskService.complete(task.id, receptionUserId),
      openBlocker(room.id, 'concurrence complete'),
    ]);
    expect(blockerResult.status).toBe('fulfilled');
    expectConcurrentConflict(completeResult);

    const freshRoom = await prisma.room.findUniqueOrThrow({
      where: { id: room.id },
    });
    const freshTask = await prisma.housekeepingTask.findUniqueOrThrow({
      where: { id: task.id },
    });
    expect(freshRoom.statut).toBe(StatutChambre.EN_MAINTENANCE);
    expect([
      StatutTacheHousekeeping.EN_COURS,
      StatutTacheHousekeeping.TERMINEE,
    ]).toContain(freshTask.statut);
  });

  it('sérialise validation Housekeeping ↔ ouverture bloqueur et restaure le palier d’inspection', async () => {
    const { room, task } = await createTaskForRace(
      'race-validate',
      StatutTacheHousekeeping.TERMINEE,
    );
    const [validateResult, blockerResult] = await Promise.allSettled([
      housekeepingTaskService.validate(
        task.id,
        gouvernanteUserId,
        'Contrôle B0.2 concurrent validé',
      ),
      openBlocker(room.id, 'concurrence validate'),
    ]);
    expect(blockerResult.status).toBe('fulfilled');
    expectConcurrentConflict(validateResult);

    const blocker =
      blockerResult.status === 'fulfilled' ? blockerResult.value : null;
    expect(blocker).not.toBeNull();
    expect(
      (await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).statut,
    ).toBe(StatutChambre.EN_MAINTENANCE);

    await maintenanceService.resolve(blocker!.id, maintenanceUserId);
    const freshTask = await prisma.housekeepingTask.findUniqueOrThrow({
      where: { id: task.id },
    });
    const freshRoom = await prisma.room.findUniqueOrThrow({
      where: { id: room.id },
    });
    expect(freshRoom.statut).toBe(
      freshTask.statut === StatutTacheHousekeeping.TERMINEE
        ? StatutChambre.EN_NETTOYAGE
        : StatutChambre.A_NETTOYER,
    );
    expect(freshRoom.statut).not.toBe(StatutChambre.LIBRE_PROPRE);
  });

  it('refuse déterministement la validation sous bloqueur et reprend la tâche TERMINEE au palier d’inspection après résolution', async () => {
    const { room, task } = await createTaskForRace(
      'blocked-validation',
      StatutTacheHousekeeping.TERMINEE,
    );
    const blocker = await openBlocker(room.id, 'validation bloquée');

    await expect(
      housekeepingTaskService.validate(
        task.id,
        gouvernanteUserId,
        'Validation interdite pendant la panne B0.2',
      ),
    ).rejects.toThrow(ConflictException);
    expect(
      (
        await prisma.housekeepingTask.findUniqueOrThrow({
          where: { id: task.id },
        })
      ).statut,
    ).toBe(StatutTacheHousekeeping.TERMINEE);

    await maintenanceService.resolve(blocker.id, maintenanceUserId);
    expect(
      (await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).statut,
    ).toBe(StatutChambre.EN_NETTOYAGE);

    await housekeepingTaskService.validate(
      task.id,
      gouvernanteUserId,
      'Inspection effectuée après résolution B0.2',
    );
    expect(
      (await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).statut,
    ).toBe(StatutChambre.LIBRE_PROPRE);
  });

  it('fait converger checkout ↔ ouverture bloqueur vers CHECKOUT + EN_MAINTENANCE avec tâche active', async () => {
    const room = await createRoom('race-checkout');
    const stay = await stayService.checkinWalkIn(
      {
        roomId: room.id,
        dateCheckoutPrevue: dateIn(3),
        nombreOccupants: 1,
        guest: guest('race-checkout'),
      },
      receptionUserId,
    );

    const [checkoutResult, blockerResult] = await Promise.allSettled([
      stayService.checkout(
        stay.id,
        {
          force: true,
          motif: 'Checkout forcé du scénario concurrent B0.2',
        },
        adminUserId,
        adminRoleId,
      ),
      openBlocker(room.id, 'concurrence checkout'),
    ]);
    expect(checkoutResult.status).toBe('fulfilled');
    expect(blockerResult.status).toBe('fulfilled');

    const [freshStay, freshRoom, activeTask] = await Promise.all([
      prisma.stay.findUniqueOrThrow({ where: { id: stay.id } }),
      prisma.room.findUniqueOrThrow({ where: { id: room.id } }),
      prisma.housekeepingTask.findUnique({
        where: { activeRoomKey: room.id },
      }),
    ]);
    expect(freshStay.statut).toBe(StatutSejour.CHECKOUT);
    expect(freshRoom.statut).toBe(StatutChambre.EN_MAINTENANCE);
    expect(activeTask?.statut).toBe(StatutTacheHousekeeping.A_FAIRE);
  });

  it('un bloqueur ouvert pendant OCCUPEE reste projeté après checkout et le listener ne le rétrograde pas', async () => {
    const room = await createRoom('checkout-blocker-first');
    const stay = await stayService.checkinWalkIn(
      {
        roomId: room.id,
        dateCheckoutPrevue: dateIn(3),
        nombreOccupants: 1,
        guest: guest('checkout-blocker-first'),
      },
      receptionUserId,
    );
    await openBlocker(room.id, 'ouvert avant checkout');
    expect(
      (await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).statut,
    ).toBe(StatutChambre.OCCUPEE);

    await stayService.checkout(
      stay.id,
      {
        force: true,
        motif: 'Checkout forcé avec bloqueur déjà ouvert B0.2',
      },
      adminUserId,
      adminRoleId,
    );

    expect(
      (await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).statut,
    ).toBe(StatutChambre.EN_MAINTENANCE);
    expect(
      await prisma.housekeepingTask.count({
        where: { activeRoomKey: room.id },
      }),
    ).toBe(1);
  });

  it('sérialise changement de chambre ↔ ouverture bloqueur sans déplacer vers un bloqueur déjà acquis', async () => {
    const oldRoom = await createRoom('change-old');
    const targetRoom = await createRoom('change-target');
    const stay = await stayService.checkinWalkIn(
      {
        roomId: oldRoom.id,
        dateCheckoutPrevue: dateIn(4),
        nombreOccupants: 1,
        guest: guest('change-room'),
      },
      receptionUserId,
    );

    // DESIGN-009B — pricingFingerprint désormais obligatoire, obtenu via un
    // aperçu préalable (hors course) : la course testée ici porte
    // uniquement sur le blocage maintenance ↔ changement de chambre, jamais
    // sur la fraîcheur du pricing.
    const preview = await stayService.previewChangeRoom(stay.id, targetRoom.id);

    const [changeResult, blockerResult] = await Promise.allSettled([
      stayService.changeRoom(
        stay.id,
        targetRoom.id,
        'Changement concurrent B0.2 vers chambre cible',
        preview.pricingFingerprint,
        adminUserId,
        adminRoleId,
      ),
      openBlocker(targetRoom.id, 'concurrence change-room'),
    ]);
    expect(blockerResult.status).toBe('fulfilled');
    expectConcurrentConflict(changeResult);

    const [freshStay, freshTarget] = await Promise.all([
      prisma.stay.findUniqueOrThrow({ where: { id: stay.id } }),
      prisma.room.findUniqueOrThrow({ where: { id: targetRoom.id } }),
    ]);
    if (changeResult.status === 'fulfilled') {
      expect(freshStay.roomId).toBe(targetRoom.id);
      expect(freshTarget.statut).toBe(StatutChambre.OCCUPEE);
    } else {
      expect(freshStay.roomId).toBe(oldRoom.id);
      expect(freshTarget.statut).toBe(StatutChambre.EN_MAINTENANCE);
    }
    expect(await maintenanceService.hasActiveSalesBlocker(targetRoom.id)).toBe(
      true,
    );
  });
});
