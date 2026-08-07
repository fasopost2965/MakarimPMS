import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BillingService } from '../src/modules/billing/billing.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { ParametersService } from '../src/modules/parameters/parameters.service';
import { StayService } from '../src/modules/stay/stay.service';
import { authedRequest, loginAs } from './helpers/auth';
import {
  AuditAction,
  FormuleHebergement,
  StatutChambre,
  StatutSejour,
  TypeLigneFolio,
} from '@prisma/client';

interface StayResponse {
  id: number;
  roomId: number;
  statut: string;
  dateCheckoutPrevue: string;
  folios: Array<{ id: number; lignes: Array<{ id: number }> }>;
}

interface RoomAlternative {
  id: number;
  roomTypeId: number;
}

interface RoomUnavailableBody {
  code: string;
  message: string;
  alternatives: RoomAlternative[];
}

interface PaymentRequiredBody {
  code: string;
  message: string;
  amountRequired: string;
  availableCredit: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

// GL-003 — Prolongation de séjour
describe('Stay - Extend (GL-003)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let billingService: BillingService;
  let auditService: AuditService;
  let parametersService: ParametersService;
  let stayService: StayService;
  let adminClient: ReturnType<typeof authedRequest>;
  let receptionClient: ReturnType<typeof authedRequest>;
  let gouvernanteClient: ReturnType<typeof authedRequest>;

  // Type de base (chambre actuelle), un type plus cher (alternative
  // prioritaire de secours) et un type moins cher (jamais une alternative
  // valide, CLAUDE.md/instructions GL-003).
  let roomTypeId: number;
  let roomTypeCherId: number;
  let roomTypeMoinsCherId: number;

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
    billingService = app.get(BillingService);
    auditService = app.get(AuditService);
    parametersService = app.get(ParametersService);
    stayService = app.get(StayService);

    const adminToken = await loginAs(app.getHttpServer(), 'admin');
    adminClient = authedRequest(app.getHttpServer(), adminToken);
    const receptionToken = await loginAs(app.getHttpServer(), 'reception');
    receptionClient = authedRequest(app.getHttpServer(), receptionToken);
    const gouvernanteToken = await loginAs(app.getHttpServer(), 'gouvernante');
    gouvernanteClient = authedRequest(app.getHttpServer(), gouvernanteToken);

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const base = await prisma.roomType.create({
      data: {
        nom: `TEST-GL003-BASE-${suffix}`,
        prixBase: 100,
        capacite: 2,
        prixPetitDejeuner: 10,
        prixDemiPension: 30,
        prixPensionComplete: 50,
      },
    });
    roomTypeId = base.id;

    const cher = await prisma.roomType.create({
      data: {
        nom: `TEST-GL003-CHER-${suffix}`,
        prixBase: 150,
        capacite: 2,
      },
    });
    roomTypeCherId = cher.id;

    const moinsCher = await prisma.roomType.create({
      data: {
        nom: `TEST-GL003-MOINSCHER-${suffix}`,
        prixBase: 50,
        capacite: 2,
      },
    });
    roomTypeMoinsCherId = moinsCher.id;
  });

  afterAll(async () => {
    const roomTypeIds = [roomTypeId, roomTypeCherId, roomTypeMoinsCherId];
    await prisma.roomNight.deleteMany({
      where: { room: { roomTypeId: { in: roomTypeIds } } },
    });
    await prisma.folioLine.deleteMany({
      where: { folio: { stay: { room: { roomTypeId: { in: roomTypeIds } } } } },
    });
    await prisma.payment.deleteMany({
      where: { folio: { stay: { room: { roomTypeId: { in: roomTypeIds } } } } },
    });
    await prisma.invoice.deleteMany({
      where: { folio: { stay: { room: { roomTypeId: { in: roomTypeIds } } } } },
    });
    await prisma.folio.deleteMany({
      where: { stay: { room: { roomTypeId: { in: roomTypeIds } } } },
    });
    await prisma.stay.deleteMany({
      where: { room: { roomTypeId: { in: roomTypeIds } } },
    });
    await prisma.reservation.deleteMany({
      where: { room: { roomTypeId: { in: roomTypeIds } } },
    });
    await prisma.rateRestriction.deleteMany({
      where: { roomTypeId: { in: roomTypeIds } },
    });
    await prisma.seasonRate.deleteMany({
      where: { roomTypeId: { in: roomTypeIds } },
    });
    await prisma.roomStatusLog.deleteMany({
      where: { room: { roomTypeId: { in: roomTypeIds } } },
    });
    await prisma.housekeepingTaskLog.deleteMany({
      where: { task: { room: { roomTypeId: { in: roomTypeIds } } } },
    });
    await prisma.housekeepingTask.deleteMany({
      where: { room: { roomTypeId: { in: roomTypeIds } } },
    });
    await prisma.room.deleteMany({
      where: { roomTypeId: { in: roomTypeIds } },
    });
    await prisma.roomType.deleteMany({ where: { id: { in: roomTypeIds } } });
    await app.close();
  });

  describe('POST /stays/:id/extend', () => {
    let room1: { id: number };
    let room2: { id: number };
    let room3: { id: number };
    let room4: { id: number };
    let room5: { id: number };
    let guest: { id: number };
    let stay: StayResponse;
    let today: Date;

    beforeEach(async () => {
      today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

      room1 = await prisma.room.create({
        data: {
          numero: `GL003-1-${suffix}`,
          roomTypeId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      room2 = await prisma.room.create({
        data: {
          numero: `GL003-2-${suffix}`,
          roomTypeId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      room3 = await prisma.room.create({
        data: {
          numero: `GL003-3-${suffix}`,
          roomTypeId: roomTypeCherId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      room4 = await prisma.room.create({
        data: {
          numero: `GL003-4-${suffix}`,
          roomTypeId: roomTypeMoinsCherId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      room5 = await prisma.room.create({
        data: {
          numero: `GL003-5-${suffix}`,
          roomTypeId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      guest = await prisma.guest.create({
        data: {
          nom: 'Extend',
          prenom: 'Test',
          email: `extend-${suffix}@example.com`,
          telephone: '+212600000002',
          nationalite: 'MA',
          pieceIdentite: `EX${suffix}`,
          categorie: 'STANDARD',
        },
      });

      const walkinRes = await adminClient.post('/api/checkin/walk-in').send({
        roomId: room1.id,
        dateCheckoutPrevue: isoDate(addDays(today, 2)),
        guestId: guest.id,
        formule: FormuleHebergement.ROOM_ONLY,
        nombreOccupants: 2,
      });
      expect(walkinRes.status).toBe(201);
      stay = walkinRes.body as StayResponse;
      expect(stay.statut).toBe(StatutSejour.EN_COURS);
      expect(stay.roomId).toBe(room1.id);

      // Toujours réinitialiser le drapeau de paiement immédiat au début de
      // chaque test — même précédent que la Room fraîchement LIBRE_PROPRE
      // ci-dessus : jamais d'état résiduel d'un test précédent.
      await prisma.hotelConfig.updateMany({
        data: { paiementImmediatProlongationObligatoire: false },
      });
    });

    afterEach(async () => {
      const roomIds = [room1.id, room2.id, room3.id, room4.id, room5.id];
      await prisma.auditLog.deleteMany({
        where: { targetId: stay.id, targetEntity: 'Stay' },
      });
      await prisma.payment.deleteMany({
        where: { folio: { stay: { roomId: { in: roomIds } } } },
      });
      await prisma.invoice.deleteMany({
        where: { folio: { stay: { roomId: { in: roomIds } } } },
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
      await prisma.rateRestriction.deleteMany({
        where: { roomTypeId: { in: [roomTypeId, roomTypeCherId] } },
      });
      await prisma.seasonRate.deleteMany({ where: { roomTypeId } });
      await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
      await prisma.guest.deleteMany({ where: { id: guest.id } });
      await prisma.hotelConfig.updateMany({
        data: { paiementImmediatProlongationObligatoire: false },
      });
      jest.restoreAllMocks();
    });

    it('Prolongation nominale : ajoute uniquement les nuits du delta', async () => {
      const nouvelleDate = isoDate(addDays(today, 4));
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: nouvelleDate,
          motif: 'Le client souhaite prolonger son séjour de 2 nuits',
        });

      expect(res.status).toBe(201);
      const body = res.body as StayResponse;
      expect(body.dateCheckoutPrevue.slice(0, 10)).toBe(nouvelleDate);

      const nights = await prisma.roomNight.findMany({
        where: { roomId: room1.id, stayId: stay.id },
      });
      expect(nights.length).toBe(4); // 2 nuits initiales + 2 nuits ajoutées

      const folioLines = await prisma.folioLine.findMany({
        where: { folio: { stayId: stay.id }, type: TypeLigneFolio.HEBERGEMENT },
      });
      // 1 ligne HEBERGEMENT initiale (check-in) + 1 nouvelle ligne pour le
      // supplément — jamais un recalcul de la ligne existante.
      expect(folioLines.length).toBe(2);
      const nouvelleLigne = folioLines.find((l) =>
        l.libelle.startsWith('Prolongation'),
      );
      expect(nouvelleLigne).toBeDefined();
      expect(Number(nouvelleLigne!.montant)).toBeCloseTo(200); // 2 nuits x 100

      const auditLog = await prisma.auditLog.findFirstOrThrow({
        where: { action: AuditAction.EXTEND_STAY, targetId: stay.id },
      });
      expect(auditLog.motif).toBe(
        'Le client souhaite prolonger son séjour de 2 nuits',
      );
    });

    it('Changement de saison : nuits ajoutées à cheval sur deux SeasonRate', async () => {
      // Nuits ajoutées : today+2 et today+3 (extension de 2 nuits, dates
      // dateCheckoutPrevue initiale = today+2). Deux tarifs saisonniers
      // couvrent chacun une seule de ces deux nuits.
      await prisma.seasonRate.create({
        data: {
          roomTypeId,
          libelle: 'Saison A',
          dateDebut: addDays(today, 2),
          dateFin: addDays(today, 2),
          prixNuit: 120,
        },
      });
      await prisma.seasonRate.create({
        data: {
          roomTypeId,
          libelle: 'Saison B',
          dateDebut: addDays(today, 3),
          dateFin: addDays(today, 3),
          prixNuit: 140,
        },
      });

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Prolongation à cheval sur deux saisons tarifaires',
        });
      expect(res.status).toBe(201);

      const nouvelleLigne = await prisma.folioLine.findFirstOrThrow({
        where: {
          folio: { stayId: stay.id },
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: { startsWith: 'Prolongation' },
        },
      });
      expect(Number(nouvelleLigne.montant)).toBeCloseTo(120 + 140);
    });

    it('Formule EXTRA ajoutée pour une formule ≠ ROOM_ONLY', async () => {
      // Nouveau séjour dédié en HALF_BOARD (le séjour partagé par défaut est
      // ROOM_ONLY — voir beforeEach).
      const stayRes = await adminClient.post('/api/checkin/walk-in').send({
        roomId: room5.id,
        dateCheckoutPrevue: isoDate(addDays(today, 2)),
        guestId: guest.id,
        formule: FormuleHebergement.HALF_BOARD,
        nombreOccupants: 2,
      });
      const halfBoardStay = stayRes.body as StayResponse;

      const res = await receptionClient
        .post(`/api/stays/${halfBoardStay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Prolongation avec formule demi-pension conservée',
        });
      expect(res.status).toBe(201);

      const extraLine = await prisma.folioLine.findFirstOrThrow({
        where: {
          folio: { stayId: halfBoardStay.id },
          type: TypeLigneFolio.EXTRA,
          libelle: { startsWith: 'Prolongation' },
        },
      });
      // 2 nuits x 2 personnes (capacite roomType) x 30 (prixDemiPension)
      expect(Number(extraLine.montant)).toBeCloseTo(120);
    });

    it('Nouvelle date identique à l’actuelle doit être rejetée (400)', async () => {
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 2)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(400);
    });

    it('Nouvelle date antérieure à l’actuelle doit être rejetée (400)', async () => {
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 1)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(400);
    });

    it('Séjour inexistant doit retourner 404', async () => {
      const res = await receptionClient
        .post('/api/stays/99999999/extend')
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(404);
    });

    it('Séjour déjà clôturé doit être rejeté (409)', async () => {
      const checkoutRes = await adminClient
        .post(`/api/checkout/${stay.id}`)
        .send({ force: true, motif: 'Check-out forcé pour préparer le test' });
      expect(checkoutRes.status).toBe(201);

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(409);
    });

    it('Permission absente (Gouvernante) doit être rejetée (403)', async () => {
      const res = await gouvernanteClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(403);
    });

    it("Conflit avec une RoomNight issue d'une Reservation → 409 ROOM_UNAVAILABLE avec alternatives", async () => {
      // Réservation future sur room1 chevauchant une nuit du delta demandé.
      await receptionClient.post('/api/reservations').send({
        roomId: room1.id,
        guestId: guest.id,
        dateArrivee: isoDate(addDays(today, 2)),
        dateDepart: isoDate(addDays(today, 3)),
      });

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(409);
      const body = res.body as RoomUnavailableBody;
      expect(body.code).toBe('ROOM_UNAVAILABLE');
      expect(body.alternatives.length).toBeGreaterThan(0);

      // Jamais de changement de chambre automatique — Stay.roomId inchangé.
      const stayAfter = await prisma.stay.findUniqueOrThrow({
        where: { id: stay.id },
      });
      expect(stayAfter.roomId).toBe(room1.id);
    });

    it("Conflit avec une RoomNight issue d'un autre séjour walk-in (sans reservationId) → 409", async () => {
      // Simule une RoomNight déjà posée sur room1 par un autre séjour, sans
      // jamais passer par une Reservation (reservationId toujours null,
      // même situation que GL-002) — fixture directe car un deuxième
      // check-in walk-in réel sur room1 échouerait dès la transition de
      // statut (OCCUPEE → OCCUPEE n'est pas une transition valide).
      const otherStayRes = await adminClient.post('/api/checkin/walk-in').send({
        roomId: room5.id,
        dateCheckoutPrevue: isoDate(addDays(today, 2)),
        guestId: guest.id,
        nombreOccupants: 2,
      });
      const otherStay = otherStayRes.body as StayResponse;
      await prisma.roomNight.create({
        data: {
          roomId: room1.id,
          date: addDays(today, 2),
          stayId: otherStay.id,
        },
      });

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(409);
      expect((res.body as RoomUnavailableBody).code).toBe('ROOM_UNAVAILABLE');
    });

    it('Alternative de même catégorie priorisée avant une catégorie plus chère, jamais de catégorie moins chère', async () => {
      await receptionClient.post('/api/reservations').send({
        roomId: room1.id,
        guestId: guest.id,
        dateArrivee: isoDate(addDays(today, 2)),
        dateDepart: isoDate(addDays(today, 3)),
      });

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(409);
      const body = res.body as RoomUnavailableBody;
      const alternativeIds = body.alternatives.map((r) => r.id);

      expect(alternativeIds).toContain(room2.id); // même catégorie
      expect(alternativeIds).toContain(room3.id); // catégorie plus chère
      expect(alternativeIds).not.toContain(room4.id); // jamais moins cher
      // Même catégorie (roomTypeId identique, prixBase égal) triée avant la
      // catégorie plus chère.
      const idxRoom2 = alternativeIds.indexOf(room2.id);
      const idxRoom3 = alternativeIds.indexOf(room3.id);
      expect(idxRoom2).toBeLessThan(idxRoom3);
    });

    it('Catégorie plus chère proposée si la même catégorie est indisponible', async () => {
      // room2 (même catégorie) rendue indisponible.
      await prisma.room.update({
        where: { id: room2.id },
        data: { statut: StatutChambre.EN_MAINTENANCE },
      });
      await receptionClient.post('/api/reservations').send({
        roomId: room1.id,
        guestId: guest.id,
        dateArrivee: isoDate(addDays(today, 2)),
        dateDepart: isoDate(addDays(today, 3)),
      });

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(409);
      const alternativeIds = (res.body as RoomUnavailableBody).alternatives.map(
        (r) => r.id,
      );
      expect(alternativeIds).not.toContain(room2.id);
      expect(alternativeIds).toContain(room3.id);
    });

    it('Chambre actuellement EN_MAINTENANCE traitée comme indisponible', async () => {
      await prisma.room.update({
        where: { id: room1.id },
        data: { statut: StatutChambre.EN_MAINTENANCE },
      });

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(409);
      expect((res.body as RoomUnavailableBody).code).toBe('ROOM_UNAVAILABLE');
    });

    it('Stop Sale actif sur les nuits ajoutées n’empêche jamais la prolongation', async () => {
      await prisma.rateRestriction.create({
        data: {
          roomTypeId,
          dateDebut: addDays(today, 2),
          dateFin: addDays(today, 3),
          stopSale: true,
          libelle: 'Test stop sale GL-003',
        },
      });

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(201);
    });

    it('Aucune tâche housekeeping créée, Room.statut inchangé (OCCUPEE)', async () => {
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(201);

      const tasks = await prisma.housekeepingTask.findMany({
        where: { roomId: room1.id },
      });
      expect(tasks.length).toBe(0);

      const roomAfter = await prisma.room.findUniqueOrThrow({
        where: { id: room1.id },
      });
      expect(roomAfter.statut).toBe(StatutChambre.OCCUPEE);
    });

    it('Facture déjà EMISE sur le folio → conflit hérité d’addFolioLine (409)', async () => {
      const folioId = stay.folios[0].id;
      const invoiceRes = await adminClient.post(
        `/api/invoices/generer?folioId=${folioId}`,
      );
      expect(invoiceRes.status).toBe(201);

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(409);

      // Aucune nuit ajoutée malgré l'échec.
      const nights = await prisma.roomNight.findMany({
        where: { roomId: room1.id, stayId: stay.id },
      });
      expect(nights.length).toBe(2);
    });

    describe('Paiement immédiat obligatoire (HotelConfig.paiementImmediatProlongationObligatoire)', () => {
      it('Paramètre false (défaut) : prolongation directe sans vérification de crédit', async () => {
        const res = await receptionClient
          .post(`/api/stays/${stay.id}/extend`)
          .send({
            nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
            motif: 'Prolongation sans paiement immédiat requis',
          });
        expect(res.status).toBe(201);
      });

      it('Paramètre true sans crédit suffisant → 409 PAYMENT_REQUIRED, aucune écriture committée', async () => {
        await prisma.hotelConfig.updateMany({
          data: { paiementImmediatProlongationObligatoire: true },
        });

        const nightsBefore = await prisma.roomNight.count({
          where: { roomId: room1.id, stayId: stay.id },
        });
        const linesBefore = await prisma.folioLine.count({
          where: { folio: { stayId: stay.id } },
        });
        const auditBefore = await prisma.auditLog.count({
          where: { action: AuditAction.EXTEND_STAY, targetId: stay.id },
        });

        const res = await receptionClient
          .post(`/api/stays/${stay.id}/extend`)
          .send({
            nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
            motif: 'Prolongation sans crédit disponible suffisant',
          });
        expect(res.status).toBe(409);
        const body = res.body as PaymentRequiredBody;
        expect(body.code).toBe('PAYMENT_REQUIRED');
        // Aucun paiement encaissé : crédit disponible nul, montant requis =
        // 2 nuits x 100 MAD.
        expect(body.availableCredit).toBe('0.00');
        expect(body.amountRequired).toBe('200.00');

        const nightsAfter = await prisma.roomNight.count({
          where: { roomId: room1.id, stayId: stay.id },
        });
        const linesAfter = await prisma.folioLine.count({
          where: { folio: { stayId: stay.id } },
        });
        const auditAfter = await prisma.auditLog.count({
          where: { action: AuditAction.EXTEND_STAY, targetId: stay.id },
        });
        expect(nightsAfter).toBe(nightsBefore);
        expect(linesAfter).toBe(linesBefore);
        expect(auditAfter).toBe(auditBefore);

        const stayAfter = await prisma.stay.findUniqueOrThrow({
          where: { id: stay.id },
        });
        expect(stayAfter.dateCheckoutPrevue.toISOString().slice(0, 10)).toBe(
          isoDate(addDays(today, 2)),
        );
      });

      it('Paiement enregistré séparément puis nouvel appel réussit', async () => {
        await prisma.hotelConfig.updateMany({
          data: { paiementImmediatProlongationObligatoire: true },
        });

        const firstAttempt = await receptionClient
          .post(`/api/stays/${stay.id}/extend`)
          .send({
            nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
            motif: 'Première tentative, sans crédit disponible',
          });
        expect(firstAttempt.status).toBe(409);

        const folioId = stay.folios[0].id;
        // Crédit disponible = paiements − charges déjà existantes (hors
        // PAIEMENT) : la charge initiale (200 HEBERGEMENT + 12 TAXE_SEJOUR,
        // FIN-102B, matérialisée dès le check-in = 212) doit d'abord être
        // couverte avant que le supplément de 200 requis (montantSupplement
        // n'inclut jamais la taxe, voir extendStay) ne soit lui-même
        // disponible en crédit — encaisser 412 au total.
        const paymentRes = await adminClient.post('/api/payments').send({
          folioId,
          moyen: 'ESPECES',
          montant: '412.00',
          idempotencyKey: `gl003-payment-${stay.id}-${Date.now()}`,
        });
        expect(paymentRes.status).toBe(201);

        const retry = await receptionClient
          .post(`/api/stays/${stay.id}/extend`)
          .send({
            nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
            motif: 'Nouvelle tentative après enregistrement du paiement',
          });
        expect(retry.status).toBe(201);
      });

      // GL-003J — Course concurrente extend / annulation du paiement qui
      // finance son crédit, sur le même folio.
      //
      // Pourquoi cette direction précise (et pas un simple nouveau paiement
      // concurrent) : un nouveau paiement (POST /payments) s'écrit toujours
      // de façon inconditionnelle, indépendamment de la décision de
      // extendStay — que extendStay le voie ou non dans son instantané ne
      // peut jamais produire une incohérence (soit il est vu et le crédit
      // suffit légitimement, soit il ne l'est pas et extendStay rejette à
      // juste titre ; le paiement finit de toute façon par être crédité, vérifié
      // empiriquement : ce scénario reste vert à 100% même verrou retiré).
      // Le danger réel décrit par le commentaire de l'étape 5 de extendStay
      // (stay.service.ts) est la direction inverse : un crédit déjà présent
      // au moment de la lecture non verrouillée du folio disparaît (ligne
      // PAIEMENT annulée) avant que extendStay ne committe — c'est ce
      // scénario qui est reproduit ici. Aucun endpoint HTTP ne permet
      // aujourd'hui d'annuler une ligne PAIEMENT (DELETE
      // /billing/folios/lignes/:id — BillingService.cancelFolioLine — est
      // explicitement réservé aux lignes EXTRA/RESTAURANT), donc ce test
      // reproduit directement l'écriture SQL qu'un tel endpoint ferait
      // (UPDATE FolioLine SET annulee = true sur la ligne PAIEMENT) — c'est
      // exactement l'opération que le second volet du verrou de cette
      // correction (verrouiller aussi les FolioLine existantes, pas
      // seulement le Folio) est censé sérialiser avec la lecture de
      // extendStay.
      //
      // Fenêtre de course élargie de façon déterministe (sans toucher au
      // comportement métier) : mesuré empiriquement, l'annulation directe en
      // base committe presque instantanément, largement avant que
      // extendStay n'atteigne sa lecture de folio (plusieurs verrous
      // FOR UPDATE Stay/Room/RoomNight la précèdent) — un simple
      // Promise.all sans contrôle de timing ne recrée donc jamais la
      // fenêtre dangereuse (le folio est déjà relu après l'annulation dans
      // 100% des essais, ce qui rejette légitimement l'extension par
      // manque de crédit, sans jamais exercer le chemin à risque). Un
      // spy sur ParametersService.getSeasonRatesForRoomType (appelé par
      // extendStay juste après la lecture du folio, étape 7, avant le
      // calcul du crédit à l'étape 8) introduit un délai artificiel
      // purement côté test — même famille que les spies déjà utilisés plus
      // haut dans ce fichier (billingService.addFolioLine,
      // auditService.writeLog) — pour garantir que l'annulation concurrente
      // committe entre la lecture du folio et le commit de extendStay, sans
      // modifier aucune donnée ni aucun calcul (l'implémentation réelle est
      // toujours appelée derrière le délai).
      //
      // Discriminant : avant la correction GL-003J, tx.folio.findMany
      // (étape 5 de extendStay) n'était protégé par aucun verrou explicite.
      // Sous MySQL REPEATABLE READ, l'instantané de cette lecture est établi
      // à ce moment précis ; l'annulation du paiement committe ensuite
      // (grâce au délai ci-dessus, dans la fenêtre) — invisible de cet
      // instantané — mais avant le commit de extendStay : le crédit calculé
      // reste celui d'avant l'annulation, extendStay committe une
      // prolongation non couverte alors que le crédit réel, une fois les
      // deux opérations terminées, ne la couvre plus. Avec le verrou (FOR
      // UPDATE sur Folio puis sur les FolioLine existantes, dont la ligne
      // PAIEMENT), l'UPDATE FolioLine de l'annulation ne peut plus committer
      // avant que extendStay n'ait relâché son verrou (fin de transaction)
      // — les deux opérations sont réellement sérialisées : soit
      // l'annulation committe avant que extendStay ne lise le folio (crédit
      // vu comme insuffisant, 409), soit après que extendStay ait déjà
      // committé (l'extension avait déjà réellement le crédit au moment de
      // son commit) — jamais entre les deux.
      //
      // Preuve de rigueur sabotage/restore (CLAUDE.md) : le bloc de
      // verrouillage ajouté par cette correction (lockedFolioIds + verrou
      // FolioLine, étape 5 de stay.service.ts) a été temporairement commenté
      // et ce test relancé isolément à plusieurs reprises avec ce même délai
      // de fenêtre de course. Observation : le test échoue de façon stable
      // (extension approuvée à 201 alors que le paiement qui la finançait a
      // bien été annulé entre-temps — le solde recalculé après coup est
      // strictement positif, faisant échouer l'assertion `soldeFinal <= 0`
      // ci-dessous, exactement la preuve attendue). Le bloc de verrouillage
      // a ensuite été restauré à l'identique et ce test revérifié vert de
      // façon stable sur plusieurs exécutions consécutives ; aucun code de
      // sabotage n'est laissé actif dans ce fichier ni dans
      // stay.service.ts.
      it('Course extend/annulation de paiement concurrentes sur le même folio : jamais de solde positif après une extension approuvée', async () => {
        await prisma.hotelConfig.updateMany({
          data: { paiementImmediatProlongationObligatoire: true },
        });

        const folioId = stay.folios[0].id;
        // Crédit réuni AVANT la course, exactement à hauteur du besoin :
        // charge initiale (200 HEBERGEMENT + 12 TAXE_SEJOUR, FIN-102B,
        // matérialisée dès le check-in) + supplément à venir (200,
        // montantSupplement du contrôle de crédit n'inclut jamais la taxe,
        // voir extendStay) = 412.
        const paymentRes = await adminClient.post('/api/payments').send({
          folioId,
          moyen: 'ESPECES',
          montant: '412.00',
          idempotencyKey: `gl003j-payment-base-${stay.id}-${Date.now()}`,
        });
        expect(paymentRes.status).toBe(201);
        const paymentLine = await prisma.folioLine.findFirstOrThrow({
          where: { folioId, type: TypeLigneFolio.PAIEMENT },
        });
        const receptionUser = await prisma.user.findUniqueOrThrow({
          where: { email: 'reception@makarim.test' },
        });

        // Appel direct de StayService.extendStay (pas via HTTP) : élimine
        // toute latence de la couche HTTP/guards, sans rien changer au
        // comportement réellement testé — même méthode, même transaction
        // Prisma, seul le transport diffère.
        //
        // Point de synchronisation déterministe plutôt qu'un délai deviné :
        // getSeasonRatesForRoomType (étape 7 de extendStay) n'est appelé
        // qu'après la lecture verrouillée du folio (étape 5) et avant le
        // calcul du crédit (étape 8). Le signaler dès son invocation
        // garantit que l'étape 5 est déjà passée avant de déclencher
        // l'annulation concurrente ; le maintenir en pause jusqu'à
        // relâchement explicite garantit que l'annulation a le temps de
        // committer (ou, avec le verrou de cette correction, de tenter de
        // committer et d'attendre) avant que extendStay ne poursuive vers
        // le calcul du crédit puis le commit — fenêtre de course fiable à
        // 100%, pas une estimation de délai. Type explicite (plutôt qu'une
        // inférence sur .bind(), qui résout en `any` avec ce lib TS) pour
        // rester conforme aux règles @typescript-eslint/no-unsafe-* déjà
        // appliquées ailleurs.
        type GetSeasonRatesFn = ParametersService['getSeasonRatesForRoomType'];
        const originalGetSeasonRates =
          parametersService.getSeasonRatesForRoomType.bind(
            parametersService,
          ) as GetSeasonRatesFn;
        let releaseFolioRead!: () => void;
        const folioReadDone = new Promise<void>((resolve) => {
          releaseFolioRead = resolve;
        });
        let signalSeasonRatesReached!: () => void;
        const seasonRatesReached = new Promise<void>((resolve) => {
          signalSeasonRatesReached = resolve;
        });
        jest
          .spyOn(parametersService, 'getSeasonRatesForRoomType')
          .mockImplementation(
            async (
              ...args: Parameters<GetSeasonRatesFn>
            ): ReturnType<GetSeasonRatesFn> => {
              signalSeasonRatesReached();
              await folioReadDone;
              return originalGetSeasonRates(...args);
            },
          );

        const extendPromise = stayService
          .extendStay(
            stay.id,
            isoDate(addDays(today, 4)),
            'Course concurrente avec annulation du paiement',
            receptionUser.id,
            receptionUser.roleId,
          )
          .then(
            (value) => ({ status: 201 as const, value }),
            (error: unknown) => {
              const status =
                error instanceof ConflictException ||
                error instanceof BadRequestException
                  ? 409
                  : 500;
              return { status, error };
            },
          );

        // Attend la preuve que extendStay a bien dépassé sa lecture
        // verrouillée du folio (étape 5) avant de déclencher l'annulation
        // concurrente. L'annulation est déclenchée SANS attendre son
        // règlement ici (elle committe immédiatement sans le verrou de
        // cette correction, ou reste bloquée jusqu'à la fin de la
        // transaction extendStay avec le verrou) — l'attendre à cet
        // endroit créerait un blocage mutuel avec extendStay, qui lui-même
        // n'avance vers son commit qu'après releaseFolioRead() ci-dessous.
        await seasonRatesReached;
        // Piste l'ORDRE réel de règlement des deux opérations — c'est
        // l'invariant pertinent, pas le solde final. Un solde positif après
        // coup n'est PAS en soi une anomalie : si extendStay committe
        // légitimement avant que l'annulation ne committe à son tour
        // (ordre valide, exactement ce que garantit cette correction), le
        // solde peut redevenir positif ensuite sans que ce soit un bug — de
        // la même façon qu'un remboursement demandé dix minutes après une
        // prolongation validée n'est jamais un défaut d'intégrité. Le seul
        // cas réellement dangereux (celui identifié par makarim-reviewer)
        // est que l'annulation committe AVANT extendStay sans que ce
        // dernier ne le voie — c'est précisément ce que le verrou empêche
        // désormais structurellement.
        let cancelSettledFirst = false;
        let extendSettledFirst = false;
        const cancelPromise = prisma.folioLine
          .update({
            where: { id: paymentLine.id },
            data: { annulee: true },
          })
          .then((v) => {
            if (!extendSettledFirst) cancelSettledFirst = true;
            return v;
          });
        // Laisse maintenant extendStay poursuivre vers le calcul du crédit
        // (étape 8) puis le commit — les deux opérations avancent
        // concurremment à partir d'ici, exactement la course voulue.
        releaseFolioRead();
        const trackedExtendPromise = extendPromise.then((v) => {
          if (!cancelSettledFirst) extendSettledFirst = true;
          return v;
        });
        const [extendRes] = await Promise.all([
          trackedExtendPromise,
          cancelPromise,
        ]);

        expect([201, 409]).toContain(extendRes.status);

        // Invariant réel : si l'annulation a réellement committé AVANT
        // extendStay (donc son effet aurait dû être visible), extendStay
        // ne doit jamais avoir approuvé la prolongation avec un crédit déjà
        // retiré — sans le verrou de cette correction, l'annulation
        // committe immédiatement (bien avant extendStay, qui reste en
        // pause), donc ce cas se produit systématiquement et démontre le
        // défaut ; avec le verrou, l'annulation ne peut structurellement
        // jamais committer avant extendStay (elle reste bloquée sur le
        // verrou FolioLine jusqu'à ce qu'il relâche), donc cette branche ne
        // s'exécute jamais — c'est exactement la garantie recherchée.
        if (cancelSettledFirst) {
          expect(extendRes.status).toBe(409);
        }
      });

      it('Crédit supérieur au montant requis : reliquat conservé après application', async () => {
        await prisma.hotelConfig.updateMany({
          data: { paiementImmediatProlongationObligatoire: true },
        });

        const folioId = stay.folios[0].id;
        // Charge initiale = 200 (2 nuits x 100) + 12 TAXE_SEJOUR (FIN-102B,
        // 2 nuits x 2 occupants x 3 MAD, matérialisée dès le check-in) = 212.
        // Supplément requis à la prolongation = 200 (delta HEBERGEMENT,
        // montantSupplement du contrôle de crédit n'inclut jamais la taxe,
        // voir extendStay) + 12 (delta TAXE_SEJOUR, matérialisé lui aussi
        // dans folioLines) = 212. 500 encaissés couvrent 212 + 212 = 424 et
        // laissent un reliquat de 76 après application de la prolongation.
        const paymentRes = await adminClient.post('/api/payments').send({
          folioId,
          moyen: 'ESPECES',
          montant: '500.00',
          idempotencyKey: `gl003-payment-surplus-${stay.id}-${Date.now()}`,
        });
        expect(paymentRes.status).toBe(201);

        const res = await receptionClient
          .post(`/api/stays/${stay.id}/extend`)
          .send({
            nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
            motif: 'Prolongation avec crédit supérieur au montant requis',
          });
        expect(res.status).toBe(201);

        const folioLines = await prisma.folioLine.findMany({
          where: { folioId },
        });
        const paiements = folioLines
          .filter((l) => l.type === TypeLigneFolio.PAIEMENT)
          .reduce((sum, l) => sum + Number(l.montant), 0);
        const charges = folioLines
          .filter((l) => l.type !== TypeLigneFolio.PAIEMENT && !l.annulee)
          .reduce((sum, l) => sum + Number(l.montant), 0);
        // Reliquat = 500 (paiement) − (212 initial + 212 supplément) = 76,
        // toujours présent après application (jamais perdu/écrêté) :
        // paiements > charges de précisément ce reliquat.
        expect(paiements - charges).toBeCloseTo(76);
      });
    });

    it('Rollback intégral si l’écriture FolioLine échoue (sabotage/restore)', async () => {
      jest
        .spyOn(billingService, 'addFolioLine')
        .mockRejectedValueOnce(new Error('Sabotage : addFolioLine en échec'));

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(500);

      const [nightsAfter, stayAfter, auditAfter] = await Promise.all([
        prisma.roomNight.count({
          where: { roomId: room1.id, stayId: stay.id },
        }),
        prisma.stay.findUniqueOrThrow({ where: { id: stay.id } }),
        prisma.auditLog.findFirst({
          where: { action: AuditAction.EXTEND_STAY, targetId: stay.id },
        }),
      ]);
      expect(nightsAfter).toBe(2);
      expect(stayAfter.dateCheckoutPrevue.toISOString().slice(0, 10)).toBe(
        isoDate(addDays(today, 2)),
      );
      expect(auditAfter).toBeNull();

      jest.restoreAllMocks();
      const retry = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Nouvelle tentative après restauration du sabotage',
        });
      expect(retry.status).toBe(201);
    });

    it('Rollback intégral si l’écriture AuditLog échoue (sabotage/restore)', async () => {
      jest
        .spyOn(auditService, 'writeLog')
        .mockRejectedValueOnce(new Error('Sabotage : writeLog en échec'));

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Motif valide minimum 10 caractères',
        });
      expect(res.status).toBe(500);

      const [nightsAfter, stayAfter, linesAfter] = await Promise.all([
        prisma.roomNight.count({
          where: { roomId: room1.id, stayId: stay.id },
        }),
        prisma.stay.findUniqueOrThrow({ where: { id: stay.id } }),
        prisma.folioLine.count({ where: { folio: { stayId: stay.id } } }),
      ]);
      expect(nightsAfter).toBe(2);
      expect(stayAfter.dateCheckoutPrevue.toISOString().slice(0, 10)).toBe(
        isoDate(addDays(today, 2)),
      );
      // HEBERGEMENT + TAXE_SEJOUR initiales du check-in (FIN-102B,
      // matérialisée dès le check-in) — le rollback intégral de la
      // prolongation sabotée ne doit en ajouter aucune.
      expect(linesAfter).toBe(2);

      jest.restoreAllMocks();
      const retry = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Nouvelle tentative après restauration du sabotage',
        });
      expect(retry.status).toBe(201);
    });

    // Deux appels concurrents identiques sur le MÊME séjour : le verrou
    // FOR UPDATE sur Stay sérialise les deux transactions — la seconde relit
    // une dateCheckoutPrevue déjà mise à jour par la première (verrou
    // relâché après commit) et échoue donc la validation de date (nouvelle
    // date <= date déjà atteinte). Un seul des deux appels réussit — même
    // garantie de non-double-écriture que GL-002 (contrainte unique
    // RoomNight(roomId, date) + verrous FOR UPDATE), ici démontrée sur la
    // sérialisation de Stay.dateCheckoutPrevue plutôt que sur une chambre
    // alternative partagée (cette route ne déplace jamais automatiquement
    // une chambre — voir instructions GL-003).
    it('Deux prolongations concurrentes identiques sur le même séjour : un seul succès', async () => {
      const nouvelleDate = isoDate(addDays(today, 4));
      const [res1, res2] = await Promise.all([
        receptionClient.post(`/api/stays/${stay.id}/extend`).send({
          nouvelleDateCheckoutPrevue: nouvelleDate,
          motif: 'Course concurrente — appel 1',
        }),
        receptionClient.post(`/api/stays/${stay.id}/extend`).send({
          nouvelleDateCheckoutPrevue: nouvelleDate,
          motif: 'Course concurrente — appel 2',
        }),
      ]);

      const statuses = [res1.status, res2.status];
      const successCount = statuses.filter((s) => s === 201).length;
      expect(successCount).toBe(1);

      const nights = await prisma.roomNight.count({
        where: { roomId: room1.id, stayId: stay.id },
      });
      expect(nights).toBe(4); // jamais de doublon malgré les deux appels

      const stayAfter = await prisma.stay.findUniqueOrThrow({
        where: { id: stay.id },
      });
      expect(stayAfter.dateCheckoutPrevue.toISOString().slice(0, 10)).toBe(
        nouvelleDate,
      );
    });

    it('Folios/paiements/factures historiques du séjour préservés après une prolongation', async () => {
      const folioId = stay.folios[0].id;
      await adminClient.post('/api/payments').send({
        folioId,
        moyen: 'ESPECES',
        montant: '100.00',
        idempotencyKey: `gl003-historique-${stay.id}-${Date.now()}`,
      });

      const linesBefore = await prisma.folioLine.findMany({
        where: { folioId },
        orderBy: { id: 'asc' },
      });

      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Prolongation avec historique de paiement préexistant',
        });
      expect(res.status).toBe(201);

      const linesAfter = await prisma.folioLine.findMany({
        where: { folioId, id: { in: linesBefore.map((l) => l.id) } },
        orderBy: { id: 'asc' },
      });
      expect(linesAfter.length).toBe(linesBefore.length);
      linesBefore.forEach((before, index) => {
        expect(linesAfter[index].montant.toString()).toBe(
          before.montant.toString(),
        );
        expect(linesAfter[index].type).toBe(before.type);
        expect(linesAfter[index].libelle).toBe(before.libelle);
      });
    });
  });
});
