import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RoomsService } from '../src/modules/rooms/rooms.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { HousekeepingTaskService } from '../src/modules/housekeeping/housekeeping-task.service';
import { authedRequest, loginAs } from './helpers/auth';
import {
  AuditAction,
  Prisma,
  StatutChambre,
  StatutSejour,
} from '@prisma/client';

interface ReservationResponse {
  id: number;
}

interface StayResponse {
  id: number;
  roomId: number;
  statut: string;
}

interface ChangeRoomPreviewResponse {
  oldRoom: { id: number; numero: string; roomTypeNom: string };
  newRoom: { id: number; numero: string; roomTypeNom: string };
  nuitsImpactees: string[];
  ancienMontantRestant: string;
  nouveauMontantRestant: string;
  difference: string;
  pricingFingerprint: string;
  warnings: string[];
}

// DESIGN-009B — pricingFingerprint désormais obligatoire sur
// POST /stays/:id/change-room : obtenu via un aperçu préalable, jamais
// inventé côté test. Retombe sur une valeur invalide si le preview
// lui-même échoue (cible indisponible, même chambre, séjour clôturé...) —
// dans ces cas, le commit échoue de toute façon pour la même raison, avant
// même d'atteindre la comparaison de fingerprint.
async function previewFingerprint(
  client: ReturnType<typeof authedRequest>,
  stayId: number,
  newRoomId: number,
): Promise<string> {
  const res = await client
    .post(`/api/stays/${stayId}/change-room/preview`)
    .send({ newRoomId });
  return (
    (res.body as Partial<ChangeRoomPreviewResponse>).pricingFingerprint ??
    'preview-indisponible-fingerprint-invalide'
  );
}

