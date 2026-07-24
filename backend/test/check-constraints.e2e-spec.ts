import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  Prisma,
  StatutChambre,
  TypeLigneFolio,
  TypeSegment,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// CH-025 (docs/governance/REGISTRE_CHANTIERS.md) : contraintes CHECK MySQL
// ajoutées en défense en profondeur, en plus des validations applicatives
// déjà existantes (ReservationsService.assertDateRangeValid, etc.). Ces
// tests écrivent directement via PrismaService, en contournant délibérément
// la couche service/DTO — l'objectif est de prouver que la BASE elle-même
// rejette ces valeurs, indépendamment de toute validation applicative
// (qui est déjà couverte par d'autres suites e2e). Vrais appels contre une
// vraie base MySQL, aucun mock.
describe('Contraintes CHECK — défense en profondeur (CH-025, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Reservation.dateDepart > dateArrivee', () => {
    it('rejette une écriture Prisma directe avec dateDepart <= dateArrivee', async () => {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-CHK-RES-TYPE-${ts}`,
          prixBase: new Prisma.Decimal(300),
          capacite: 2,
        },
      });
      const room = await prisma.room.create({
        data: { numero: `TEST-CHK-RES-${ts}`, roomTypeId: roomType.id },
      });
      const guest = await prisma.guest.create({
        data: { nom: 'CheckConstraint', prenom: 'Reservation' },
      });
      const memeJour = new Date('2027-01-10');

      await expect(
        prisma.reservation.create({
          data: {
            guestId: guest.id,
            roomId: room.id,
            dateArrivee: memeJour,
            dateDepart: memeJour, // égale à l'arrivée — doit être rejeté
          },
        }),
      ).rejects.toThrow();

      // Restore : une plage valide (dateDepart > dateArrivee) est bien
      // acceptée — la contrainte ne bloque pas le cas légitime.
      const reservation = await prisma.reservation.create({
        data: {
          guestId: guest.id,
          roomId: room.id,
          dateArrivee: new Date('2027-01-10'),
          dateDepart: new Date('2027-01-11'),
        },
      });
      expect(reservation.id).toBeDefined();

      await prisma.roomNight.deleteMany({ where: { roomId: room.id } });
      await prisma.reservation.deleteMany({ where: { roomId: room.id } });
      await prisma.room.deleteMany({ where: { id: room.id } });
      await prisma.roomType.deleteMany({ where: { id: roomType.id } });
      await prisma.guest.deleteMany({ where: { id: guest.id } });
    });
  });

  describe('Payment.montant > 0', () => {
    async function createFolio(label: string) {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-CHK-PAY-TYPE-${label}-${ts}`,
          prixBase: new Prisma.Decimal(300),
          capacite: 2,
        },
      });
      const room = await prisma.room.create({
        data: {
          numero: `TEST-CHK-PAY-${label}-${ts}`,
          roomTypeId: roomType.id,
          statut: StatutChambre.OCCUPEE,
        },
      });
      const guest = await prisma.guest.create({
        data: { nom: 'CheckConstraint', prenom: label },
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

    it('rejette une écriture Prisma directe avec montant nul ou négatif', async () => {
      const ctx = await createFolio('montant');

      await expect(
        prisma.payment.create({
          data: {
            folioId: ctx.folio.id,
            moyen: 'ESPECES',
            montant: new Prisma.Decimal(0),
            idempotencyKey: `chk-payment-zero-${Date.now()}`,
          },
        }),
      ).rejects.toThrow();

      await expect(
        prisma.payment.create({
          data: {
            folioId: ctx.folio.id,
            moyen: 'ESPECES',
            montant: new Prisma.Decimal(-50),
            idempotencyKey: `chk-payment-neg-${Date.now()}`,
          },
        }),
      ).rejects.toThrow();

      // Restore : un montant positif reste accepté.
      const payment = await prisma.payment.create({
        data: {
          folioId: ctx.folio.id,
          moyen: 'ESPECES',
          montant: new Prisma.Decimal(50),
          idempotencyKey: `chk-payment-ok-${Date.now()}`,
        },
      });
      expect(payment.id).toBeDefined();

      await cleanup(ctx);
    });

    it('rejette une écriture Prisma directe de FolioLine à montant négatif, quel que soit le type, mais accepte un montant nul', async () => {
      const ctx = await createFolio('folioline');

      await expect(
        prisma.folioLine.create({
          data: {
            folioId: ctx.folio.id,
            type: TypeLigneFolio.PAIEMENT,
            libelle: 'Paiement invalide (négatif)',
            montant: new Prisma.Decimal(-100),
          },
        }),
      ).rejects.toThrow();

      // Restore : le comportement réel du code (computeSoldeDu) stocke même
      // les lignes PAIEMENT en positif — c'est le type qui pilote la
      // soustraction, jamais le signe stocké.
      const ligne = await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.PAIEMENT,
          libelle: 'Paiement valide',
          montant: new Prisma.Decimal(100),
        },
      });
      expect(ligne.id).toBeDefined();

      // `>= 0` et non `> 0` (contrairement à Payment.montant ci-dessus) :
      // un montant nul est un cas réel rencontré en écrivant CH-025
      // (billing.e2e-spec.ts — ligne TAXE_SEJOUR calculée sur 0 nuit
      // facturable) — la contrainte ne doit pas le rejeter.
      const ligneNulle = await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.TAXE_SEJOUR,
          libelle: 'Taxe de séjour nulle (cas limite légitime)',
          montant: new Prisma.Decimal(0),
        },
      });
      expect(ligneNulle.id).toBeDefined();

      await cleanup(ctx);
    });
  });

  describe('TimeShiftSegment.fin >= debut (ou fin NULL)', () => {
    it('rejette une écriture Prisma directe avec fin antérieure à debut, accepte fin NULL', async () => {
      const ts = Date.now();
      const role = await prisma.role.findFirstOrThrow();
      const motDePasseHash = await bcrypt.hash('Password123!', 10);
      const user = await prisma.user.create({
        data: {
          nom: 'CheckConstraint Segment',
          email: `chk-segment-${ts}@makarim.test`,
          motDePasseHash,
          roleId: role.id,
        },
      });
      const employee = await prisma.employee.create({
        data: {
          userId: user.id,
          salaireBase: new Prisma.Decimal(3000),
          dateEmbauche: new Date(),
        },
      });
      const timeShift = await prisma.timeShift.create({
        data: { employeeId: employee.id },
      });
      const debut = new Date('2027-01-10T09:00:00Z');
      const finAnterieure = new Date('2027-01-10T08:00:00Z');

      await expect(
        prisma.timeShiftSegment.create({
          data: {
            timeShiftId: timeShift.id,
            type: TypeSegment.TRAVAIL,
            debut,
            fin: finAnterieure,
          },
        }),
      ).rejects.toThrow();

      // Restore : fin NULL (segment en cours, cas normal ADR-007) reste
      // accepté, tout comme fin >= debut.
      const segmentEnCours = await prisma.timeShiftSegment.create({
        data: { timeShiftId: timeShift.id, type: TypeSegment.TRAVAIL, debut },
      });
      expect(segmentEnCours.fin).toBeNull();

      const segmentClos = await prisma.timeShiftSegment.create({
        data: {
          timeShiftId: timeShift.id,
          type: TypeSegment.TRAVAIL,
          debut,
          fin: new Date('2027-01-10T17:00:00Z'),
        },
      });
      expect(segmentClos.id).toBeDefined();

      await prisma.timeShiftSegment.deleteMany({
        where: { timeShiftId: timeShift.id },
      });
      await prisma.timeShift.deleteMany({ where: { id: timeShift.id } });
      await prisma.employee.deleteMany({ where: { id: employee.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    });
  });
});
