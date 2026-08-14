/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Prisma, StatutChambre, TypeLigneFolio } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { computeSoldeDu } from '../src/modules/stay/utils/solde';
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

      // ADR-008/FIN-101B : la ligne HEBERGEMENT (500) est déjà TTC — plus de
      // majoration TVA au moment de la facturation. Montant attendu : 500.
      expect(Number(invoiceRes.body.montantTotal)).toBe(500);

      // Test de rigueur (ADR-008/FIN-101B) : changer TVA_HEBERGEMENT en
      // cours de route et régénérer (sur un autre folio) — le total facturé
      // ne doit plus bouger avec le taux, puisque le montant est déjà TTC et
      // que la TVA n'est plus qu'une ventilation informative, jamais une
      // majoration du total.
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
      // Montant attendu : toujours 500 — le taux TVA n'affecte plus jamais
      // le total de facture (ADR-008 §4.4, INV-FIN-003).
      expect(Number(invoice2Res.body.montantTotal)).toBe(500);

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

  // UX-001B — synthèse de solde exposée sur GET /folios/:id
  // (totalChargesTTC/totalPaidTTC/balanceTTC), consommée par
  // RecordPaymentDialog côté frontend pour ne plus recalculer de solde en
  // JS. balanceTTC doit rester égal à computeSoldeDu([folio]).
  describe('GET /folios/:id — synthèse de solde (UX-001B)', () => {
    it('expose totalChargesTTC/totalPaidTTC/balanceTTC cohérents avec computeSoldeDu', async () => {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-BILLING-SOLDE-${ts}`,
          prixBase: new Prisma.Decimal(500),
          capacite: 2,
        },
      });

      const room = await prisma.room.create({
        data: {
          numero: `TEST-BILLING-SOLDE-${ts}`,
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      const guest = await prisma.guest.create({
        data: { nom: 'Benali', prenom: 'Yasmine' },
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
          montant: new Prisma.Decimal(1200),
        },
      });
      await prisma.folioLine.create({
        data: {
          folioId: folio.id,
          type: TypeLigneFolio.EXTRA,
          libelle: 'Room service',
          montant: new Prisma.Decimal(80),
        },
      });
      // Ligne annulée : ne doit compter dans aucun des trois totaux.
      await prisma.folioLine.create({
        data: {
          folioId: folio.id,
          type: TypeLigneFolio.EXTRA,
          libelle: 'Extra annulé',
          montant: new Prisma.Decimal(500),
          annulee: true,
          motifAnnulation: 'Erreur de saisie corrigée avant paiement',
        },
      });
      await prisma.folioLine.create({
        data: {
          folioId: folio.id,
          type: TypeLigneFolio.PAIEMENT,
          libelle: 'Acompte espèces',
          montant: new Prisma.Decimal(700),
        },
      });

      const res = await client.get(`/api/folios/${folio.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('synthese');
      expect(Number(res.body.synthese.totalChargesTTC)).toBe(1280);
      expect(Number(res.body.synthese.totalPaidTTC)).toBe(700);
      expect(Number(res.body.synthese.balanceTTC)).toBe(580);

      // Preuve de non-duplication : balanceTTC == computeSoldeDu([folio])
      // recalculé à partir des mêmes lignes brutes renvoyées par l'API.
      const lignesBrutes = res.body.lignes as Array<{
        type: TypeLigneFolio;
        montant: string;
        annulee: boolean;
      }>;
      const recomputed = computeSoldeDu([
        {
          lignes: lignesBrutes.map((l) => ({
            type: l.type,
            montant: new Prisma.Decimal(l.montant),
            annulee: l.annulee,
          })),
        },
      ]);
      expect(Number(res.body.synthese.balanceTTC)).toBe(recomputed.toNumber());

      // Nettoyer
      await prisma.folioLine.deleteMany({ where: { folioId: folio.id } });
      await prisma.folio.deleteMany({ where: { stayId: stay.id } });
      await prisma.roomNight.deleteMany({ where: { stayId: stay.id } });
      await prisma.stay.deleteMany({ where: { id: stay.id } });
      await prisma.room.deleteMany({ where: { id: room.id } });
      await prisma.roomType.deleteMany({ where: { id: roomType.id } });
      await prisma.guest.deleteMany({ where: { id: guest.id } });
    });

    it('solde entièrement soldé : balanceTTC à 0, pas négatif', async () => {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-BILLING-SOLDE0-${ts}`,
          prixBase: new Prisma.Decimal(500),
          capacite: 2,
        },
      });

      const room = await prisma.room.create({
        data: {
          numero: `TEST-BILLING-SOLDE0-${ts}`,
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
          montant: new Prisma.Decimal(1000),
        },
      });
      await prisma.folioLine.create({
        data: {
          folioId: folio.id,
          type: TypeLigneFolio.PAIEMENT,
          libelle: 'Paiement carte',
          montant: new Prisma.Decimal(1000),
        },
      });

      const res = await client.get(`/api/folios/${folio.id}`);

      expect(res.status).toBe(200);
      expect(Number(res.body.synthese.balanceTTC)).toBe(0);
      const balanceTTC = res.body.synthese.balanceTTC as string;
      expect(balanceTTC.startsWith('-')).toBe(false);

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

      // Génération initiale (ADR-008/FIN-101B — plus de majoration TVA) :
      // HEBERGEMENT (500, déjà TTC) + taxe de séjour (12) = 512.
      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      expect(Number(invoiceRes.body.montantTotal)).toBe(512);
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
      expect(Number(creditNoteRes.body.montant)).toBe(512);
      expect(creditNoteRes.body.invoiceId).toBe(invoiceId);

      // La facture d'origine reste immuable : montantTotal/numero inchangés
      // (ADR-004), seul le statut change.
      const invoiceApresAvoir = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
      });
      expect(invoiceApresAvoir.statut).toBe('ANNULEE_PAR_AVOIR');
      expect(Number(invoiceApresAvoir.montantTotal)).toBe(512);
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
      // taxe de séjour (524 au lieu de 512, et 2 lignes TAXE_SEJOUR au lieu
      // d'1) — vérifié en retirant temporairement la garde pendant le
      // développement : le test échouait alors bien avec ces valeurs
      // doublées, confirmant qu'il est discriminant.
      const invoiceCorrigeeRes = await client
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});
      expect(invoiceCorrigeeRes.status).toBe(201);
      expect(Number(invoiceCorrigeeRes.body.montantTotal)).toBe(512);

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

  // FIN-101B (ADR-008) — moteur de calcul financier TTC : plus de
  // majoration TVA au-dessus des montants déjà TTC, couverture de
  // RESTAURANT, exclusion explicite des lignes PAIEMENT du total facturé.
  describe('Moteur de calcul financier TTC (ADR-008 / FIN-101B)', () => {
    async function createStayWithFolio(labelSuffix: string) {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-FIN101B-TYPE-${labelSuffix}-${ts}`,
          prixBase: new Prisma.Decimal(500),
          capacite: 2,
        },
      });
      const room = await prisma.room.create({
        data: {
          numero: `TEST-FIN101B-${labelSuffix}-${ts}`,
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const guest = await prisma.guest.create({
        data: { nom: 'Alaoui', prenom: 'Nadia' },
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
      await prisma.creditNote.deleteMany({
        where: { invoice: { folioId: ctx.folio.id } },
      });
      await prisma.invoice.deleteMany({ where: { folioId: ctx.folio.id } });
      await prisma.folioLine.deleteMany({ where: { folioId: ctx.folio.id } });
      await prisma.folio.deleteMany({ where: { stayId: ctx.stay.id } });
      await prisma.roomNight.deleteMany({ where: { stayId: ctx.stay.id } });
      await prisma.stay.deleteMany({ where: { id: ctx.stay.id } });
      await prisma.room.deleteMany({ where: { id: ctx.room.id } });
      await prisma.roomType.deleteMany({ where: { id: ctx.roomType.id } });
      await prisma.guest.deleteMany({ where: { id: ctx.guest.id } });
    }

    it('restaurant inclus dans une facture, sans majoration (couverture RESTAURANT)', async () => {
      const ctx = await createStayWithFolio('RESTO');
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(500),
        },
      });
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.RESTAURANT,
          libelle: 'Note restaurant',
          montant: new Prisma.Decimal(14),
        },
      });

      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${ctx.folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      // HEBERGEMENT (500) + RESTAURANT (14), aucune TVA ajoutée = 514.
      expect(Number(invoiceRes.body.montantTotal)).toBe(514);

      await cleanup(ctx);
    });

    it('un paiement partiel enregistré AVANT génération de facture est exclu du montantTotal (POST /payments)', async () => {
      const ctx = await createStayWithFolio('PAIEMENT');
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(500),
        },
      });

      const paymentRes = await client.post('/api/payments').send({
        folioId: ctx.folio.id,
        moyen: 'ESPECES',
        montant: '200.00',
        idempotencyKey: `test-fin101b-partiel-${Date.now()}`,
      });
      expect(paymentRes.status).toBe(201);

      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${ctx.folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      // Le paiement de 200 (ligne PAIEMENT créditrice) ne doit ni s'ajouter
      // ni se soustraire au total facturé — il est simplement ignoré
      // (bug corrigé : avant FIN-101B, PAIEMENT n'était couvert par aucune
      // branche de calculateInvoiceTotal et était additionné tel quel).
      expect(Number(invoiceRes.body.montantTotal)).toBe(500);

      await cleanup(ctx);
    });

    it('un acompte déjà imputé sur le folio (ligne PAIEMENT créditrice) est exclu du montantTotal', async () => {
      const ctx = await createStayWithFolio('ACOMPTE');
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(500),
        },
      });
      // Simule l'état laissé par StayService.imputerAcomptes (crédite une
      // ligne PAIEMENT dès le check-in, avant toute génération de facture)
      // sans dépendre du flux complet réservation + dépôt + check-in.
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.PAIEMENT,
          libelle: 'Acompte imputé au check-in',
          montant: new Prisma.Decimal(150),
        },
      });

      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${ctx.folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      expect(Number(invoiceRes.body.montantTotal)).toBe(500);

      await cleanup(ctx);
    });

    // Revue architecturale FIN-101B (point 1) : computeSoldeDu() ne voit
    // TAXE_SEJOUR qu'après que generateInvoice() l'a matérialisée en
    // FolioLine — avant cet instant, le solde ne reflète que les charges
    // déjà écrites (HEBERGEMENT/EXTRA), pas la taxe de séjour qui sera
    // ajoutée à la facturation. Ce test démontre donc UNIQUEMENT la
    // convergence solde/facture APRÈS matérialisation — il ne prétend pas
    // démontrer INV-FIN-001 (ADR-008) à tout instant du cycle de vie du
    // folio. Le moment de matérialisation de TAXE_SEJOUR (aujourd'hui :
    // à la facturation, pas au check-in) reste un écart connu, hors
    // périmètre de FIN-101B, à traiter dans une mission tarifaire dédiée
    // (FIN-102A — composition du tarif public TTC).
    it('convergence solde/facture APRÈS matérialisation de TAXE_SEJOUR (pas avant)', async () => {
      const ctx = await createStayWithFolio('COHERENCE');
      // createStayWithFolio() crée dateCheckin === dateCheckoutPrevue (même
      // instant) — sans effet pour les autres tests de ce bloc, mais
      // getNightsBetween() renverrait alors 0 nuit ici, et
      // computeTaxLineAmount() (mode MONTANT_FIXE, taux × nights ×
      // personnes) matérialiserait TAXE_SEJOUR à 0 MAD au lieu de 12 — le
      // solde ne bougerait jamais et ce test échouerait pour une mauvaise
      // raison (donnée de test insuffisante), pas une régression FIN-101B.
      await prisma.stay.update({
        where: { id: ctx.stay.id },
        data: {
          dateCheckoutPrevue: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(500),
        },
      });
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.EXTRA,
          libelle: 'Room service',
          montant: new Prisma.Decimal(50),
        },
      });

      // AVANT generateInvoice() : computeSoldeDu() réelle (aucune formule
      // recopiée), appelée sur les lignes réellement en base à cet instant
      // — HEBERGEMENT + EXTRA uniquement, aucune TAXE_SEJOUR.
      const lignesAvant = await prisma.folioLine.findMany({
        where: { folioId: ctx.folio.id, annulee: false },
      });
      const soldeAvant = computeSoldeDu([{ lignes: lignesAvant }]);
      expect(soldeAvant.toNumber()).toBe(550);

      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${ctx.folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);

      // APRÈS generateInvoice() : relecture réelle des FolioLine (inclut
      // désormais TAXE_SEJOUR, matérialisée par generateInvoice) et nouvel
      // appel à computeSoldeDu() réelle sur cet état à jour.
      const lignesApres = await prisma.folioLine.findMany({
        where: { folioId: ctx.folio.id, annulee: false },
      });
      const soldeApres = computeSoldeDu([{ lignes: lignesApres }]);

      const ligneTaxeSejour = lignesApres.find(
        (l) => l.type === TypeLigneFolio.TAXE_SEJOUR,
      );
      expect(ligneTaxeSejour).toBeDefined();

      // La convergence n'existe qu'à partir de cet instant, pas avant.
      expect(soldeApres.toNumber()).not.toBe(soldeAvant.toNumber());
      expect(soldeApres.toNumber()).toBe(Number(invoiceRes.body.montantTotal));

      await cleanup(ctx);
    });

    it('facture émise reste immuable (montantTotal/numero inchangés après un avoir)', async () => {
      const ctx = await createStayWithFolio('IMMUABLE');
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(500),
        },
      });

      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${ctx.folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      const invoiceId = invoiceRes.body.id as number;
      const numeroOriginal = invoiceRes.body.numero as string;
      expect(Number(invoiceRes.body.montantTotal)).toBe(500);

      const creditNoteRes = await client
        .post(`/api/invoices/${invoiceId}/credit-notes`)
        .send({ motif: 'Avoir de contrôle immuabilité FIN-101B' });
      expect(creditNoteRes.status).toBe(201);

      const invoiceApresAvoir = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
      });
      expect(Number(invoiceApresAvoir.montantTotal)).toBe(500);
      expect(invoiceApresAvoir.numero).toBe(numeroOriginal);
      expect(invoiceApresAvoir.statut).toBe('ANNULEE_PAR_AVOIR');

      await cleanup(ctx);
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

  // DESIGN-009B.1 — cohérence Folio ↔ Solde ↔ Facture pour les lignes
  // AJUSTEMENT_HAUSSE/AJUSTEMENT_BAISSE (changement de chambre, GL-002).
  // Cause exacte du gap corrigé : calculateInvoiceTotal (invoice-calc.ts)
  // ne reconnaissait aucune branche pour ces deux types — ils traversaient
  // la boucle sans jamais être ni ajoutés ni soustraits (catégorie B,
  // « ignorés »), alors que computeSoldeDu (stay/utils/solde.ts) les
  // traitait déjà correctement depuis DESIGN-009B.
  describe('DESIGN-009B.1 — Facturation des ajustements de changement de chambre', () => {
    let receptionClient: ReturnType<typeof authedRequest>;
    let adminClient: ReturnType<typeof authedRequest>;

    beforeAll(async () => {
      const receptionToken = await loginAs(app.getHttpServer(), 'reception');
      receptionClient = authedRequest(app.getHttpServer(), receptionToken);
      const adminToken = await loginAs(app.getHttpServer(), 'admin');
      adminClient = authedRequest(app.getHttpServer(), adminToken);
    });

    // Folio manuel (sans check-in réel) pour les scénarios isolés (1, 8, 9,
    // 10, 11) — même précédent exact que createStayWithFolio ci-dessus
    // (« Moteur de calcul financier TTC »), nights=0 (dateCheckin ===
    // dateCheckoutPrevue) pour ne jamais matérialiser TAXE_SEJOUR (legacy
    // sans occupation) et polluer les montants attendus.
    async function createManualFolio(labelSuffix: string) {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-009B1-TYPE-${labelSuffix}-${ts}`,
          prixBase: new Prisma.Decimal(400),
          capacite: 2,
        },
      });
      const room = await prisma.room.create({
        data: {
          numero: `TEST-009B1-${labelSuffix}-${ts}`,
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const guest = await prisma.guest.create({
        data: { nom: 'Berrada', prenom: 'Younes' },
      });
      const now = new Date();
      const stay = await prisma.stay.create({
        data: {
          roomId: room.id,
          guestId: guest.id,
          dateCheckin: now,
          dateCheckoutPrevue: now,
        },
      });
      const folio = await prisma.folio.create({
        data: { stayId: stay.id, libelle: 'Folio principal' },
      });
      return { roomType, room, guest, stay, folio };
    }

    async function cleanupManualFolio(ctx: {
      roomType: { id: number };
      room: { id: number };
      guest: { id: number };
      stay: { id: number };
      folio: { id: number };
    }) {
      await prisma.payment.deleteMany({ where: { folioId: ctx.folio.id } });
      await prisma.invoice.deleteMany({ where: { folioId: ctx.folio.id } });
      await prisma.folioLine.deleteMany({ where: { folioId: ctx.folio.id } });
      await prisma.folio.deleteMany({ where: { stayId: ctx.stay.id } });
      await prisma.roomNight.deleteMany({ where: { stayId: ctx.stay.id } });
      await prisma.stay.deleteMany({ where: { id: ctx.stay.id } });
      await prisma.room.deleteMany({ where: { id: ctx.room.id } });
      await prisma.roomType.deleteMany({ where: { id: ctx.roomType.id } });
      await prisma.guest.deleteMany({ where: { id: ctx.guest.id } });
    }

    // Séjour réel (check-in walk-in ROOM_ONLY, dates fixées à aujourd'hui →
    // aujourd'hui+3j, formule ROOM_ONLY pour isoler la seule composante
    // HEBERGEMENT) sur lequel un vrai changement de chambre HTTP est
    // exercé — pour les scénarios end-to-end (2, 3, 4, 5, 6, 7, 12, 13).
    // Aucune taxe de séjour matérialisée : nombreOccupants renseigné
    // (checkin non-legacy) mais aucun TaxRateConfig actif requis par ces
    // tests — laissé tel quel (comportement seed réel), les montants
    // attendus sont calculés depuis les vraies FolioLine relues en base,
    // jamais recalculés à la main ici (contrairement aux tests dédiés de
    // stay-change-room.e2e-spec.ts qui, eux, pinnent les montants).
    async function createRealStay(labelSuffix: string, prixBase: number) {
      const ts = Date.now();
      const roomType = await prisma.roomType.create({
        data: {
          nom: `TEST-009B1-REAL-${labelSuffix}-${ts}`,
          prixBase: new Prisma.Decimal(prixBase),
          capacite: 2,
        },
      });
      const room = await prisma.room.create({
        data: {
          numero: `TEST-009B1-REAL-${labelSuffix}-${ts}`,
          roomTypeId: roomType.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const guest = await prisma.guest.create({
        data: { nom: 'Chraibi', prenom: 'Salma' },
      });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateDepart = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      const reservationRes = await receptionClient
        .post('/api/reservations')
        .send({
          roomId: room.id,
          guestId: guest.id,
          dateArrivee: today.toISOString().slice(0, 10),
          dateDepart: dateDepart.toISOString().slice(0, 10),
          formule: 'ROOM_ONLY',
        });
      const checkinRes = await adminClient
        .post(`/api/checkin/${(reservationRes.body as { id: number }).id}`)
        .send({ nombreOccupants: 1 });
      const stay = checkinRes.body as { id: number; roomId: number };
      return { roomType, room, guest, stay };
    }

    async function previewFingerprint(stayId: number, newRoomId: number) {
      const res = await receptionClient
        .post(`/api/stays/${stayId}/change-room/preview`)
        .send({ newRoomId });
      return (res.body as { pricingFingerprint: string }).pricingFingerprint;
    }

    async function cleanupRealStay(ctx: {
      roomType: { id: number };
      room: { id: number };
      guest: { id: number };
      stay: { id: number };
    }) {
      await prisma.payment.deleteMany({
        where: { folio: { stayId: ctx.stay.id } },
      });
      await prisma.invoice.deleteMany({
        where: { folio: { stayId: ctx.stay.id } },
      });
      await prisma.folioLine.deleteMany({
        where: { folio: { stayId: ctx.stay.id } },
      });
      await prisma.folio.deleteMany({ where: { stayId: ctx.stay.id } });
      await prisma.housekeepingTaskLog.deleteMany({
        where: { task: { room: { roomTypeId: ctx.roomType.id } } },
      });
      await prisma.housekeepingTask.deleteMany({
        where: { room: { roomTypeId: ctx.roomType.id } },
      });
      await prisma.roomStatusLog.deleteMany({
        where: { room: { roomTypeId: ctx.roomType.id } },
      });
      await prisma.auditLog.deleteMany({
        where: { targetEntity: 'Stay', targetId: ctx.stay.id },
      });
      await prisma.roomNight.deleteMany({
        where: { room: { roomTypeId: ctx.roomType.id } },
      });
      await prisma.stay.deleteMany({ where: { id: ctx.stay.id } });
      await prisma.reservation.deleteMany({
        where: { room: { roomTypeId: ctx.roomType.id } },
      });
      await prisma.room.deleteMany({ where: { roomTypeId: ctx.roomType.id } });
      await prisma.roomType.deleteMany({ where: { id: ctx.roomType.id } });
      await prisma.guest.deleteMany({ where: { id: ctx.guest.id } });
    }

    it('1. Facture sans changement de chambre : comportement inchangé', async () => {
      const ctx = await createManualFolio('SANS-CHANGEMENT');
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(400),
        },
      });
      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${ctx.folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      expect(Number(invoiceRes.body.montantTotal)).toBe(400);
      await cleanupManualFolio(ctx);
    });

    it('2/4. Hausse (400→500, 3 nuits) puis génération de facture : le montant augmente exactement de la différence, aucun double comptage', async () => {
      const ctxA = await createRealStay('HAUSSE-A', 400);
      const roomB = await prisma.room.create({
        data: {
          numero: `TEST-009B1-HAUSSE-B-${Date.now()}`,
          roomTypeId: (
            await prisma.roomType.create({
              data: {
                nom: `TEST-009B1-HAUSSE-TYPEB-${Date.now()}`,
                prixBase: new Prisma.Decimal(500),
                capacite: 2,
              },
            })
          ).id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      const foliosAvant = await prisma.folio.findMany({
        where: { stayId: ctxA.stay.id },
        include: { lignes: true },
      });
      // Somme de TOUTES les lignes déjà présentes (HEBERGEMENT + éventuelle
      // TAXE_SEJOUR déjà matérialisée au check-in — nombreOccupants est
      // renseigné, non-legacy) : jamais juste HEBERGEMENT seul, sinon la
      // taxe de séjour active du seed fausserait la comparaison.
      const hebergementAvant = foliosAvant[0].lignes.reduce(
        (acc, l) => acc.add(l.montant),
        new Prisma.Decimal(0),
      );

      const fingerprint = await previewFingerprint(ctxA.stay.id, roomB.id);
      const changeRes = await receptionClient
        .post(`/api/stays/${ctxA.stay.id}/change-room`)
        .send({
          newRoomId: roomB.id,
          motif: 'Test facturation hausse 400->500',
          pricingFingerprint: fingerprint,
        });
      expect(changeRes.status).toBe(201);

      const ligneAjustement = await prisma.folioLine.findFirstOrThrow({
        where: { folio: { stayId: ctxA.stay.id }, type: 'AJUSTEMENT_HAUSSE' },
      });

      const folio = await prisma.folio.findFirstOrThrow({
        where: { stayId: ctxA.stay.id },
      });
      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      const montantAttendu =
        Number(hebergementAvant) + Number(ligneAjustement.montant);
      expect(Number(invoiceRes.body.montantTotal)).toBe(montantAttendu);

      // Aucun double comptage : une seule ligne AJUSTEMENT_HAUSSE existe,
      // et elle n'apparaît qu'une fois dans la somme (vérifié en relisant
      // le folio et en recalculant manuellement avec calculateInvoiceTotal
      // via le solde, qui doit converger avec la facture).
      const lignesApresFacture = await prisma.folioLine.findMany({
        where: { folio: { stayId: ctxA.stay.id } },
      });
      const nbAjustements = lignesApresFacture.filter(
        (l) => l.type === 'AJUSTEMENT_HAUSSE',
      ).length;
      expect(nbAjustements).toBe(1);

      // 13. Cohérence Folio/Solde/Facture sur le même scénario.
      const foliosApres = await prisma.folio.findMany({
        where: { stayId: ctxA.stay.id },
        include: { lignes: true },
      });
      const soldeCalcule = computeSoldeDu(foliosApres);
      expect(soldeCalcule.toNumber()).toBe(montantAttendu);

      await cleanupRealStay(ctxA);
      await prisma.housekeepingTaskLog.deleteMany({
        where: { task: { roomId: roomB.id } },
      });
      await prisma.housekeepingTask.deleteMany({
        where: { roomId: roomB.id },
      });
      await prisma.roomStatusLog.deleteMany({ where: { roomId: roomB.id } });
      await prisma.room.deleteMany({ where: { id: roomB.id } });
      await prisma.roomType.deleteMany({ where: { id: roomB.roomTypeId } });
    });

    it('3/5. Baisse (500→400, 3 nuits) puis génération de facture : le montant diminue exactement de la différence, aucun double comptage', async () => {
      const ctxA = await createRealStay('BAISSE-A', 500);
      const typeBasique = await prisma.roomType.create({
        data: {
          nom: `TEST-009B1-BAISSE-TYPEB-${Date.now()}`,
          prixBase: new Prisma.Decimal(400),
          capacite: 2,
        },
      });
      const roomB = await prisma.room.create({
        data: {
          numero: `TEST-009B1-BAISSE-B-${Date.now()}`,
          roomTypeId: typeBasique.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      const foliosAvant = await prisma.folio.findMany({
        where: { stayId: ctxA.stay.id },
        include: { lignes: true },
      });
      // Somme de TOUTES les lignes déjà présentes (HEBERGEMENT + éventuelle
      // TAXE_SEJOUR déjà matérialisée au check-in — nombreOccupants est
      // renseigné, non-legacy) : jamais juste HEBERGEMENT seul, sinon la
      // taxe de séjour active du seed fausserait la comparaison.
      const hebergementAvant = foliosAvant[0].lignes.reduce(
        (acc, l) => acc.add(l.montant),
        new Prisma.Decimal(0),
      );

      const fingerprint = await previewFingerprint(ctxA.stay.id, roomB.id);
      const changeRes = await receptionClient
        .post(`/api/stays/${ctxA.stay.id}/change-room`)
        .send({
          newRoomId: roomB.id,
          motif: 'Test facturation baisse 500->400',
          pricingFingerprint: fingerprint,
        });
      expect(changeRes.status).toBe(201);

      const ligneAjustement = await prisma.folioLine.findFirstOrThrow({
        where: { folio: { stayId: ctxA.stay.id }, type: 'AJUSTEMENT_BAISSE' },
      });

      const folio = await prisma.folio.findFirstOrThrow({
        where: { stayId: ctxA.stay.id },
      });
      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      const montantAttendu =
        Number(hebergementAvant) - Number(ligneAjustement.montant);
      expect(Number(invoiceRes.body.montantTotal)).toBe(montantAttendu);

      const lignesApresFacture = await prisma.folioLine.findMany({
        where: { folio: { stayId: ctxA.stay.id } },
      });
      expect(
        lignesApresFacture.filter((l) => l.type === 'AJUSTEMENT_BAISSE').length,
      ).toBe(1);

      const foliosApres = await prisma.folio.findMany({
        where: { stayId: ctxA.stay.id },
        include: { lignes: true },
      });
      const soldeCalcule = computeSoldeDu(foliosApres);
      expect(soldeCalcule.toNumber()).toBe(montantAttendu);

      await cleanupRealStay(ctxA);
      await prisma.housekeepingTaskLog.deleteMany({
        where: { task: { roomId: roomB.id } },
      });
      await prisma.housekeepingTask.deleteMany({
        where: { roomId: roomB.id },
      });
      await prisma.roomStatusLog.deleteMany({ where: { roomId: roomB.id } });
      await prisma.room.deleteMany({ where: { id: roomB.id } });
      await prisma.roomType.deleteMany({ where: { id: typeBasique.id } });
    });

    it('6. Changement sans différence tarifaire : aucune ligne artificielle, facture inchangée', async () => {
      // Désactive temporairement TAXE_SEJOUR (restaurée en fin de test) :
      // un « même tarif » authentiquement neutre exige qu'aucune autre
      // composante (le carve-out fiscal FIN-102, voir la formule §3 du
      // rapport de conception DESIGN-009B) ne crée un écart artificiel
      // entre ancienMontantRestant (net de taxe, folio) et
      // nouveauMontantRestant (brut catalogue) — comportement déjà
      // documenté et volontaire, non modifié ici, seulement neutralisé le
      // temps de ce scénario isolé pour tester la « vraie » neutralité
      // tarifaire. Aucune règle fiscale n'est changée (juste actif=false).
      const taxRate = await prisma.taxRateConfig.findFirstOrThrow({
        where: { type: 'TAXE_SEJOUR', actif: true },
      });
      await prisma.taxRateConfig.update({
        where: { id: taxRate.id },
        data: { actif: false },
      });

      const ctxA = await createRealStay('NEUTRE-A', 400);
      const typeIdentique = await prisma.roomType.create({
        data: {
          nom: `TEST-009B1-NEUTRE-TYPEB-${Date.now()}`,
          prixBase: new Prisma.Decimal(400),
          capacite: 2,
        },
      });
      const roomB = await prisma.room.create({
        data: {
          numero: `TEST-009B1-NEUTRE-B-${Date.now()}`,
          roomTypeId: typeIdentique.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      const foliosAvant = await prisma.folio.findMany({
        where: { stayId: ctxA.stay.id },
        include: { lignes: true },
      });
      const montantAvant = Number(
        foliosAvant[0].lignes.find((l) => l.type === 'HEBERGEMENT')!.montant,
      );

      const fingerprint = await previewFingerprint(ctxA.stay.id, roomB.id);
      const changeRes = await receptionClient
        .post(`/api/stays/${ctxA.stay.id}/change-room`)
        .send({
          newRoomId: roomB.id,
          motif: 'Test facturation même tarif',
          pricingFingerprint: fingerprint,
        });
      expect(changeRes.status).toBe(201);

      const lignesApres = await prisma.folioLine.findMany({
        where: { folio: { stayId: ctxA.stay.id } },
      });
      expect(
        lignesApres.some(
          (l) =>
            l.type === 'AJUSTEMENT_HAUSSE' || l.type === 'AJUSTEMENT_BAISSE',
        ),
      ).toBe(false);

      const folio = await prisma.folio.findFirstOrThrow({
        where: { stayId: ctxA.stay.id },
      });
      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      expect(Number(invoiceRes.body.montantTotal)).toBe(montantAvant);

      await cleanupRealStay(ctxA);
      await prisma.housekeepingTaskLog.deleteMany({
        where: { task: { roomId: roomB.id } },
      });
      await prisma.housekeepingTask.deleteMany({
        where: { roomId: roomB.id },
      });
      await prisma.roomStatusLog.deleteMany({ where: { roomId: roomB.id } });
      await prisma.room.deleteMany({ where: { id: roomB.id } });
      await prisma.roomType.deleteMany({ where: { id: typeIdentique.id } });
      await prisma.taxRateConfig.update({
        where: { id: taxRate.id },
        data: { actif: true },
      });
    });

    it('7. Second changement de chambre : chaque ajustement réel apparaît exactement une fois dans la facture', async () => {
      const ctxA = await createRealStay('DOUBLE-A', 400);
      const typeB = await prisma.roomType.create({
        data: {
          nom: `TEST-009B1-DOUBLE-TYPEB-${Date.now()}`,
          prixBase: new Prisma.Decimal(500),
          capacite: 2,
        },
      });
      const roomB = await prisma.room.create({
        data: {
          numero: `TEST-009B1-DOUBLE-B-${Date.now()}`,
          roomTypeId: typeB.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });
      const typeC = await prisma.roomType.create({
        data: {
          nom: `TEST-009B1-DOUBLE-TYPEC-${Date.now()}`,
          prixBase: new Prisma.Decimal(300),
          capacite: 2,
        },
      });
      const roomC = await prisma.room.create({
        data: {
          numero: `TEST-009B1-DOUBLE-C-${Date.now()}`,
          roomTypeId: typeC.id,
          statut: StatutChambre.LIBRE_PROPRE,
        },
      });

      const fingerprint1 = await previewFingerprint(ctxA.stay.id, roomB.id);
      const change1 = await receptionClient
        .post(`/api/stays/${ctxA.stay.id}/change-room`)
        .send({
          newRoomId: roomB.id,
          motif: 'Premier changement 400->500',
          pricingFingerprint: fingerprint1,
        });
      expect(change1.status).toBe(201);

      const fingerprint2 = await previewFingerprint(ctxA.stay.id, roomC.id);
      const change2 = await receptionClient
        .post(`/api/stays/${ctxA.stay.id}/change-room`)
        .send({
          newRoomId: roomC.id,
          motif: 'Second changement 500->300',
          pricingFingerprint: fingerprint2,
        });
      expect(change2.status).toBe(201);

      const lignesAjustement = await prisma.folioLine.findMany({
        where: {
          folio: { stayId: ctxA.stay.id },
          type: { in: ['AJUSTEMENT_HAUSSE', 'AJUSTEMENT_BAISSE'] },
        },
      });
      expect(lignesAjustement.length).toBe(2);

      const foliosAvant = await prisma.folio.findMany({
        where: { stayId: ctxA.stay.id },
        include: { lignes: true },
      });
      const soldeAttendu = computeSoldeDu(foliosAvant);

      const folio = await prisma.folio.findFirstOrThrow({
        where: { stayId: ctxA.stay.id },
      });
      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      expect(Number(invoiceRes.body.montantTotal)).toBe(
        soldeAttendu.toNumber(),
      );

      await cleanupRealStay(ctxA);
      // roomB/roomC ont reçu la tâche housekeeping/le log de statut créés
      // par changeRoom (ancienne chambre → A_NETTOYER) — à nettoyer avant
      // de supprimer les chambres elles-mêmes (contrainte FK), même
      // précédent que cleanupRealStay pour ctxA.room.
      await prisma.housekeepingTaskLog.deleteMany({
        where: { task: { roomId: { in: [roomB.id, roomC.id] } } },
      });
      await prisma.housekeepingTask.deleteMany({
        where: { roomId: { in: [roomB.id, roomC.id] } },
      });
      await prisma.roomStatusLog.deleteMany({
        where: { roomId: { in: [roomB.id, roomC.id] } },
      });
      await prisma.room.deleteMany({
        where: { id: { in: [roomB.id, roomC.id] } },
      });
      await prisma.roomType.deleteMany({
        where: { id: { in: [typeB.id, typeC.id] } },
      });
    });

    it('8. Paiement partiel existant : intact après ajout d’un ajustement et génération de facture', async () => {
      const ctx = await createManualFolio('PAIEMENT-PARTIEL');
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(1191),
        },
      });
      const paiement = await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.PAIEMENT,
          libelle: 'Acompte reçu',
          montant: new Prisma.Decimal(500),
        },
      });
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.AJUSTEMENT_HAUSSE,
          libelle: 'Ajustement — changement de chambre',
          montant: new Prisma.Decimal(309),
        },
      });

      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${ctx.folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      // La facture (charges dues) n'inclut jamais les paiements : 1191 + 309.
      expect(Number(invoiceRes.body.montantTotal)).toBe(1500);

      const paiementApres = await prisma.folioLine.findUniqueOrThrow({
        where: { id: paiement.id },
      });
      expect(paiementApres.montant.toNumber()).toBe(500);
      expect(paiementApres.type).toBe('PAIEMENT');

      await cleanupManualFolio(ctx);
    });

    it('9. Autres charges du folio (EXTRA/RESTAURANT) intactes en présence d’un ajustement', async () => {
      const ctx = await createManualFolio('AUTRES-CHARGES');
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(400),
        },
      });
      const extra = await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.EXTRA,
          libelle: 'Minibar',
          montant: new Prisma.Decimal(50),
        },
      });
      const restaurant = await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.RESTAURANT,
          libelle: 'Note restaurant',
          montant: new Prisma.Decimal(120),
        },
      });
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.AJUSTEMENT_BAISSE,
          libelle: 'Ajustement — changement de chambre',
          montant: new Prisma.Decimal(100),
        },
      });

      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${ctx.folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      // 400 + 50 + 120 - 100 = 470.
      expect(Number(invoiceRes.body.montantTotal)).toBe(470);

      const extraApres = await prisma.folioLine.findUniqueOrThrow({
        where: { id: extra.id },
      });
      const restaurantApres = await prisma.folioLine.findUniqueOrThrow({
        where: { id: restaurant.id },
      });
      expect(extraApres.montant.toNumber()).toBe(50);
      expect(restaurantApres.montant.toNumber()).toBe(120);

      await cleanupManualFolio(ctx);
    });

    it('10. Ligne d’ajustement annulée : exclue de la facture, mêmes règles que les autres types (BR-AUD-002)', async () => {
      const ctx = await createManualFolio('LIGNE-ANNULEE');
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(400),
        },
      });
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.AJUSTEMENT_HAUSSE,
          libelle: 'Ajustement annulé (correction)',
          montant: new Prisma.Decimal(50),
          annulee: true,
          motifAnnulation: 'Correction manuelle — motif de test suffisant',
        },
      });

      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${ctx.folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      // La ligne annulée n'est jamais comptée — même comportement que
      // n'importe quelle autre ligne annulée (invoice-calc.ts, `if
      // (line.annulee) continue`).
      expect(Number(invoiceRes.body.montantTotal)).toBe(400);

      await cleanupManualFolio(ctx);
    });

    it('11. Taxe de séjour (MONTANT_FIXE) déjà matérialisée : pas de recalcul indu en présence d’un ajustement', async () => {
      const ctx = await createManualFolio('TAXE-FIXE');
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 3 nuits',
          montant: new Prisma.Decimal(1191),
        },
      });
      const taxRate = await prisma.taxRateConfig.findFirstOrThrow({
        where: { type: 'TAXE_SEJOUR', actif: true },
      });
      const taxeLigne = await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.TAXE_SEJOUR,
          libelle: 'Taxe de séjour',
          montant: new Prisma.Decimal(9),
          taxRateConfigId: taxRate.id,
        },
      });
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.AJUSTEMENT_HAUSSE,
          libelle: 'Ajustement — changement de chambre',
          montant: new Prisma.Decimal(309),
        },
      });

      const invoiceRes = await client
        .post(`/api/invoices/generer?folioId=${ctx.folio.id}`)
        .send({});
      expect(invoiceRes.status).toBe(201);
      // TAXE_SEJOUR déjà matérialisée (taxeDejaMaterialisee=true côté
      // service) : jamais recalculée/dupliquée. 1191 + 9 + 309 = 1509.
      expect(Number(invoiceRes.body.montantTotal)).toBe(1509);

      const taxeApres = await prisma.folioLine.findUniqueOrThrow({
        where: { id: taxeLigne.id },
      });
      expect(taxeApres.montant.toNumber()).toBe(9);
      const nbTaxeLignes = await prisma.folioLine.count({
        where: { folioId: ctx.folio.id, type: 'TAXE_SEJOUR' },
      });
      expect(nbTaxeLignes).toBe(1);

      await cleanupManualFolio(ctx);
    });

    it('12. Retry/idempotence : une double tentative de génération de facture sur le même folio ne double jamais l’ajustement', async () => {
      const ctx = await createManualFolio('RETRY-FACTURE');
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.HEBERGEMENT,
          libelle: 'Hébergement — 1 nuit',
          montant: new Prisma.Decimal(400),
        },
      });
      await prisma.folioLine.create({
        data: {
          folioId: ctx.folio.id,
          type: TypeLigneFolio.AJUSTEMENT_HAUSSE,
          libelle: 'Ajustement — changement de chambre',
          montant: new Prisma.Decimal(100),
        },
      });

      const first = await client
        .post(`/api/invoices/generer?folioId=${ctx.folio.id}`)
        .send({});
      expect(first.status).toBe(201);
      expect(Number(first.body.montantTotal)).toBe(500);

      // Rejeu (retry réseau simulé) : le garde-fou « facture active déjà
      // émise » existant (générique à tout le module, pas spécifique à
      // 009B.1) bloque toute seconde génération — jamais une seconde
      // ligne, jamais un second montant.
      const retry = await client
        .post(`/api/invoices/generer?folioId=${ctx.folio.id}`)
        .send({});
      expect(retry.status).toBe(409);

      const nbFactures = await prisma.invoice.count({
        where: { folioId: ctx.folio.id },
      });
      expect(nbFactures).toBe(1);
      const nbAjustements = await prisma.folioLine.count({
        where: { folioId: ctx.folio.id, type: 'AJUSTEMENT_HAUSSE' },
      });
      expect(nbAjustements).toBe(1);

      await cleanupManualFolio(ctx);
    });
  });
});