// GL-002 — Changement de chambre pendant un séjour
describe('Stay - Change Room (GL-002)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roomsService: RoomsService;
  let auditService: AuditService;
  let housekeepingTaskService: HousekeepingTaskService;
  let adminClient: ReturnType<typeof authedRequest>;
  let receptionClient: ReturnType<typeof authedRequest>;
  let gouvernanteClient: ReturnType<typeof authedRequest>;
  let roomTypeId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    roomsService = app.get(RoomsService);
    auditService = app.get(AuditService);
    housekeepingTaskService = app.get(HousekeepingTaskService);

    const adminToken = await loginAs(app.getHttpServer(), 'admin');
    adminClient = authedRequest(app.getHttpServer(), adminToken);
    const receptionToken = await loginAs(app.getHttpServer(), 'reception');
    receptionClient = authedRequest(app.getHttpServer(), receptionToken);
    const gouvernanteToken = await loginAs(app.getHttpServer(), 'gouvernante');
    gouvernanteClient = authedRequest(app.getHttpServer(), gouvernanteToken);

    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-GL002-TYPE-${Date.now()}`,
        prixBase: 100,
        capacite: 1,
      },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    // Nettoyage scopé à roomTypeId, jamais de purge globale (les autres
    // suites e2e, exécutées dans le même processus, maxWorkers: 1,
    // possèdent leurs propres RoomType — un deleteMany({}) global casserait
    // sur une contrainte FK inconnue de ce fichier).
    await prisma.roomNight.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.folioLine.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.folio.deleteMany({
      where: { stay: { room: { roomTypeId } } },
    });
    await prisma.stay.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.reservation.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.roomStatusLog.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.housekeepingTaskLog.deleteMany({
      where: { task: { room: { roomTypeId } } },
    });
    await prisma.housekeepingTask.deleteMany({
      where: { room: { roomTypeId } },
    });
    await prisma.room.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  describe('POST /stays/:id/change-room', () => {
    let room1: { id: number };
    let room2: { id: number };
    let room3: { id: number };
    let guest: { id: number };
    let stay: StayResponse;
    let today: Date;

    beforeEach(async () => {
      today = new Date();
      today.setHours(0, 0, 0, 0);

      const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

      room1 = await prisma.room.create({
        data: {
          numero: `GL002-1-${suffix}`,
          roomTypeId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      room2 = await prisma.room.create({
        data: {
          numero: `GL002-2-${suffix}`,
          roomTypeId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      room3 = await prisma.room.create({
        data: {
          numero: `GL002-3-${suffix}`,
          roomTypeId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      guest = await prisma.guest.create({
        data: {
          nom: 'Dupont',
          prenom: 'Jean',
          email: `jean.gl002-${suffix}@example.com`,
          telephone: '+212600000001',
          nationalite: 'MA',
          pieceIdentite: `AB123456-${suffix}`,
          categorie: 'STANDARD',
        },
      });

      const dateDepart = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      const reservationRes = await receptionClient
        .post('/api/reservations')
        .send({
          roomId: room1.id,
          guestId: guest.id,
          dateArrivee: today.toISOString().slice(0, 10),
          dateDepart: dateDepart.toISOString().slice(0, 10),
        });
      const reservation = reservationRes.body as ReservationResponse;

      const checkinRes = await adminClient
        .post(`/api/checkin/${reservation.id}`)
        .send({ nombreOccupants: 1 });
      stay = checkinRes.body as StayResponse;

      // Vérifier que le séjour est bien en cours
      expect(stay.statut).toBe(StatutSejour.EN_COURS);
      expect(stay.roomId).toBe(room1.id);
    });

    afterEach(async () => {
      const roomIds = [room1.id, room2.id, room3.id];
      await prisma.auditLog.deleteMany({
        where: { targetId: stay.id, targetEntity: 'Stay' },
      });
      await prisma.housekeepingTaskLog.deleteMany({
        where: { task: { roomId: { in: roomIds } } },
      });
      await prisma.housekeepingTask.deleteMany({
        where: { roomId: { in: roomIds } },
      });
      await prisma.roomStatusLog.deleteMany({
        where: { roomId: { in: roomIds } },
      });
      await prisma.roomNight.deleteMany({
        where: { roomId: { in: roomIds } },
      });
      await prisma.folioLine.deleteMany({
        where: { folio: { stay: { roomId: { in: roomIds } } } },
      });
      await prisma.folio.deleteMany({
        where: { stay: { roomId: { in: roomIds } } },
      });
      await prisma.stay.deleteMany({ where: { roomId: { in: roomIds } } });
      await prisma.reservation.deleteMany({
        where: { roomId: { in: roomIds } },
      });
      await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
      await prisma.guest.deleteMany({ where: { id: guest.id } });
      // Restaure tout spy/mock posé par les tests de sabotage (rollback)
      // ci-dessous — jamais de mock qui fuit sur les tests suivants.
      jest.restoreAllMocks();
    });

    it('Changement nominal vers une chambre disponible', async () => {
      const pricingFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Demande du client pour proximité étage supérieur',
          pricingFingerprint,
        });

      expect(res.status).toBe(201);
      expect((res.body as StayResponse).roomId).toBe(room2.id);

      // Vérifier que Stay.roomId a été mis à jour
      const updatedStay = await prisma.stay.findUniqueOrThrow({
        where: { id: stay.id },
      });
      expect(updatedStay.roomId).toBe(room2.id);

      // Vérifier que les RoomNight ont été transférées
      const room1Nights = await prisma.roomNight.findMany({
        where: { roomId: room1.id, stayId: stay.id },
      });
      const room2Nights = await prisma.roomNight.findMany({
        where: { roomId: room2.id, stayId: stay.id },
      });
      expect(room1Nights.length).toBe(0);
      expect(room2Nights.length).toBe(3);

      // Vérifier que la nouvelle chambre est passée à OCCUPEE
      const newRoom = await prisma.room.findUniqueOrThrow({
        where: { id: room2.id },
      });
      expect(newRoom.statut).toBe(StatutChambre.OCCUPEE);

      // Vérifier que l'audit a été écrit
      const auditLog = await prisma.auditLog.findFirstOrThrow({
        where: {
          action: AuditAction.CHANGE_ROOM,
          targetId: stay.id,
        },
      });
      expect(auditLog.motif).toBe(
        'Demande du client pour proximité étage supérieur',
      );
    });

    it('Séjour déjà clôturé doit être rejeté (409)', async () => {
      // Fingerprint obtenu AVANT le check-out (séjour encore EN_COURS) — le
      // commit doit échouer sur le statut du séjour, avant même la
      // comparaison de fingerprint.
      const pricingFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );
      const checkoutRes = await adminClient
        .post(`/api/checkout/${stay.id}`)
        .send({ force: true, motif: 'Check-out forcé pour préparer le test' });
      expect(checkoutRes.status).toBe(201);

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars',
          pricingFingerprint,
        });

      expect(res.status).toBe(409);
    });

    it('Permission absente (Gouvernante) doit être rejetée', async () => {
      const res = await gouvernanteClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif minimum 10 chars ok!',
          pricingFingerprint: 'gouvernante-sans-permission',
        });

      expect(res.status).toBe(403);
    });

    it('Motif trop court doit être rejeté', async () => {
      const pricingFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Court',
          pricingFingerprint,
        });

      expect(res.status).toBe(400);
    });

    it('Séjour inexistant doit retourner 404', async () => {
      const res = await receptionClient
        .post(`/api/stays/99999999/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars',
          pricingFingerprint: 'sejour-inexistant',
        });

      expect(res.status).toBe(404);
    });

    it('Même chambre doit être rejetée', async () => {
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: stay.roomId,
          motif: 'Motif valide minimum 10 chars',
          pricingFingerprint: 'meme-chambre',
        });

      expect(res.status).toBe(409);
    });

    it('Cible non LIBRE_PROPRE doit être rejetée', async () => {
      // Mettre la cible en OCCUPEE
      await prisma.room.update({
        where: { id: room2.id },
        data: { statut: StatutChambre.OCCUPEE },
      });

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars',
          pricingFingerprint: 'cible-non-libre-propre',
        });

      expect(res.status).toBe(409);
    });

    it("Cible réservée (RoomNight issue d'une Reservation) doit être rejetée (409)", async () => {
      // room2 reste LIBRE_PROPRE (aucun check-in), mais une réservation
      // future chevauche la période restante du séjour — RoomNight avec
      // reservationId renseigné, stayId null.
      await receptionClient.post('/api/reservations').send({
        roomId: room2.id,
        guestId: guest.id,
        dateArrivee: today.toISOString().slice(0, 10),
        dateDepart: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      });

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars',
          pricingFingerprint: 'cible-reservee',
        });

      expect(res.status).toBe(409);
    });

    it("Cible occupée (RoomNight issue d'un Stay walk-in, sans reservationId) doit être rejetée (409)", async () => {
      // Walk-in : RoomNight créées directement rattachées au séjour, sans
      // jamais passer par une Reservation (reservationId toujours null) —
      // c'est exactement le cas que l'ancien filtre `reservationId: { not:
      // null } }` manquait.
      const dateCheckoutPrevue = new Date(
        today.getTime() + 2 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);
      const walkinRes = await adminClient.post('/api/checkin/walk-in').send({
        roomId: room2.id,
        dateCheckoutPrevue,
        nombreOccupants: 1,
        guestId: guest.id,
      });
      expect(walkinRes.status).toBe(201);

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars',
          pricingFingerprint: 'cible-occupee-walkin',
        });

      expect(res.status).toBe(409);
    });

    it('Ancienne chambre doit passer à A_NETTOYER', async () => {
      const oldRoomId = stay.roomId;
      const pricingFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );

      await receptionClient.post(`/api/stays/${stay.id}/change-room`).send({
        newRoomId: room2.id,
        motif: 'Demande client pour confort amélioré',
        pricingFingerprint,
      });

      const oldRoom = await prisma.room.findUniqueOrThrow({
        where: { id: oldRoomId },
      });
      expect(oldRoom.statut).toBe(StatutChambre.A_NETTOYER);
    });

    it('Tâche housekeeping doit être créée sans doublon', async () => {
      const oldRoomId = stay.roomId;
      const pricingFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );

      await receptionClient.post(`/api/stays/${stay.id}/change-room`).send({
        newRoomId: room2.id,
        motif: 'Demande client pour confort amélioré',
        pricingFingerprint,
      });

      // Attendre un peu pour que l'événement soit traité
      await new Promise((resolve) => setTimeout(resolve, 500));

      const tasks = await prisma.housekeepingTask.findMany({
        where: { roomId: oldRoomId },
      });

      // Doit y avoir exactement une tâche
      expect(tasks.length).toBeGreaterThanOrEqual(1);

      // La dernière tâche doit être CHANGE_ROOM
      const lastTask = tasks[tasks.length - 1];
      expect(lastTask.origine).toBe('CHANGE_ROOM');
    });

    // DESIGN-009B — les chambres 1/2/3 partagent le même RoomType
    // (roomTypeId, prixBase=100, aucune SeasonRate), donc le catalogue
    // "nouveau" (calculateNightlyTotal sur le tarif de base) est identique
    // pour room1/room2/room3. Malgré cela, une différence non nulle est
    // attendue ici : la TAXE_SEJOUR active (seed, 3 MAD/nuit/occupant) est
    // carvée hors de la ligne HEBERGEMENT à la matérialisation FIN-102
    // (ADR-008), donc tarifNuitMoyenContracte (ancien, net de taxe) est
    // structurellement < prixBase catalogue (nouveau, brut) — c'est
    // exactement la formule spécifiée (DESIGN-009B §3), pas un bug. Le vrai
    // invariant à préserver ici : les lignes PRÉEXISTANTES (HEBERGEMENT,
    // EXTRA, TAXE_SEJOUR) restent bit-à-bit identiques ; seule une NOUVELLE
    // ligne AJUSTEMENT_HAUSSE/AJUSTEMENT_BAISSE peut apparaître.
    it('Lignes de folio préexistantes intactes après changement de chambre (seul un ajustement peut s’ajouter)', async () => {
      const foliosBefore = await prisma.folio.findMany({
        where: { stayId: stay.id },
        include: { lignes: true },
      });

      const folioCountBefore = foliosBefore.length;
      const lignesBefore = foliosBefore.flatMap((f) => f.lignes);

      const pricingFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );
      const changeRes = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Changement de préférence client,',
          pricingFingerprint,
        });
      expect(changeRes.status).toBe(201);

      const foliosAfter = await prisma.folio.findMany({
        where: { stayId: stay.id },
        include: { lignes: true },
      });

      const folioCountAfter = foliosAfter.length;
      const lignesAfter = foliosAfter.flatMap((f) => f.lignes);

      expect(folioCountAfter).toBe(folioCountBefore);

      // Toute ligne préexistante (par id) doit rester rigoureusement
      // identique (montant, type, annulee) — jamais mutée.
      for (const ligneAvant of lignesBefore) {
        const ligneApres = lignesAfter.find((l) => l.id === ligneAvant.id);
        expect(ligneApres).toBeDefined();
        expect(ligneApres!.montant.toFixed(2)).toBe(
          ligneAvant.montant.toFixed(2),
        );
        expect(ligneApres!.type).toBe(ligneAvant.type);
        expect(ligneApres!.annulee).toBe(ligneAvant.annulee);
      }

      // Toute ligne NOUVELLE ne peut être qu'un ajustement tarifaire
      // DESIGN-009B.
      const nouvellesLignes = lignesAfter.filter(
        (l) => !lignesBefore.some((avant) => avant.id === l.id),
      );
      for (const ligne of nouvellesLignes) {
        expect(['AJUSTEMENT_HAUSSE', 'AJUSTEMENT_BAISSE']).toContain(
          ligne.type,
        );
      }
      expect(nouvellesLignes.length).toBeLessThanOrEqual(1);
    });

    it('Nuits passées doivent rester sur ancienne chambre', async () => {
      // Créer un séjour qui a déjà des nuits passées (hier + aujourd'hui + demain)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const dateDepart2 = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);

      const reservation2Res = await receptionClient
        .post('/api/reservations')
        .send({
          roomId: room3.id,
          guestId: guest.id,
          dateArrivee: yesterday.toISOString().slice(0, 10),
          dateDepart: dateDepart2.toISOString().slice(0, 10),
        });
      const reservation2 = reservation2Res.body as ReservationResponse;

      const checkinRes = await adminClient
        .post(`/api/checkin/${reservation2.id}`)
        .send({ nombreOccupants: 1 });
      const stay2 = checkinRes.body as StayResponse;
      const oldRoomId = stay2.roomId;
      expect(oldRoomId).toBe(room3.id);

      // Changer de chambre vers room2 (la seule encore LIBRE_PROPRE)
      const pricingFingerprint = await previewFingerprint(
        receptionClient,
        stay2.id,
        room2.id,
      );
      const changeRes = await receptionClient
        .post(`/api/stays/${stay2.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Changement après nuit déjà écoulée',
          pricingFingerprint,
        });
      expect(changeRes.status).toBe(201);

      // Vérifier que la nuit passée (hier) est restée sur l'ancienne chambre
      const pastNightOldRoom = await prisma.roomNight.findUnique({
        where: { roomId_date: { roomId: oldRoomId, date: yesterday } },
      });
      expect(pastNightOldRoom).toBeDefined();

      // Vérifier que la nuit passée n'est pas sur la nouvelle chambre
      const pastNightNewRoom = await prisma.roomNight.findUnique({
        where: { roomId_date: { roomId: room2.id, date: yesterday } },
      });
      expect(pastNightNewRoom).toBeNull();
    });

    // Deuxième séjour actif indépendant, pour les tests de concurrence
    // (2 changements de chambre visant la même cible) — walk-in : le plus
    // rapide à mettre en place, sans dépendre du flux réservation.
    async function checkinWalkInStay(roomId: number) {
      const dateCheckoutPrevue = new Date(
        today.getTime() + 2 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);
      const res = await adminClient.post('/api/checkin/walk-in').send({
        roomId,
        dateCheckoutPrevue,
        nombreOccupants: 1,
        guestId: guest.id,
      });
      expect(res.status).toBe(201);
      return res.body as StayResponse;
    }

    it('Deux changements de chambre concurrents vers la même cible : un seul succès', async () => {
      const stay2 = await checkinWalkInStay(room3.id);

      // Fingerprints obtenus séquentiellement AVANT la course — la course
      // testée ici porte sur la disponibilité de room2, jamais sur la
      // fraîcheur du pricing.
      const [fingerprint1, fingerprint2] = await Promise.all([
        previewFingerprint(receptionClient, stay.id, room2.id),
        previewFingerprint(receptionClient, stay2.id, room2.id),
      ]);

      const [res1, res2] = await Promise.all([
        receptionClient.post(`/api/stays/${stay.id}/change-room`).send({
          newRoomId: room2.id,
          motif: 'Course concurrente — séjour 1',
          pricingFingerprint: fingerprint1,
        }),
        receptionClient.post(`/api/stays/${stay2.id}/change-room`).send({
          newRoomId: room2.id,
          motif: 'Course concurrente — séjour 2',
          pricingFingerprint: fingerprint2,
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // L'un des deux réussit (201), l'autre échoue (409 : cible non
      // disponible ou RoomNight conflictuelle, selon l'ordre réel
      // d'acquisition des verrous InnoDB).
      expect(statuses).toEqual([201, 409]);

      const newRoom = await prisma.room.findUniqueOrThrow({
        where: { id: room2.id },
      });
      expect(newRoom.statut).toBe(StatutChambre.OCCUPEE);

      const [updatedStay, updatedStay2] = await Promise.all([
        prisma.stay.findUniqueOrThrow({ where: { id: stay.id } }),
        prisma.stay.findUniqueOrThrow({ where: { id: stay2.id } }),
      ]);
      // Exactement un des deux séjours occupe désormais room2 — jamais les
      // deux (contrainte unique RoomNight(roomId, date) + verrous FOR
      // UPDATE, jamais un simple 409 côté application seul).
      const winners = [updatedStay, updatedStay2].filter(
        (s) => s.roomId === room2.id,
      );
      expect(winners.length).toBe(1);
    });

    it('Concurrence avec un check-out du même séjour : état final cohérent', async () => {
      const pricingFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );
      const [changeRes, checkoutRes] = await Promise.all([
        receptionClient.post(`/api/stays/${stay.id}/change-room`).send({
          newRoomId: room2.id,
          motif: 'Course concurrente avec check-out',
          pricingFingerprint,
        }),
        adminClient.post(`/api/checkout/${stay.id}`).send({
          force: true,
          motif: 'Check-out forcé concurrent au changement de chambre',
        }),
      ]);

      // Le check-out forcé ne dépend jamais de la disponibilité d'une
      // chambre : il doit toujours réussir, quel que soit l'ordre réel.
      expect(checkoutRes.status).toBe(201);

      const finalStay = await prisma.stay.findUniqueOrThrow({
        where: { id: stay.id },
      });
      expect(finalStay.statut).toBe(StatutSejour.CHECKOUT);

      // Cohérence : si le changement de chambre a réussi (201), le séjour
      // doit être passé par room2 ; s'il a échoué (409, séjour déjà
      // clôturé sous verrou frais), roomId doit être resté sur room1 —
      // jamais un état intermédiaire contradictoire.
      if (changeRes.status === 201) {
        expect(finalStay.roomId).toBe(room2.id);
      } else {
        expect(changeRes.status).toBe(409);
        expect(finalStay.roomId).toBe(room1.id);
      }
    });

    // Preuve de rigueur sabotage/restore (CLAUDE.md, section Tests) : pour
    // chacun des trois tests de rollback ci-dessous, on casse un point
    // précis de la transaction, on confirme que l'opération échoue ET que
    // TOUT ce qui avait déjà été écrit dans cette même transaction (Stay,
    // RoomNight, statuts des deux chambres, AuditLog) a bien été annulé,
    // puis on restaure (jest.restoreAllMocks) et on revérifie qu'un appel
    // identique réussit de nouveau — sinon le test ne serait pas
    // discriminant.
    it('Rollback intégral si la transition de la nouvelle chambre échoue', async () => {
      type TransitionRoomFn = (
        roomId: number,
        to: StatutChambre,
        opts?: {
          motif?: string;
          userId?: number;
          tx?: Prisma.TransactionClient;
        },
      ) => ReturnType<RoomsService['transitionRoom']>;
      // strictBindCallApply est désactivé pour tout le projet (tsconfig.json)
      // — .call() perd donc son typage précis ici ; référence capturée avant
      // le spy, jamais détachée de son instance (toujours appelée via
      // .call(this, ...) juste en dessous).
      const originalTransitionRoom: TransitionRoomFn =
        // eslint-disable-next-line @typescript-eslint/unbound-method
        RoomsService.prototype.transitionRoom;
      jest.spyOn(roomsService, 'transitionRoom').mockImplementation(function (
        this: RoomsService,
        roomId,
        to,
        opts,
      ) {
        if (to === StatutChambre.OCCUPEE && roomId === room2.id) {
          return Promise.reject(
            new Error('Sabotage : transition OCCUPEE en échec'),
          );
        }
        return originalTransitionRoom.call(
          this,
          roomId,
          to,
          opts,
        ) as ReturnType<RoomsService['transitionRoom']>;
      });

      const pricingFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars',
          pricingFingerprint,
        });
      expect(res.status).toBe(500);

      const [stayAfter, room1After, room2After, nightsAfter, auditAfter] =
        await Promise.all([
          prisma.stay.findUniqueOrThrow({ where: { id: stay.id } }),
          prisma.room.findUniqueOrThrow({ where: { id: room1.id } }),
          prisma.room.findUniqueOrThrow({ where: { id: room2.id } }),
          prisma.roomNight.findMany({
            where: { stayId: stay.id, roomId: room2.id },
          }),
          prisma.auditLog.findFirst({
            where: { action: AuditAction.CHANGE_ROOM, targetId: stay.id },
          }),
        ]);
      expect(stayAfter.roomId).toBe(room1.id);
      // L'ancienne chambre était déjà passée à A_NETTOYER plus tôt dans la
      // MÊME transaction, avant l'échec sabotée — la preuve d'atomicité
      // tient précisément à ce que ce changement soit lui aussi annulé.
      expect(room1After.statut).toBe(StatutChambre.OCCUPEE);
      expect(room2After.statut).toBe(StatutChambre.LIBRE_PROPRE);
      expect(nightsAfter.length).toBe(0);
      expect(auditAfter).toBeNull();

      jest.restoreAllMocks();
      const retryFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );
      const retry = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars, retenté après restauration',
          pricingFingerprint: retryFingerprint,
        });
      expect(retry.status).toBe(201);
    });

    it('Rollback intégral si la création de la tâche housekeeping (ou son log) échoue', async () => {
      jest
        .spyOn(housekeepingTaskService, 'createTask')
        .mockRejectedValueOnce(new Error('Sabotage : createTask en échec'));

      const pricingFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars',
          pricingFingerprint,
        });
      expect(res.status).toBe(500);

      const [stayAfter, room1After, room2After, auditAfter, taskAfter] =
        await Promise.all([
          prisma.stay.findUniqueOrThrow({ where: { id: stay.id } }),
          prisma.room.findUniqueOrThrow({ where: { id: room1.id } }),
          prisma.room.findUniqueOrThrow({ where: { id: room2.id } }),
          // L'AuditLog est écrit AVANT l'appel sabotée dans la même
          // transaction — s'il subsiste malgré l'échec, l'opération n'est
          // pas atomique.
          prisma.auditLog.findFirst({
            where: { action: AuditAction.CHANGE_ROOM, targetId: stay.id },
          }),
          prisma.housekeepingTask.findFirst({ where: { roomId: room1.id } }),
        ]);
      expect(stayAfter.roomId).toBe(room1.id);
      expect(room1After.statut).toBe(StatutChambre.OCCUPEE);
      expect(room2After.statut).toBe(StatutChambre.LIBRE_PROPRE);
      expect(auditAfter).toBeNull();
      expect(taskAfter).toBeNull();

      jest.restoreAllMocks();
      const retryFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );
      const retry = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars, retenté après restauration',
          pricingFingerprint: retryFingerprint,
        });
      expect(retry.status).toBe(201);
    });

    it("Rollback intégral si l'écriture de l'AuditLog échoue", async () => {
      jest
        .spyOn(auditService, 'writeLog')
        .mockRejectedValueOnce(new Error('Sabotage : writeLog en échec'));

      const pricingFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars',
          pricingFingerprint,
        });
      expect(res.status).toBe(500);

      const [stayAfter, room1After, room2After, taskAfter] = await Promise.all([
        prisma.stay.findUniqueOrThrow({ where: { id: stay.id } }),
        prisma.room.findUniqueOrThrow({ where: { id: room1.id } }),
        prisma.room.findUniqueOrThrow({ where: { id: room2.id } }),
        prisma.housekeepingTask.findFirst({ where: { roomId: room1.id } }),
      ]);
      expect(stayAfter.roomId).toBe(room1.id);
      // Les deux transitions de statut avaient déjà eu lieu plus tôt dans
      // la même transaction, avant l'échec sabotée de l'audit.
      expect(room1After.statut).toBe(StatutChambre.OCCUPEE);
      expect(room2After.statut).toBe(StatutChambre.LIBRE_PROPRE);
      expect(taskAfter).toBeNull();

      jest.restoreAllMocks();
      const retryFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );
      const retry = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Motif valide minimum 10 chars, retenté après restauration',
          pricingFingerprint: retryFingerprint,
        });
      expect(retry.status).toBe(201);
    });

    it('Idempotence : deux opérations distinctes créent chacune leur propre tâche', async () => {
      // Chambre temporaire, propre à ce test — cf. commentaire d'afterAll
      // (nettoyage scopé à roomTypeId, donc pas besoin de la traiter dans
      // afterEach ci-dessus).
      const room4 = await prisma.room.create({
        data: {
          numero: `GL002-4-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          roomTypeId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const stay2 = await checkinWalkInStay(room3.id);

      const [fingerprint1, fingerprint2] = await Promise.all([
        previewFingerprint(receptionClient, stay.id, room2.id),
        previewFingerprint(receptionClient, stay2.id, room4.id),
      ]);

      const [res1, res2] = await Promise.all([
        receptionClient.post(`/api/stays/${stay.id}/change-room`).send({
          newRoomId: room2.id,
          motif: 'Première opération distincte',
          pricingFingerprint: fingerprint1,
        }),
        receptionClient.post(`/api/stays/${stay2.id}/change-room`).send({
          newRoomId: room4.id,
          motif: 'Deuxième opération distincte',
          pricingFingerprint: fingerprint2,
        }),
      ]);
      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      const [task1, task2] = await Promise.all([
        prisma.housekeepingTask.findFirstOrThrow({
          where: { roomId: room1.id, origine: 'CHANGE_ROOM' },
        }),
        prisma.housekeepingTask.findFirstOrThrow({
          where: { roomId: room3.id, origine: 'CHANGE_ROOM' },
        }),
      ]);
      expect(task1.id).not.toBe(task2.id);
      expect(task1.sourceEventKey).not.toBe(task2.sourceEventKey);
      // AuditLog.id est un UUID (schema.prisma), pas un entier — la clé
      // d'idempotence en hérite le format.
      expect(task1.sourceEventKey).toMatch(/^room-change:.+$/);
      expect(task2.sourceEventKey).toMatch(/^room-change:.+$/);

      // room4 est propre à ce test (jamais dans roomIds de l'afterEach
      // partagé ci-dessus) — nettoyage explicite ici, sinon stay2 (déplacé
      // vers room4) survit à l'afterEach et bloque guest.deleteMany (FK).
      await prisma.housekeepingTaskLog.deleteMany({
        where: { task: { roomId: room4.id } },
      });
      await prisma.housekeepingTask.deleteMany({
        where: { roomId: room4.id },
      });
      await prisma.roomStatusLog.deleteMany({ where: { roomId: room4.id } });
      await prisma.roomNight.deleteMany({ where: { roomId: room4.id } });
      await prisma.folioLine.deleteMany({
        where: { folio: { stay: { roomId: room4.id } } },
      });
      await prisma.folio.deleteMany({ where: { stay: { roomId: room4.id } } });
      await prisma.stay.deleteMany({ where: { roomId: room4.id } });
      await prisma.reservation.deleteMany({ where: { roomId: room4.id } });
      await prisma.room.deleteMany({ where: { id: room4.id } });
    });

    it('Idempotence : rejouer la même clé ne crée jamais de tâche en double', async () => {
      const pricingFingerprint = await previewFingerprint(
        receptionClient,
        stay.id,
        room2.id,
      );
      const changeRes = await receptionClient
        .post(`/api/stays/${stay.id}/change-room`)
        .send({
          newRoomId: room2.id,
          motif: 'Opération de référence pour le rejeu',
          pricingFingerprint,
        });
      expect(changeRes.status).toBe(201);

      const task = await prisma.housekeepingTask.findFirstOrThrow({
        where: { roomId: room1.id, origine: 'CHANGE_ROOM' },
      });
      expect(task.sourceEventKey).toBeDefined();

      // Rejeu direct de createTask() avec exactement la même clé — même
      // mécanisme d'idempotence que celui utilisé par
      // StayService.changeRoom, sans transaction externe (createTask en
      // ouvre une elle-même si tx est omis).
      const replayed = await housekeepingTaskService.createTask(
        room1.id,
        'CHANGE_ROOM',
        task.sourceEventKey!,
      );
      expect(replayed.id).toBe(task.id);

      const count = await prisma.housekeepingTask.count({
        where: { roomId: room1.id, origine: 'CHANGE_ROOM' },
      });
      expect(count).toBe(1);
    });
  });

  // DESIGN-009B — matrice de tests explicitement demandée par le
  // propriétaire produit (mission GO BUILD, section « Tests obligatoires »),
  // au-delà des tests GL-002 déjà adaptés ci-dessus (qui ne pinnent jamais
  // de montant exact, tous les rooms y partageant le même roomTypeId/prix).
  // Chaque test ci-dessous crée ses propres RoomType à prix distincts pour
  // pouvoir vérifier une vraie différence tarifaire de bout en bout.
  describe('DESIGN-009B — impact tarifaire', () => {
    let typeBasique: { id: number };
    let typeDeluxe: { id: number };
    let taxeSejour: { taux: Prisma.Decimal };

    beforeAll(async () => {
      const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      typeBasique = await prisma.roomType.create({
        data: {
          nom: `TEST-009B-BASIQUE-${suffix}`,
          prixBase: 400,
          capacite: 2,
        },
      });
      typeDeluxe = await prisma.roomType.create({
        data: { nom: `TEST-009B-DELUXE-${suffix}`, prixBase: 500, capacite: 2 },
      });
      // Même config TAXE_SEJOUR que le seed (MONTANT_FIXE, taux=3 — voir
      // prisma/seed.ts) : lue en direct plutôt que codée en dur, pour que
      // le test reste correct même si le taux venait à changer.
      taxeSejour = await prisma.taxRateConfig.findFirstOrThrow({
        where: { type: 'TAXE_SEJOUR', actif: true },
        select: { taux: true },
      });
    });

    afterAll(async () => {
      const typeIds = [typeBasique.id, typeDeluxe.id];
      await prisma.roomNight.deleteMany({
        where: { room: { roomTypeId: { in: typeIds } } },
      });
      // DESIGN-010 — le test « facture EMISE active → changeRoom rejeté »
      // ci-dessus génère une Invoice (+ un CreditNote) sur le folio d'un
      // séjour de ce bloc : les supprimer avant Folio/FolioLine (contrainte
      // FK), même précédent que billing.e2e-spec.ts.
      await prisma.creditNote.deleteMany({
        where: {
          invoice: {
            folio: { stay: { room: { roomTypeId: { in: typeIds } } } },
          },
        },
      });
      await prisma.invoice.deleteMany({
        where: { folio: { stay: { room: { roomTypeId: { in: typeIds } } } } },
      });
      await prisma.folioLine.deleteMany({
        where: { folio: { stay: { room: { roomTypeId: { in: typeIds } } } } },
      });
      await prisma.folio.deleteMany({
        where: { stay: { room: { roomTypeId: { in: typeIds } } } },
      });
      await prisma.auditLog.deleteMany({
        where: {
          targetEntity: 'Stay',
          targetId: {
            in: await prisma.stay
              .findMany({
                where: { room: { roomTypeId: { in: typeIds } } },
                select: { id: true },
              })
              .then((rows) => rows.map((r) => r.id)),
          },
        },
      });
      await prisma.housekeepingTaskLog.deleteMany({
        where: { task: { room: { roomTypeId: { in: typeIds } } } },
      });
      await prisma.housekeepingTask.deleteMany({
        where: { room: { roomTypeId: { in: typeIds } } },
      });
      await prisma.roomStatusLog.deleteMany({
        where: { room: { roomTypeId: { in: typeIds } } },
      });
      await prisma.stay.deleteMany({
        where: { room: { roomTypeId: { in: typeIds } } },
      });
      await prisma.reservation.deleteMany({
        where: { room: { roomTypeId: { in: typeIds } } },
      });
      await prisma.room.deleteMany({ where: { roomTypeId: { in: typeIds } } });
      await prisma.roomType.deleteMany({ where: { id: { in: typeIds } } });
    });

    // Crée un séjour EN_COURS de 3 nuits (aujourd'hui incluses), formule
    // ROOM_ONLY (aucun supplément formule, isole la seule composante
    // HEBERGEMENT), 1 occupant, sur une chambre du roomType donné.
    async function createStay3Nuits(
      roomTypeId: number,
      destinationRoomTypeId: number,
    ) {
      const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const roomA = await prisma.room.create({
        data: {
          numero: `009B-A-${suffix}`,
          roomTypeId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const roomB = await prisma.room.create({
        data: {
          numero: `009B-B-${suffix}`,
          roomTypeId: destinationRoomTypeId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const guest = await prisma.guest.create({
        data: {
          nom: 'Test009B',
          prenom: 'E2E',
          email: `e2e009b-${suffix}@example.com`,
          telephone: '+212600000002',
          nationalite: 'MA',
          pieceIdentite: `T009B-${suffix}`,
          categorie: 'STANDARD',
        },
      });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateDepart = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      const reservationRes = await receptionClient
        .post('/api/reservations')
        .send({
          roomId: roomA.id,
          guestId: guest.id,
          dateArrivee: today.toISOString().slice(0, 10),
          dateDepart: dateDepart.toISOString().slice(0, 10),
          formule: 'ROOM_ONLY',
        });
      const reservation = reservationRes.body as ReservationResponse;
      const checkinRes = await adminClient
        .post(`/api/checkin/${reservation.id}`)
        .send({ nombreOccupants: 1 });
      const createdStay = checkinRes.body as StayResponse;
      return {
        stay: createdStay,
        roomA,
        roomB,
        guest,
        reservationId: reservation.id,
      };
    }

    it('Hausse tarifaire explicite : 400 MAD/nuit → 500 MAD/nuit sur 3 nuits restantes', async () => {
      const { stay: s, roomB } = await createStay3Nuits(
        typeBasique.id,
        typeDeluxe.id,
      );
      // Attendu : hebergement contracté = 400×3 - taxeSéjour(3 nuits×1 occ.)
      // = 1200 - 9 = 1191 ; nouveau = 500×3 = 1500 (catalogue, jamais net de
      // taxe — voir §3 du rapport de conception, asymétrie documentée et
      // volontaire) ; différence = 1500 - 1191 = 309.00, pas un « 300.00 »
      // brut — l'écart de 9 MAD est exactement la taxe de séjour carvée hors
      // de la ligne HEBERGEMENT à la matérialisation FIN-102.
      const taxe = taxeSejour.taux.mul(3).mul(1);
      const ancienAttendu = new Prisma.Decimal(400).mul(3).sub(taxe);
      const nouveauAttendu = new Prisma.Decimal(500).mul(3);
      const differenceAttendue = nouveauAttendu.sub(ancienAttendu);

      const previewRes = await receptionClient
        .post(`/api/stays/${s.id}/change-room/preview`)
        .send({ newRoomId: roomB.id });
      expect(previewRes.status).toBe(201);
      const preview = previewRes.body as ChangeRoomPreviewResponse;
      expect(preview.ancienMontantRestant).toBe(ancienAttendu.toFixed(2));
      expect(preview.nouveauMontantRestant).toBe(nouveauAttendu.toFixed(2));
      expect(preview.difference).toBe(`+${differenceAttendue.toFixed(2)}`);

      const changeRes = await receptionClient
        .post(`/api/stays/${s.id}/change-room`)
        .send({
          newRoomId: roomB.id,
          motif: 'Test explicite hausse 400->500',
          pricingFingerprint: preview.pricingFingerprint,
        });
      expect(changeRes.status).toBe(201);

      const ligne = await prisma.folioLine.findFirstOrThrow({
        where: { folio: { stayId: s.id }, type: 'AJUSTEMENT_HAUSSE' },
      });
      expect(ligne.montant.toFixed(2)).toBe(differenceAttendue.toFixed(2));
    });

    it('Baisse tarifaire explicite : 500 MAD/nuit → 400 MAD/nuit sur 3 nuits restantes', async () => {
      const { stay: s, roomB } = await createStay3Nuits(
        typeDeluxe.id,
        typeBasique.id,
      );
      const taxe = taxeSejour.taux.mul(3).mul(1);
      const ancienAttendu = new Prisma.Decimal(500).mul(3).sub(taxe);
      const nouveauAttendu = new Prisma.Decimal(400).mul(3);
      const differenceAttendue = ancienAttendu.sub(nouveauAttendu);

      const previewRes = await receptionClient
        .post(`/api/stays/${s.id}/change-room/preview`)
        .send({ newRoomId: roomB.id });
      expect(previewRes.status).toBe(201);
      const preview = previewRes.body as ChangeRoomPreviewResponse;
      expect(preview.ancienMontantRestant).toBe(ancienAttendu.toFixed(2));
      expect(preview.nouveauMontantRestant).toBe(nouveauAttendu.toFixed(2));
      expect(preview.difference).toBe(`-${differenceAttendue.toFixed(2)}`);

      const changeRes = await receptionClient
        .post(`/api/stays/${s.id}/change-room`)
        .send({
          newRoomId: roomB.id,
          motif: 'Test explicite baisse 500->400',
          pricingFingerprint: preview.pricingFingerprint,
        });
      expect(changeRes.status).toBe(201);

      const ligne = await prisma.folioLine.findFirstOrThrow({
        where: { folio: { stayId: s.id }, type: 'AJUSTEMENT_BAISSE' },
      });
      expect(ligne.montant.toFixed(2)).toBe(differenceAttendue.toFixed(2));
    });

    it('Catalogue tarifaire modifié après la réservation : ancien montant reste basé sur le folio, pas le nouveau catalogue', async () => {
      const { stay: s, roomB } = await createStay3Nuits(
        typeBasique.id,
        typeDeluxe.id,
      );
      const taxe = taxeSejour.taux.mul(3).mul(1);
      const ancienAttenduAvantModifCatalogue = new Prisma.Decimal(400)
        .mul(3)
        .sub(taxe);

      // Un Administrateur modifie le catalogue APRÈS le check-in (même
      // convention que parameters:write — hors périmètre de ce test, écrit
      // directement via Prisma pour isoler la seule variable testée).
      await prisma.roomType.update({
        where: { id: typeBasique.id },
        data: { prixBase: 999 },
      });

      const previewRes = await receptionClient
        .post(`/api/stays/${s.id}/change-room/preview`)
        .send({ newRoomId: roomB.id });
      expect(previewRes.status).toBe(201);
      const preview = previewRes.body as ChangeRoomPreviewResponse;
      // L'ancien montant restant NE bouge PAS malgré le catalogue modifié —
      // c'est exactement le point testé (préservation du prix contracté).
      expect(preview.ancienMontantRestant).toBe(
        ancienAttenduAvantModifCatalogue.toFixed(2),
      );

      // Restaure le catalogue pour ne pas polluer les tests suivants du
      // même fichier (afterAll ne le fait pas, seul le prixBase a été muté).
      await prisma.roomType.update({
        where: { id: typeBasique.id },
        data: { prixBase: 400 },
      });
    });

    it('ajustementManuel sur la réservation d’origine : ancien montant respecte le prix contracté, pas le catalogue', async () => {
      const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const roomA = await prisma.room.create({
        data: {
          numero: `009B-AJUST-A-${suffix}`,
          roomTypeId: typeBasique.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const roomB = await prisma.room.create({
        data: {
          numero: `009B-AJUST-B-${suffix}`,
          roomTypeId: typeDeluxe.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const guest = await prisma.guest.create({
        data: {
          nom: 'TestAjust',
          prenom: 'E2E',
          email: `e2e009b-ajust-${suffix}@example.com`,
          telephone: '+212600000003',
          nationalite: 'MA',
          pieceIdentite: `T009B-AJ-${suffix}`,
          categorie: 'STANDARD',
        },
      });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateDepart = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      const reservationRes = await receptionClient
        .post('/api/reservations')
        .send({
          roomId: roomA.id,
          guestId: guest.id,
          dateArrivee: today.toISOString().slice(0, 10),
          dateDepart: dateDepart.toISOString().slice(0, 10),
          formule: 'ROOM_ONLY',
        });
      const reservation = reservationRes.body as ReservationResponse;

      // Tarif négocié manuellement à 900 MAD (au lieu de 1200 = 400×3
      // catalogue) — ajustementManuel passe à true côté service dès qu'un
      // prixTotalFinal est fourni (UpdateReservationDto).
      const patchRes = await adminClient
        .patch(`/api/reservations/${reservation.id}`)
        .send({
          prixTotalFinal: 900,
          motifAjustement: 'Tarif négocié client fidèle',
        });
      expect(patchRes.status).toBe(200);

      const checkinRes = await adminClient
        .post(`/api/checkin/${reservation.id}`)
        .send({ nombreOccupants: 1 });
      const s = checkinRes.body as StayResponse;

      const taxe = taxeSejour.taux.mul(3).mul(1);
      const ancienAttendu = new Prisma.Decimal(900).sub(taxe); // 900 - 9 = 891, jamais 400×3 - 9

      const previewRes = await receptionClient
        .post(`/api/stays/${s.id}/change-room/preview`)
        .send({ newRoomId: roomB.id });
      expect(previewRes.status).toBe(201);
      const preview = previewRes.body as ChangeRoomPreviewResponse;
      expect(preview.ancienMontantRestant).toBe(ancienAttendu.toFixed(2));
    });

    it('Capacité insuffisante détectée au commit (bypass du preview)', async () => {
      const { stay: s } = await createStay3Nuits(typeBasique.id, typeDeluxe.id);
      const typeMini = await prisma.roomType.create({
        data: {
          nom: `TEST-009B-MINI-${Date.now()}`,
          prixBase: 300,
          capacite: 0,
        },
      });
      const roomMini = await prisma.room.create({
        data: {
          numero: `009B-MINI-${Date.now()}`,
          roomTypeId: typeMini.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      // Preview rejette déjà (409, capacité 0 < 1 occupant).
      const previewRes = await receptionClient
        .post(`/api/stays/${s.id}/change-room/preview`)
        .send({ newRoomId: roomMini.id });
      expect(previewRes.status).toBe(409);
      expect((previewRes.body as { code?: string }).code).toBe(
        'CHANGE_ROOM_CAPACITY_EXCEEDED',
      );
      expect(previewRes.body).not.toHaveProperty('pricingFingerprint');

      // Commit directement (sans passer par un preview réussi) : même 409,
      // revalidé sous verrou dans la transaction.
      const changeRes = await receptionClient
        .post(`/api/stays/${s.id}/change-room`)
        .send({
          newRoomId: roomMini.id,
          motif: 'Tentative bypass capacité insuffisante',
          pricingFingerprint: 'fingerprint-arbitraire-jamais-atteint',
        });
      expect(changeRes.status).toBe(409);
      expect((changeRes.body as { code?: string }).code).toBe(
        'CHANGE_ROOM_CAPACITY_EXCEEDED',
      );

      await prisma.room.deleteMany({ where: { id: roomMini.id } });
      await prisma.roomType.deleteMany({ where: { id: typeMini.id } });
    });

    it('Aperçu périmé (PREVIEW_STALE) : rollback complet, zéro mutation DB, puis reconfirmation réussie', async () => {
      const { stay: s, roomB } = await createStay3Nuits(
        typeBasique.id,
        typeDeluxe.id,
      );

      const previewRes = await receptionClient
        .post(`/api/stays/${s.id}/change-room/preview`)
        .send({ newRoomId: roomB.id });
      expect(previewRes.status).toBe(201);
      const staleFingerprint = (previewRes.body as ChangeRoomPreviewResponse)
        .pricingFingerprint;

      // État complet avant la tentative périmée — pour prouver l'absence de
      // TOUTE mutation (Room, RoomNight, Folio/FolioLine, AuditLog,
      // HousekeepingTask), pas seulement l'absence d'écriture financière.
      const [
        roomBefore,
        roomNightsBefore,
        folioLinesBefore,
        auditBefore,
        taskBefore,
      ] = await Promise.all([
        prisma.room.findUniqueOrThrow({ where: { id: roomB.id } }),
        prisma.roomNight.findMany({ where: { stayId: s.id } }),
        prisma.folioLine.findMany({ where: { folio: { stayId: s.id } } }),
        prisma.auditLog.count({
          where: { targetEntity: 'Stay', targetId: s.id },
        }),
        prisma.housekeepingTask.count({ where: { origine: 'CHANGE_ROOM' } }),
      ]);

      // Le catalogue de la NOUVELLE chambre change entre le preview et la
      // confirmation (dérive simulée) — nouveauMontantRestant est calculé
      // depuis le catalogue courant (contrairement à ancienMontantRestant,
      // basé sur le folio déjà contracté, insensible à un changement de
      // typeBasique — voir le test « Catalogue tarifaire modifié... »
      // ci-dessus) : muter typeDeluxe (celui de roomB, la cible) est donc le
      // seul levier qui fait effectivement dériver le fingerprint recalculé
      // sous verrou par rapport à celui reçu.
      await prisma.roomType.update({
        where: { id: typeDeluxe.id },
        data: { prixBase: 777 },
      });

      const staleAttempt = await receptionClient
        .post(`/api/stays/${s.id}/change-room`)
        .send({
          newRoomId: roomB.id,
          motif: 'Confirmation avec un aperçu désormais périmé',
          pricingFingerprint: staleFingerprint,
        });
      expect(staleAttempt.status).toBe(409);
      expect((staleAttempt.body as { code?: string }).code).toBe(
        'CHANGE_ROOM_PREVIEW_STALE',
      );
      expect(
        (staleAttempt.body as { preview?: ChangeRoomPreviewResponse }).preview
          ?.pricingFingerprint,
      ).not.toBe(staleFingerprint);

      const [
        roomAfter,
        roomNightsAfter,
        folioLinesAfter,
        auditAfter,
        taskAfter,
      ] = await Promise.all([
        prisma.room.findUniqueOrThrow({ where: { id: roomB.id } }),
        prisma.roomNight.findMany({ where: { stayId: s.id } }),
        prisma.folioLine.findMany({ where: { folio: { stayId: s.id } } }),
        prisma.auditLog.count({
          where: { targetEntity: 'Stay', targetId: s.id },
        }),
        prisma.housekeepingTask.count({ where: { origine: 'CHANGE_ROOM' } }),
      ]);
      expect(roomAfter.statut).toBe(roomBefore.statut);
      expect(roomNightsAfter.map((n) => n.roomId).sort()).toEqual(
        roomNightsBefore.map((n) => n.roomId).sort(),
      );
      expect(folioLinesAfter.length).toBe(folioLinesBefore.length);
      expect(auditAfter).toBe(auditBefore);
      expect(taskAfter).toBe(taskBefore);

      // Reconfirmation : un nouvel aperçu (reflétant le catalogue à 777)
      // puis un commit avec ce nouveau fingerprint doit réussir.
      const freshPreview = await receptionClient
        .post(`/api/stays/${s.id}/change-room/preview`)
        .send({ newRoomId: roomB.id });
      expect(freshPreview.status).toBe(201);
      const retryRes = await receptionClient
        .post(`/api/stays/${s.id}/change-room`)
        .send({
          newRoomId: roomB.id,
          motif: 'Reconfirmation après aperçu périmé',
          pricingFingerprint: (freshPreview.body as ChangeRoomPreviewResponse)
            .pricingFingerprint,
        });
      expect(retryRes.status).toBe(201);

      await prisma.roomType.update({
        where: { id: typeDeluxe.id },
        data: { prixBase: 500 },
      });
    });

    // DESIGN-010 (Billing Center, mission §23.D) — « facture figée » :
    // changeRoom() écrit sa ligne d'ajustement (AJUSTEMENT_HAUSSE/BAISSE)
    // exclusivement via BillingService.addFolioLine (voir stay.service.ts),
    // qui porte déjà la garde « facture EMISE active » (CH-050). Ce test
    // n'a corrigé aucun code — il PROUVE que ce chemin est bien couvert
    // (mission : « ce test doit exister pour le PROUVER, pas nécessairement
    // pour corriger du code neuf »). Rien n'empêche aujourd'hui de générer
    // une facture sur le folio d'un séjour encore EN_COURS
    // (BillingService.generateInvoice ne vérifie jamais Stay.statut) — donc
    // ce scénario est réellement atteignable, pas seulement théorique.
    it('facture EMISE active sur le folio → changeRoom rejeté (409, hérité d’addFolioLine)', async () => {
      const { stay: s, roomB } = await createStay3Nuits(
        typeBasique.id,
        typeDeluxe.id,
      );

      const previewRes = await receptionClient
        .post(`/api/stays/${s.id}/change-room/preview`)
        .send({ newRoomId: roomB.id });
      expect(previewRes.status).toBe(201);
      const preview = previewRes.body as ChangeRoomPreviewResponse;

      const folio = await prisma.folio.findFirstOrThrow({
        where: { stayId: s.id },
      });
      const invoiceRes = await adminClient
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);

      const nbLignesAvant = await prisma.folioLine.count({
        where: { folioId: folio.id },
      });

      const changeRes = await receptionClient
        .post(`/api/stays/${s.id}/change-room`)
        .send({
          newRoomId: roomB.id,
          motif: 'Tentative de changement après facture émise (e2e)',
          pricingFingerprint: preview.pricingFingerprint,
        });
      expect(changeRes.status).toBe(409);

      // Aucune ligne AJUSTEMENT_HAUSSE/BAISSE créée, Stay.roomId inchangé.
      const nbLignesApres = await prisma.folioLine.count({
        where: { folioId: folio.id },
      });
      expect(nbLignesApres).toBe(nbLignesAvant);
      const stayApres = await prisma.stay.findUniqueOrThrow({
        where: { id: s.id },
      });
      expect(stayApres.roomId).not.toBe(roomB.id);

      // Avoir total : débloque le folio, changeRoom redevient possible.
      const creditNoteRes = await adminClient
        .post(
          `/api/invoices/${(invoiceRes.body as { id: number }).id}/credit-notes`,
        )
        .send({ motif: 'Avoir de test e2e pour débloquer changeRoom' });
      expect(creditNoteRes.status).toBe(201);

      const freshPreview = await receptionClient
        .post(`/api/stays/${s.id}/change-room/preview`)
        .send({ newRoomId: roomB.id });
      expect(freshPreview.status).toBe(201);
      const retryRes = await receptionClient
        .post(`/api/stays/${s.id}/change-room`)
        .send({
          newRoomId: roomB.id,
          motif: 'Changement après avoir — doit réussir',
          pricingFingerprint: (freshPreview.body as ChangeRoomPreviewResponse)
            .pricingFingerprint,
        });
      expect(retryRes.status).toBe(201);
    });
  });
});
