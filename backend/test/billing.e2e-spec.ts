/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Prisma, StatutChambre, TypeLigneFolio } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

describe('Billing Module (5.13)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let client: ReturnType<typeof authedRequest>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    // CH-001 (docs/governance/REGISTRE_CHANTIERS.md) : ce fichier n'appliquait
    // pas encore le ValidationPipe global (contrairement à main.ts en
    // production et à auth.e2e-spec.ts) — nécessaire pour exercer réellement
    // la contrainte @MinLength(10) sur CreateCreditNoteDto.motif. Sans effet
    // sur les tests existants : AddFolioLineDto.montant est déjà envoyé sous
    // forme de chaîne décimale conforme (@IsDecimal), rien à transformer.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    const token = await loginAs(app.getHttpServer(), 'comptable');
    client = authedRequest(app.getHttpServer(), token);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Invoice generation with TaxRateConfig', () => {
    it('should generate invoice respecting current TaxRateConfig rates', async () => {
      // Créer un type de chambre, une chambre, un client et un séjour complet
      // avec folio et ligne HEBERGEMENT.
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-BILLING-TYPE-${ts}`,
          prixBase: new Prisma.Decimal(500),
          capacite: 2,
        },
      });

      const room = await prisma.room.create({
        data: {
          numero: `TEST-BILLING-${ts}-101`,
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      const guest = await prisma.guest.create({
        data: {
          nom: 'Dupont',
          prenom: 'Alice',
        },
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
        data: {
          stayId: stay.id,
          libelle: 'Folio principal',
        },
      });

      // Ajouter une ligne HEBERGEMENT de 500 MAD
      await prisma.folioLine.create({
        data: {
          folioId: folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(500),
          tauxTva: new Prisma.Decimal(0),
        },
      });

      // Vérifier que TaxRateConfig contient TVA_HEBERGEMENT = 10%
      const tvaConfig = await prisma.taxRateConfig.findFirst({
        where: { type: 'TVA_HEBERGEMENT' },
      });
      expect(tvaConfig).toBeDefined();
      expect(tvaConfig?.taux.toNumber()).toBe(10);

      // Générer la facture via POST /invoices/generer?folioId=...
      // (Note: le endpoint prend folioId en param, pas dans le body)
      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});

      expect(invoiceRes.status).toBe(201);
      expect(invoiceRes.body).toHaveProperty('id');
      expect(invoiceRes.body).toHaveProperty('numero');
      expect(invoiceRes.body.statut).toBe('EMISE');

      // Montant attendu : 500 + (500 * 10 / 100) = 550 MAD
      expect(Number(invoiceRes.body.montantTotal)).toBe(550);

      // Test de rigueur : modifier TaxRateConfig et régénérer (sur un autre folio)
      const folio2 = await prisma.folio.create({
        data: {
          stayId: stay.id,
          libelle: 'Folio extras',
        },
      });

      await prisma.folioLine.create({
        data: {
          folioId: folio2.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement supplémentaire',
          montant: new Prisma.Decimal(500),
        },
      });

      // Changer TVA_HEBERGEMENT à 15%
      await prisma.taxRateConfig.update({
        where: { id: tvaConfig!.id },
        data: { taux: new Prisma.Decimal(15) },
      });

      // Générer la deuxième facture
      const invoice2Res = await client
        .post(`/api/invoices/generer?folioId=${folio2.id}`)
        .send({});

      expect(invoice2Res.status).toBe(201);
      // Montant attendu avec 15% : 500 + (500 * 15 / 100) = 575 MAD
      expect(Number(invoice2Res.body.montantTotal)).toBe(575);

      // Nettoyer
      await prisma.invoice.deleteMany({ where: { folioId: folio.id } });
      await prisma.invoice.deleteMany({ where: { folioId: folio2.id } });
      await prisma.folioLine.deleteMany({ where: { folioId: folio.id } });
      await prisma.folioLine.deleteMany({ where: { folioId: folio2.id } });
      await prisma.folio.deleteMany({ where: { stayId: stay.id } });
      await prisma.roomNight.deleteMany({ where: { stayId: stay.id } });
      await prisma.stay.deleteMany({ where: { id: stay.id } });
      await prisma.room.deleteMany({ where: { id: room.id } });
      await prisma.roomType.deleteMany({ where: { id: roomType.id } });
      await prisma.guest.deleteMany({ where: { id: guest.id } });
      await prisma.taxRateConfig.update({
        where: { id: tvaConfig!.id },
        data: { taux: new Prisma.Decimal(10) },
      });
    });
  });

  // L'idempotence des paiements est désormais couverte par
  // test/payments.e2e-spec.ts (module payments, docs/modules/payments.md) —
  // POST /payments n'est plus servi par BillingController.

  describe('Add folio line', () => {
    it('should add a line to a folio for an active stay', async () => {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-BILLING-TYPE-3-${ts}`,
          prixBase: new Prisma.Decimal(500),
          capacite: 2,
        },
      });

      const room = await prisma.room.create({
        data: {
          numero: `TEST-BILLING-${ts}-103`,
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      const guest = await prisma.guest.create({
        data: {
          nom: 'Leclerc',
          prenom: 'Claire',
        },
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
        data: {
          stayId: stay.id,
          libelle: 'Folio principal',
        },
      });

      // Ajouter une ligne EXTRA via POST /folios/:id/lignes
      const addLineRes = await client
        .post(`/api/folios/${folio.id}/lignes`)
        .send({
          type: TypeLigneFolio.EXTRA,
          libelle: 'Room service',
          montant: '50.00',
        });

      expect(addLineRes.status).toBe(201);
      expect(addLineRes.body).toHaveProperty('id');
      expect(addLineRes.body.libelle).toBe('Room service');
      expect(Number(addLineRes.body.montant)).toBe(50);
      expect(addLineRes.body.type).toBe('EXTRA');

      // Nettoyer
      await prisma.folioLine.deleteMany({ where: { folioId: folio.id } });
      await prisma.folio.deleteMany({ where: { stayId: stay.id } });
      await prisma.roomNight.deleteMany({ where: { stayId: stay.id } });
      await prisma.stay.deleteMany({ where: { id: stay.id } });
      await prisma.room.deleteMany({ where: { id: room.id } });
      await prisma.roomType.deleteMany({ where: { id: roomType.id } });
      await prisma.guest.deleteMany({ where: { id: guest.id } });
    });
  });

  // CH-040 (BR-AUD-002, docs/modules/billing.md §5) — annulation contrôlée
  // d'une ligne de folio d'extras. Vraie base MySQL, pas de mock.
  describe('Annulation de ligne de folio — CH-040', () => {
    async function createStayWithFolio(labelSuffix: string) {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-CH040-TYPE-${labelSuffix}-${ts}`,
          prixBase: new Prisma.Decimal(500),
          capacite: 2,
        },
      });
      const room = await prisma.room.create({
        data: {
          numero: `TEST-CH040-${labelSuffix}-${ts}`,
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const guest = await prisma.guest.create({
        data: { nom: 'Berrada', prenom: 'Yasmine' },
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
      await prisma.invoice.deleteMany({ where: { folioId: ctx.folio.id } });
      await prisma.folioLine.deleteMany({ where: { folioId: ctx.folio.id } });
      await prisma.folio.deleteMany({ where: { stayId: ctx.stay.id } });
      await prisma.roomNight.deleteMany({ where: { stayId: ctx.stay.id } });
      await prisma.stay.deleteMany({ where: { id: ctx.stay.id } });
      await prisma.room.deleteMany({ where: { id: ctx.room.id } });
      await prisma.roomType.deleteMany({ where: { id: ctx.roomType.id } });
      await prisma.guest.deleteMany({ where: { id: ctx.guest.id } });
    }

    it('annule une ligne EXTRA — motif écrit dans FolioLine.motifAnnulation et journalisé dans AuditLog', async () => {
      const ctx = await createStayWithFolio('OK');
      const ligne = await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.EXTRA,
          libelle: 'Room service (erreur de saisie)',
          montant: new Prisma.Decimal(80),
        },
      });

      const res = await client
        .delete(`/api/folios/lignes/${ligne.id}`)
        .send({ motif: 'Erreur de saisie — annulée par le Comptable' });
      expect(res.status).toBe(200);
      expect(res.body.annulee).toBe(true);
      expect(res.body.motifAnnulation).toBe(
        'Erreur de saisie — annulée par le Comptable',
      );

      const logs = await prisma.auditLog.findMany({
        where: { targetEntity: 'FolioLine', targetId: ligne.id },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('CANCEL_FOLIO_LINE');

      await cleanup(ctx);
    });

    it('un motif < 10 caractères est rejeté (BR-AUD-002, 400)', async () => {
      const ctx = await createStayWithFolio('MOTIF');
      const ligne = await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.EXTRA,
          libelle: 'Extra test',
          montant: new Prisma.Decimal(20),
        },
      });

      const res = await client
        .delete(`/api/folios/lignes/${ligne.id}`)
        .send({ motif: 'court' });
      expect(res.status).toBe(400);

      await cleanup(ctx);
    });

    it('refuse l’annulation d’une ligne HEBERGEMENT (réservée aux lignes EXTRA)', async () => {
      const ctx = await createStayWithFolio('HEBERGEMENT');
      const ligne = await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(500),
        },
      });

      const res = await client
        .delete(`/api/folios/lignes/${ligne.id}`)
        .send({ motif: 'Tentative non autorisée test e2e' });
      expect(res.status).toBe(409);

      await cleanup(ctx);
    });

    it('refuse l’annulation d’une ligne déjà annulée (idempotence)', async () => {
      const ctx = await createStayWithFolio('DEJA');
      const ligne = await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.EXTRA,
          libelle: 'Extra déjà annulé',
          montant: new Prisma.Decimal(20),
          annulee: true,
          motifAnnulation: 'Déjà annulée précédemment',
        },
      });

      const res = await client
        .delete(`/api/folios/lignes/${ligne.id}`)
        .send({ motif: 'Nouvelle tentative test e2e' });
      expect(res.status).toBe(409);

      await cleanup(ctx);
    });

    it('un lineId inexistant renvoie 404', async () => {
      const res = await client
        .delete('/api/folios/lignes/999999')
        .send({ motif: 'Test 404 ligne inexistante' });
      expect(res.status).toBe(404);
    });

    it('la Réception (billing:read seul) ne peut pas annuler de ligne (403)', async () => {
      const ctx = await createStayWithFolio('RBAC');
      const ligne = await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.EXTRA,
          libelle: 'Extra test RBAC',
          montant: new Prisma.Decimal(20),
        },
      });

      const receptionToken = await loginAs(app.getHttpServer(), 'reception');
      const receptionClient = authedRequest(
        app.getHttpServer(),
        receptionToken,
      );
      const res = await receptionClient
        .delete(`/api/folios/lignes/${ligne.id}`)
        .send({ motif: 'Tentative non autorisée test e2e' });
      expect(res.status).toBe(403);

      await cleanup(ctx);
    });

    // Bug potentiel identifié par analogie avec le bug réel de CH-050
    // (« Add folio line — garde facture déjà émise » ci-dessus) : sans
    // cette garde, annuler une ligne EXTRA après émission de la facture
    // ferait disparaître son montant du solde dû (computeSoldeDu exclut les
    // lignes annulées) sans que la facture immuable déjà émise (INV-FAC-001)
    // ne le reflète jamais — écart silencieux entre le solde affiché et le
    // montant réellement facturé.
    it('refuse l’annulation d’une ligne une fois une facture active émise sur le folio', async () => {
      const ctx = await createStayWithFolio('FACTURE');
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(500),
        },
      });
      const ligneExtra = await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.EXTRA,
          libelle: 'Room service',
          montant: new Prisma.Decimal(50),
        },
      });

      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${ctx.folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);

      const res = await client
        .delete(`/api/folios/lignes/${ligneExtra.id}`)
        .send({ motif: 'Tentative annulation post-facturation e2e' });
      expect(res.status).toBe(409);

      await cleanup(ctx);
    });
  });

  // CH-001 (docs/governance/REGISTRE_CHANTIERS.md) — avoir total uniquement
  // (arbitrage confirmé). Vraie base MySQL, pas de mock.
  describe('Avoir total sur une facture (CreditNote) — CH-001', () => {
    it('rejette un motif trop court (< 10 caractères)', async () => {
      const res = await client
        .post('/api/invoices/999999/credit-notes')
        .send({ motif: 'court' });
      expect(res.status).toBe(400);
    });

    it('renvoie 404 pour une facture inexistante', async () => {
      const res = await client
        .post('/api/invoices/999999/credit-notes')
        .send({ motif: 'Motif valide de plus de dix caractères' });
      expect(res.status).toBe(404);
    });

    it('annule la facture sans toucher les FolioLine, bloque la double génération/le double avoir, et permet une régénération correcte sans doubler la taxe de séjour', async () => {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-BILLING-AVOIR-${ts}`,
          prixBase: new Prisma.Decimal(500),
          capacite: 2,
        },
      });
      const room = await prisma.room.create({
        data: {
          numero: `TEST-BILLING-AVOIR-${ts}-101`,
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const guest = await prisma.guest.create({
        data: { nom: 'Bernard', prenom: 'Marc' },
      });

      // 2 nuits, capacité 2 : taxe de séjour = 3 MAD x 2 x 2 = 12 MAD
      // (TaxRateConfig TAXE_SEJOUR, MONTANT_FIXE, taux=3, voir seed.ts) —
      // valeur non nulle nécessaire pour que le test de non-duplication
      // ci-dessous soit discriminant (un montant à 0 masquerait un doublon).
      const dateCheckin = new Date();
      const dateCheckoutPrevue = new Date(
        dateCheckin.getTime() + 2 * 24 * 60 * 60 * 1000,
      );
      const stay = await prisma.stay.create({
        data: {
          roomId: room.id,
          guestId: guest.id,
          dateCheckin,
          dateCheckoutPrevue,
        },
      });
      const folio = await prisma.folio.create({
        data: { stayId: stay.id, libelle: 'Folio principal' },
      });
      await prisma.folioLine.create({
        data: {
          folioId: folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 2 nuits',
          montant: new Prisma.Decimal(500),
        },
      });

      // Génération initiale : HEBERGEMENT (500) + TVA 10% (50) + taxe de
      // séjour (12) = 562.
      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      expect(Number(invoiceRes.body.montantTotal)).toBe(562);
      const invoiceId = invoiceRes.body.id as number;

      const nbLignesTaxeApresGeneration = await prisma.folioLine.count({
        where: { folioId: folio.id, type: TypeLigneFolio.TAXE_SEJOUR },
      });
      expect(nbLignesTaxeApresGeneration).toBe(1);

      // Une facture ACTIVE bloque toute nouvelle génération sur ce folio.
      const doubleGenRes = await client
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});
      expect(doubleGenRes.status).toBe(409);

      // Avoir total.
      const creditNoteRes = await client
        .post(`/api/invoices/${invoiceId}/credit-notes`)
        .send({
          motif: 'Erreur de saisie sur le montant, correction nécessaire',
        });
      expect(creditNoteRes.status).toBe(201);
      expect(Number(creditNoteRes.body.montant)).toBe(562);
      expect(creditNoteRes.body.invoiceId).toBe(invoiceId);

      // La facture d'origine reste immuable : montantTotal/numero inchangés
      // (ADR-004), seul le statut change.
      const invoiceApresAvoir = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
      });
      expect(invoiceApresAvoir.statut).toBe('ANNULEE_PAR_AVOIR');
      expect(Number(invoiceApresAvoir.montantTotal)).toBe(562);
      expect(invoiceApresAvoir.numero).toBe(
        (invoiceRes.body as { numero: string }).numero,
      );

      // Un deuxième avoir sur la même facture est refusé.
      const doubleAvoirRes = await client
        .post(`/api/invoices/${invoiceId}/credit-notes`)
        .send({ motif: 'Deuxième tentative qui doit échouer' });
      expect(doubleAvoirRes.status).toBe(409);

      // Preuve de rigueur sabotage/restore : sans la garde ajoutée dans
      // generateInvoice() (ne jamais réinjecter TAXE_SEJOUR si déjà
      // matérialisée sur le folio), cette régénération aurait doublé la
      // taxe de séjour (574 au lieu de 562, et 2 lignes TAXE_SEJOUR au lieu
      // d'1) — vérifié en retirant temporairement la garde pendant le
      // développement : le test échouait alors bien avec ces valeurs
      // doublées, confirmant qu'il est discriminant.
      const invoiceCorrigeeRes = await client
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});
      expect(invoiceCorrigeeRes.status).toBe(201);
      expect(Number(invoiceCorrigeeRes.body.montantTotal)).toBe(562);

      const nbLignesTaxeApresRegeneration = await prisma.folioLine.count({
        where: { folioId: folio.id, type: TypeLigneFolio.TAXE_SEJOUR },
      });
      expect(nbLignesTaxeApresRegeneration).toBe(1);

      // Nettoyer.
      await prisma.creditNote.deleteMany({ where: { invoiceId } });
      await prisma.invoice.deleteMany({ where: { folioId: folio.id } });
      await prisma.folioLine.deleteMany({ where: { folioId: folio.id } });
      await prisma.folio.deleteMany({ where: { stayId: stay.id } });
      await prisma.roomNight.deleteMany({ where: { stayId: stay.id } });
      await prisma.stay.deleteMany({ where: { id: stay.id } });
      await prisma.room.deleteMany({ where: { id: room.id } });
      await prisma.roomType.deleteMany({ where: { id: roomType.id } });
      await prisma.guest.deleteMany({ where: { id: guest.id } });
    });
  });

  // CH-050 (docs/execution/PLAN_MODULE_FACTURATION.md) — bug réel identifié
  // en câblant l'UI d'ajout de charge : addFolioLine ne vérifiait jamais si
  // une facture EMISE existait déjà, une charge ajoutée après coup ne
  // pouvait donc jamais y apparaître silencieusement.
  describe('Add folio line — garde facture déjà émise (CH-050)', () => {
    it('rejette l’ajout d’une ligne une fois une facture active émise sur le folio', async () => {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-BILLING-GUARD-${ts}`,
          prixBase: new Prisma.Decimal(500),
          capacite: 2,
        },
      });
      const room = await prisma.room.create({
        data: {
          numero: `TEST-BILLING-GUARD-${ts}-101`,
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const guest = await prisma.guest.create({
        data: { nom: 'Fassi', prenom: 'Omar' },
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
      await prisma.folioLine.create({
        data: {
          folioId: folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(500),
        },
      });

      // Avant facturation : l'ajout d'une charge fonctionne normalement.
      const addBefore = await client
        .post(`/api/folios/${folio.id}/lignes`)
        .send({
          type: TypeLigneFolio.EXTRA,
          libelle: 'Petit-déjeuner supplémentaire',
          montant: '30.00',
        });
      expect(addBefore.status).toBe(201);

      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      const invoiceId = invoiceRes.body.id as number;

      // Preuve de rigueur sabotage/restore : sans la garde ajoutée dans
      // addFolioLine (vérification des factures EMISE), cet appel aurait
      // renvoyé 201 et créé une ligne qui n'apparaîtrait jamais sur la
      // facture déjà émise — vérifié en retirant temporairement la garde
      // pendant le développement, le test échouait bien alors (201 au lieu
      // du 409 attendu), confirmant qu'il est discriminant.
      const addAfter = await client
        .post(`/api/folios/${folio.id}/lignes`)
        .send({
          type: TypeLigneFolio.EXTRA,
          libelle: 'Café restaurant (ne devrait jamais être créé)',
          montant: '25.00',
        });
      expect(addAfter.status).toBe(409);

      const nbLignes = await prisma.folioLine.count({
        where: { folioId: folio.id },
      });
      // HEBERGEMENT + EXTRA (avant facturation) + TAXE_SEJOUR (matérialisée
      // automatiquement par generateInvoice(), même à 0 MAD sur un séjour
      // de 0 nuit ici — voir computeTaxLineAmount) = 3, jamais 4 (le rejet
      // ci-dessus ne doit ajouter aucune ligne).
      expect(nbLignes).toBe(3);

      // Nettoyer.
      await prisma.invoice.deleteMany({ where: { id: invoiceId } });
      await prisma.folioLine.deleteMany({ where: { folioId: folio.id } });
      await prisma.folio.deleteMany({ where: { stayId: stay.id } });
      await prisma.roomNight.deleteMany({ where: { stayId: stay.id } });
      await prisma.stay.deleteMany({ where: { id: stay.id } });
      await prisma.room.deleteMany({ where: { id: room.id } });
      await prisma.roomType.deleteMany({ where: { id: roomType.id } });
      await prisma.guest.deleteMany({ where: { id: guest.id } });
    });
  });

  // CH-050 (docs/execution/PLAN_MODULE_FACTURATION.md) — génération PDF réelle.
  describe('Invoice PDF (CH-050)', () => {
    it('renvoie un vrai flux PDF avec le bon Content-Type', async () => {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-BILLING-PDF-${ts}`,
          prixBase: new Prisma.Decimal(500),
          capacite: 2,
        },
      });
      const room = await prisma.room.create({
        data: {
          numero: `TEST-BILLING-PDF-${ts}-101`,
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const guest = await prisma.guest.create({
        data: { nom: 'Tazi', prenom: 'Salma', email: 'salma@example.com' },
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
      await prisma.folioLine.create({
        data: {
          folioId: folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(500),
        },
      });
      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      const invoiceId = invoiceRes.body.id as number;

      const pdfRes = await client
        .get(`/api/invoices/${invoiceId}/pdf`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toContain('application/pdf');
      const body = pdfRes.body as Buffer;
      expect(body.subarray(0, 5).toString('ascii')).toBe('%PDF-');

      // Nettoyer.
      await prisma.invoice.deleteMany({ where: { id: invoiceId } });
      await prisma.folioLine.deleteMany({ where: { folioId: folio.id } });
      await prisma.folio.deleteMany({ where: { stayId: stay.id } });
      await prisma.roomNight.deleteMany({ where: { stayId: stay.id } });
      await prisma.stay.deleteMany({ where: { id: stay.id } });
      await prisma.room.deleteMany({ where: { id: room.id } });
      await prisma.roomType.deleteMany({ where: { id: roomType.id } });
      await prisma.guest.deleteMany({ where: { id: guest.id } });
    });
  });

  // CH-050 suite (docs/execution/PLAN_MODULE_FACTURATION.md) — diffusion de
  // facture. L'envoi réel (SMTP/Twilio simulés faute de credentials en
  // dev/CI) passe par une file BullMQ asynchrone — ce test vérifie la
  // partie synchrone et déterministe : la demande crée bien un
  // NotificationLog par canal configuré (FACTURE_EMISE, EMAIL + WHATSAPP
  // vus au seed) et un jeton de téléchargement fonctionnel, sans dépendre
  // du timing du worker.
  describe('Diffusion de facture (CH-050 suite)', () => {
    it('POST /invoices/:id/envoyer crée un NotificationLog par canal et un lien de téléchargement réel', async () => {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-BILLING-ENVOI-${ts}`,
          prixBase: new Prisma.Decimal(500),
          capacite: 2,
        },
      });
      const room = await prisma.room.create({
        data: {
          numero: `TEST-BILLING-ENVOI-${ts}-101`,
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const guest = await prisma.guest.create({
        data: {
          nom: 'Idrissi',
          prenom: 'Sanae',
          email: 'sanae@example.com',
          telephone: '+212600000000',
        },
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
      await prisma.folioLine.create({
        data: {
          folioId: folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(500),
        },
      });
      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      const invoiceId = invoiceRes.body.id as number;

      const envoyerRes = await client
        .post(`/api/invoices/${invoiceId}/envoyer`)
        .send({});
      expect(envoyerRes.status).toBe(201);

      // Un NotificationLog par canal configuré pour FACTURE_EMISE au seed
      // (EMAIL + WHATSAPP) — preuve que le listener a bien tourné avant que
      // le contrôleur ne réponde (emitAsync).
      const logs = await prisma.notificationLog.findMany({
        where: { guestId: guest.id, evenement: 'FACTURE_EMISE' },
      });
      expect(logs).toHaveLength(2);
      const canaux = logs.map((l) => l.canal).sort();
      expect(canaux).toEqual(['EMAIL', 'WHATSAPP']);
      expect(logs.find((l) => l.canal === 'EMAIL')?.destinataire).toBe(
        'sanae@example.com',
      );
      expect(logs.find((l) => l.canal === 'WHATSAPP')?.destinataire).toBe(
        '+212600000000',
      );

      // Un jeton de téléchargement a bien été créé, résolvable en vrai PDF
      // via la route publique (sans authentification).
      const token = await prisma.invoiceDownloadToken.findFirstOrThrow({
        where: { invoiceId },
      });
      const downloadRes = await client
        .get(`/api/invoices/download/${token.token}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });
      expect(downloadRes.status).toBe(200);
      const body = downloadRes.body as Buffer;
      expect(body.subarray(0, 5).toString('ascii')).toBe('%PDF-');

      // Preuve de rigueur sabotage/restore : un jeton inconnu doit être
      // rejeté (404), vérifié en modifiant temporairement une lettre du
      // jeton réel pendant le développement — le test échouait alors avec
      // un 200 (le service ne validait rien) au lieu du 404 attendu.
      const badTokenRes = await client.get(
        `/api/invoices/download/${token.token.slice(0, -1)}X`,
      );
      expect(badTokenRes.status).toBe(404);

      // Nettoyer.
      await prisma.invoiceDownloadToken.deleteMany({ where: { invoiceId } });
      await prisma.notificationLog.deleteMany({ where: { guestId: guest.id } });
      await prisma.invoice.deleteMany({ where: { id: invoiceId } });
      await prisma.folioLine.deleteMany({ where: { folioId: folio.id } });
      await prisma.folio.deleteMany({ where: { stayId: stay.id } });
      await prisma.roomNight.deleteMany({ where: { stayId: stay.id } });
      await prisma.stay.deleteMany({ where: { id: stay.id } });
      await prisma.room.deleteMany({ where: { id: room.id } });
      await prisma.roomType.deleteMany({ where: { id: roomType.id } });
      await prisma.guest.deleteMany({ where: { id: guest.id } });
    });
  });
});
