/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
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
});
