import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';
import {
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

interface DepositResponse {
  payment: { id: number; montant: string } | null;
  montantEncaisse: string;
  message?: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

// GL-003B — Avance de prolongation bornée côté serveur
// (POST /stays/:id/extension-deposit). Remplace le flux historique où la
// réception encaissait volontairement plus que le solde courant via
// POST /payments brut, devenu incompatible avec la garde OVERPAYMENT de
// PAY-001B (PaymentsService.createPayment). Les 3 scénarios historiques
// migrés depuis stay-extend.e2e-spec.ts (paiement séparé puis retry, course
// concurrente extend/annulation, reliquat conservé) restent dans ce fichier
// — ce fichier-ci couvre uniquement les scénarios propres au nouvel
// endpoint, jamais mélangés à payments.e2e-spec.ts (scénario critique
// PAY-001B, 1700/750/950/1500).
describe('Stay - Extension Deposit (GL-003B)', () => {
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
        forbidNonWhitelisted: true,
        whitelist: true,
        transform: true,
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

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-GL003B-${suffix}`,
        prixBase: 100,
        capacite: 2,
      },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    await prisma.roomNight.deleteMany({
      where: { room: { roomTypeId } },
    });
    await prisma.folioLine.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.payment.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.folio.deleteMany({
      where: { stay: { room: { roomTypeId } } },
    });
    await prisma.stay.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.housekeepingTaskLog.deleteMany({
      where: { task: { room: { roomTypeId } } },
    });
    await prisma.housekeepingTask.deleteMany({
      where: { room: { roomTypeId } },
    });
    await prisma.roomStatusLog.deleteMany({
      where: { room: { roomTypeId } },
    });
    await prisma.room.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  describe('POST /stays/:id/extension-deposit', () => {
    let room: { id: number };
    let guest: { id: number };
    let stay: StayResponse;
    let today: Date;

    beforeEach(async () => {
      today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

      room = await prisma.room.create({
        data: {
          numero: `GL003B-${suffix}`,
          roomTypeId,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      guest = await prisma.guest.create({
        data: {
          nom: 'Deposit',
          prenom: 'Test',
          email: `gl003b-${suffix}@example.com`,
          telephone: '+212600000003',
          nationalite: 'MA',
          pieceIdentite: `GL003B${suffix}`,
          categorie: 'STANDARD',
        },
      });

      const walkinRes = await adminClient.post('/api/checkin/walk-in').send({
        roomId: room.id,
        dateCheckoutPrevue: isoDate(addDays(today, 2)),
        guestId: guest.id,
        nombreOccupants: 2,
        formule: FormuleHebergement.ROOM_ONLY,
      });
      expect(walkinRes.status).toBe(201);
      stay = walkinRes.body as StayResponse;
      expect(stay.statut).toBe(StatutSejour.EN_COURS);
    });

    afterEach(async () => {
      await prisma.payment.deleteMany({
        where: { folio: { stayId: stay.id } },
      });
      await prisma.folioLine.deleteMany({
        where: { folio: { stayId: stay.id } },
      });
      await prisma.folio.deleteMany({ where: { stayId: stay.id } });
      await prisma.roomNight.deleteMany({ where: { stayId: stay.id } });
      await prisma.stay.deleteMany({ where: { id: stay.id } });
      await prisma.guest.deleteMany({ where: { id: guest.id } });
      await prisma.housekeepingTaskLog.deleteMany({
        where: { task: { roomId: room.id } },
      });
      await prisma.housekeepingTask.deleteMany({
        where: { roomId: room.id },
      });
      await prisma.roomStatusLog.deleteMany({ where: { roomId: room.id } });
      await prisma.room.deleteMany({ where: { id: room.id } });
      await prisma.hotelConfig.updateMany({
        data: { paiementImmediatProlongationObligatoire: false },
      });
    });

    it('RBAC combiné : stay:extend sans payments:write (Réception) → 403, aucune écriture', async () => {
      const res = await receptionClient
        .post(`/api/stays/${stay.id}/extension-deposit`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          moyen: 'ESPECES',
          idempotencyKey: `gl003b-rbac-${stay.id}-${Date.now()}`,
        });
      expect(res.status).toBe(403);

      const payments = await prisma.payment.count({
        where: { folio: { stayId: stay.id } },
      });
      expect(payments).toBe(0);
      const lines = await prisma.folioLine.count({
        where: { folio: { stayId: stay.id }, type: TypeLigneFolio.PAIEMENT },
      });
      expect(lines).toBe(0);
    });

    it('Calcul : solde dû 200 + supplément 200 → avance serveur = 400', async () => {
      const res = await adminClient
        .post(`/api/stays/${stay.id}/extension-deposit`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          moyen: 'ESPECES',
          idempotencyKey: `gl003b-calc1-${stay.id}-${Date.now()}`,
        });
      expect(res.status).toBe(201);
      const body = res.body as DepositResponse;
      expect(body.montantEncaisse).toBe('400.00');
      expect(body.payment).not.toBeNull();
    });

    it('Calcul : crédit existant 100 (solde déjà négatif) + supplément 200 → avance = 100', async () => {
      // Solde 0 d'abord (règlement exact des 200 dus), puis 100 de crédit
      // supplémentaire — les deux via POST /payments, chaque montant reste
      // ≤ solde courant à l'instant de l'appel (jamais un OVERPAYMENT,
      // PAY-001B respectée).
      const folioId = stay.folios[0].id;
      const pay1 = await comptableClient.post('/api/payments').send({
        folioId,
        moyen: 'ESPECES',
        montant: '200.00',
        idempotencyKey: `gl003b-calc2-pay1-${stay.id}-${Date.now()}`,
      });
      expect(pay1.status).toBe(201);

      // Solde désormais 0 : un deuxième règlement serait refusé
      // (PAYMENT_NOT_REQUIRED). Le crédit de 100 ne peut donc être constitué
      // que via un mécanisme distinct de POST /payments — ici on simule
      // directement une ligne PAIEMENT supplémentaire (même précédent que
      // GL-003J plus haut, qui reproduit directement l'écriture SQL qu'une
      // opération métier ferait), pour isoler strictement le calcul de
      // computeExtensionPricing/createExtensionDeposit du reste du système.
      await prisma.folioLine.create({
        data: {
          folioId,
          type: TypeLigneFolio.PAIEMENT,
          libelle: 'Crédit additionnel (fixture test)',
          montant: 100,
        },
      });

      const res = await adminClient
        .post(`/api/stays/${stay.id}/extension-deposit`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          moyen: 'ESPECES',
          idempotencyKey: `gl003b-calc2-${stay.id}-${Date.now()}`,
        });
      expect(res.status).toBe(201);
      expect((res.body as DepositResponse).montantEncaisse).toBe('100.00');
    });

    it('Crédit déjà suffisant → montantAEncaisser = 0, aucun encaissement créé', async () => {
      const folioId = stay.folios[0].id;
      // Règle exactement le solde dû (200) puis ajoute 200 de crédit
      // supplémentaire (même fixture directe que le test précédent) pour
      // couvrir déjà tout le supplément à venir.
      const pay = await comptableClient.post('/api/payments').send({
        folioId,
        moyen: 'ESPECES',
        montant: '200.00',
        idempotencyKey: `gl003b-suffisant-pay-${stay.id}-${Date.now()}`,
      });
      expect(pay.status).toBe(201);
      await prisma.folioLine.create({
        data: {
          folioId,
          type: TypeLigneFolio.PAIEMENT,
          libelle: 'Crédit additionnel (fixture test)',
          montant: 200,
        },
      });

      const res = await adminClient
        .post(`/api/stays/${stay.id}/extension-deposit`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          moyen: 'ESPECES',
          idempotencyKey: `gl003b-suffisant-${stay.id}-${Date.now()}`,
        });
      expect(res.status).toBe(201);
      const body = res.body as DepositResponse;
      expect(body.montantEncaisse).toBe('0.00');
      expect(body.payment).toBeNull();

      const payments = await prisma.payment.count({
        where: { folio: { stayId: stay.id } },
      });
      // Seuls les deux paiements déjà encaissés ci-dessus (aucun troisième
      // créé par extension-deposit).
      expect(payments).toBe(1);
    });

    it('Montant arbitraire impossible : un champ `montant` supplémentaire dans le payload est rejeté (400)', async () => {
      const res = await adminClient
        .post(`/api/stays/${stay.id}/extension-deposit`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          moyen: 'ESPECES',
          idempotencyKey: `gl003b-forbidden-${stay.id}-${Date.now()}`,
          montant: '1.00',
        });
      expect(res.status).toBe(400);

      const payments = await prisma.payment.count({
        where: { folio: { stayId: stay.id } },
      });
      expect(payments).toBe(0);
    });

    it('Idempotence : rejeu de la même idempotencyKey → même résultat, pas de double avance', async () => {
      const idempotencyKey = `gl003b-idempotent-${stay.id}-${Date.now()}`;
      const res1 = await adminClient
        .post(`/api/stays/${stay.id}/extension-deposit`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          moyen: 'ESPECES',
          idempotencyKey,
        });
      expect(res1.status).toBe(201);
      const body1 = res1.body as DepositResponse;

      const res2 = await adminClient
        .post(`/api/stays/${stay.id}/extension-deposit`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          moyen: 'ESPECES',
          idempotencyKey,
        });
      expect(res2.status).toBe(201);
      const body2 = res2.body as DepositResponse;

      expect(body2.payment?.id).toBe(body1.payment?.id);
      expect(body2.montantEncaisse).toBe(body1.montantEncaisse);

      const payments = await prisma.payment.count({
        where: { folio: { stayId: stay.id } },
      });
      expect(payments).toBe(1);
    });

    it('Prolongation après avance : solde final ramené à 0', async () => {
      const depositRes = await adminClient
        .post(`/api/stays/${stay.id}/extension-deposit`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          moyen: 'ESPECES',
          idempotencyKey: `gl003b-full-${stay.id}-${Date.now()}`,
        });
      expect(depositRes.status).toBe(201);

      await prisma.hotelConfig.updateMany({
        data: { paiementImmediatProlongationObligatoire: true },
      });
      const extendRes = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Prolongation après avance GL-003B',
        });
      expect(extendRes.status).toBe(201);
      await prisma.hotelConfig.updateMany({
        data: { paiementImmediatProlongationObligatoire: false },
      });

      const folioId = stay.folios[0].id;
      const lignes = await prisma.folioLine.findMany({ where: { folioId } });
      const paiements = lignes
        .filter((l) => l.type === TypeLigneFolio.PAIEMENT)
        .reduce((sum, l) => sum + Number(l.montant), 0);
      const charges = lignes
        .filter((l) => l.type !== TypeLigneFolio.PAIEMENT && !l.annulee)
        .reduce((sum, l) => sum + Number(l.montant), 0);
      expect(paiements - charges).toBeCloseTo(0);
    });

    it('Échec de la prolongation après avance (chambre indisponible) : le crédit encaissé est conservé, jamais remboursé automatiquement', async () => {
      const depositRes = await adminClient
        .post(`/api/stays/${stay.id}/extension-deposit`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          moyen: 'ESPECES',
          idempotencyKey: `gl003b-fail-${stay.id}-${Date.now()}`,
        });
      expect(depositRes.status).toBe(201);
      const depositBody = depositRes.body as DepositResponse;
      expect(depositBody.payment).not.toBeNull();

      // Chambre rendue indisponible après l'avance (comportement historique
      // déjà testé pour GL-003, voir stay-extend.e2e-spec.ts) — l'avance a
      // déjà été encaissée avant de le savoir.
      await prisma.room.update({
        where: { id: room.id },
        data: { statut: StatutChambre.EN_MAINTENANCE },
      });

      const extendRes = await receptionClient
        .post(`/api/stays/${stay.id}/extend`)
        .send({
          nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
          motif: 'Tentative de prolongation après avance, chambre indisponible',
        });
      expect(extendRes.status).toBe(409);

      // Le crédit encaissé reste présent — même comportement historique
      // documenté pour GL-003 (aucun remboursement automatique, geste
      // humain de la réception/comptabilité hors périmètre de ce calcul,
      // même politique que BR-RES-006/ReservationDeposit).
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: depositBody.payment!.id },
      });
      expect(payment.deletedAt).toBeNull();
      const paymentLine = await prisma.folioLine.findFirst({
        where: {
          folioId: stay.folios[0].id,
          type: TypeLigneFolio.PAIEMENT,
          annulee: false,
        },
      });
      expect(paymentLine).not.toBeNull();
    });

    // Deux avances concurrentes sur le MÊME séjour, mêmes date/montant
    // visés, mais des idempotencyKey DIFFÉRENTES (deux clics accidentels
    // avec des UUID générés séparément côté client) — l'idempotencyKey seule
    // ne protège jamais contre ce cas, seul un verrou explicite le peut.
    // Comportement attendu et vérifié : les deux transactions sont
    // sérialisées — la première à committer encaisse l'avance complète
    // (400 = 200 dû + 200 supplément), la seconde, une fois le verrou
    // relâché, relit un solde déjà couvert par la première (200 dû − 400
    // payé = crédit 200, contre un supplément de 200) et n'encaisse donc
    // rien de plus (montantEncaisse = '0.00') — jamais deux avances
    // complètes.
    //
    // Preuve de rigueur sabotage/restore (CLAUDE.md), DEUX verrous testés
    // séparément pour identifier lequel est réellement discriminant sur CE
    // scénario précis (même Stay, deux appels concurrents) :
    //   1. Le verrou explicite Folio/FolioLine de computeExtensionPricing
    //      (stay.service.ts, étape 5, partagé avec runExtendStayTransaction
    //      / GL-003J) a été temporairement retiré (FOR UPDATE supprimé sur
    //      les deux requêtes) et ce test relancé isolément 5 fois de suite.
    //      Résultat surprenant mais logique une fois expliqué : le test
    //      reste vert à chaque fois — NON discriminant pour ce scénario
    //      précis. Raison : le verrou Stay de l'étape 2 (voir point 2
    //      ci-dessous) sérialise déjà les deux transactions ; comme la
    //      lecture du Folio (SELECT simple, sans FOR UPDATE une fois
    //      sabotée) n'établit son instantané REPEATABLE READ qu'à cet
    //      instant précis (aucune lecture non verrouillée n'a eu lieu plus
    //      tôt dans la transaction), la seconde transaction — qui ne
    //      commence à s'exécuter qu'après le commit de la première, verrou
    //      Stay oblige — voit déjà les données à jour même sans son propre
    //      verrou Folio. Ce verrou Folio/FolioLine reste nécessaire pour
    //      l'AUTRE course (GL-003J, extend concurrent à l'annulation d'un
    //      paiement existant, restant testée séparément dans
    //      stay-extend.e2e-spec.ts) mais n'est pas le verrou qui protège
    //      spécifiquement CE scénario-ci. Restauré à l'identique après
    //      constat (aucun code de sabotage laissé actif).
    //   2. Le verrou Stay de computeExtensionPricing (stay.service.ts,
    //      étape 2, `SELECT ... FOR UPDATE` sur la ligne Stay) a ensuite été
    //      temporairement retiré à son tour (FOR UPDATE supprimé) et ce
    //      test relancé isolément 5 fois de suite. Résultat : le test
    //      échoue de façon stable à chaque exécution (`totalEncaisse`
    //      largement supérieur à 400, les deux transactions liraient/
    //      calculeraient concurremment sans jamais attendre l'une l'autre)
    //      — discriminant confirmé, c'est bien CE verrou qui protège ce
    //      scénario précis. Restauré à l'identique et ce test revérifié
    //      vert de façon stable sur plusieurs exécutions consécutives ;
    //      aucun code de sabotage n'est laissé actif dans ce fichier ni
    //      dans stay.service.ts.
    it('Deux avances concurrentes (idempotencyKey différentes) sur le même séjour : une seule avance complète', async () => {
      const nouvelleDate = isoDate(addDays(today, 4));
      const [res1, res2] = await Promise.all([
        adminClient.post(`/api/stays/${stay.id}/extension-deposit`).send({
          nouvelleDateCheckoutPrevue: nouvelleDate,
          moyen: 'ESPECES',
          idempotencyKey: `gl003b-concurrent-1-${stay.id}-${Date.now()}`,
        }),
        adminClient.post(`/api/stays/${stay.id}/extension-deposit`).send({
          nouvelleDateCheckoutPrevue: nouvelleDate,
          moyen: 'ESPECES',
          idempotencyKey: `gl003b-concurrent-2-${stay.id}-${Date.now()}`,
        }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      const body1 = res1.body as DepositResponse;
      const body2 = res2.body as DepositResponse;

      const montants = [
        Number(body1.montantEncaisse),
        Number(body2.montantEncaisse),
      ].sort((a, b) => a - b);
      // L'une des deux avances est complète (400), l'autre constate un
      // crédit déjà suffisant (0) — jamais deux avances complètes (800).
      expect(montants).toEqual([0, 400]);

      const payments = await prisma.payment.count({
        where: { folio: { stayId: stay.id } },
      });
      expect(payments).toBe(1);

      const totalEncaisse = montants[0] + montants[1];
      expect(totalEncaisse).toBeCloseTo(400);
    });
  });
});
