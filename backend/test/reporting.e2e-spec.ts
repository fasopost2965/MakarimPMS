import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

interface FinancialSummaryResponse {
  caNetHtHebergement: string;
  caNetHtExtras: string;
  tvaHebergementCollectee: string;
  tvaExtrasCollectee: string;
  taxeSejourCollectee: string;
  soldeBrutEncaisse: string;
}

interface StayResponse {
  id: number;
  guestId: number;
  roomId: number;
}

interface InvoiceResponse {
  id: number;
  montantTotal: string;
}

// Module reporting (Sprint 13, BR-COM-002 ventilation fiscale + BR-CLI-003
// rapport de police). Vrais appels HTTP contre une vraie base MySQL.
describe('Reporting — ventilation fiscale et rapport de police (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let comptableClient: ReturnType<typeof authedRequest>;
  let adminClient: ReturnType<typeof authedRequest>;
  let gouvernanteClient: ReturnType<typeof authedRequest>;
  let roomTypeId: number;
  let today: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const comptableToken = await loginAs(app.getHttpServer(), 'comptable');
    comptableClient = authedRequest(app.getHttpServer(), comptableToken);
    const adminToken = await loginAs(app.getHttpServer(), 'admin');
    adminClient = authedRequest(app.getHttpServer(), adminToken);
    const gouvernanteToken = await loginAs(app.getHttpServer(), 'gouvernante');
    gouvernanteClient = authedRequest(app.getHttpServer(), gouvernanteToken);

    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-REPORTING-TYPE-${Date.now()}`,
        prixBase: 500,
        capacite: 2,
      },
    });
    roomTypeId = roomType.id;
    today = new Date().toISOString().slice(0, 10);
  });

  afterAll(async () => {
    // roomType lui-même n'est PAS supprimé : les chambres/séjours/folios/
    // factures créés par les tests sont volontairement conservés (leur
    // suppression casserait l'immuabilité des factures déjà émises,
    // ADR-004), et Room.roomTypeId est une contrainte de clé étrangère —
    // supprimer le type le violerait tant qu'une chambre y fait référence.
    // La base e2e est jetable dans son ensemble, pas nettoyée ligne à ligne.
    await app.close();
  });

  async function createRoom() {
    const room = await prisma.room.create({
      data: { numero: `TEST-REP-${Date.now()}-${Math.random()}`, roomTypeId },
    });
    return room.id;
  }

  async function getFinancialSummary(client: ReturnType<typeof authedRequest>) {
    const res = await client.get(
      `/api/reporting/financial-summary?dateDebut=${today}&dateFin=${today}`,
    );
    return res.body as FinancialSummaryResponse;
  }

  describe('Cloisonnement RBAC (aucune ligne RBAC_MATRIX.md dédiée — arbitrage Administrateur+Comptable)', () => {
    it('la Gouvernante ne peut consulter ni la synthèse financière, ni le rapport de police, ni l’export', async () => {
      const synth = await gouvernanteClient.get(
        `/api/reporting/financial-summary?dateDebut=${today}&dateFin=${today}`,
      );
      expect(synth.status).toBe(403);

      const police = await gouvernanteClient.get(
        `/api/reporting/police-report?date=${today}`,
      );
      expect(police.status).toBe(403);

      const exportRes = await gouvernanteClient.get(
        `/api/reporting/export?dateDebut=${today}&dateFin=${today}`,
      );
      expect(exportRes.status).toBe(403);
    });

    it('le Comptable a accès en lecture', async () => {
      const res = await comptableClient.get(
        `/api/reporting/financial-summary?dateDebut=${today}&dateFin=${today}`,
      );
      expect(res.status).toBe(200);
    });
  });

  describe('Ventilation fiscale (BR-COM-002)', () => {
    it('ventile HT/TVA hébergement (10%) et extras (20%), recoupe avec la facture immuable émise', async () => {
      const avant = await getFinancialSummary(comptableClient);
      const roomId = await createRoom();

      const demain = new Date(Date.now() + 86_400_000)
        .toISOString()
        .slice(0, 10);
      const checkin = await adminClient.post('/api/checkin/walk-in').send({
        roomId,
        dateCheckoutPrevue: demain,
        guest: {
          nom: 'Ventilation',
          prenom: 'Test',
          pieceIdentite: 'CN123456',
        },
      });
      expect(checkin.status).toBe(201);
      const stay = checkin.body as StayResponse;

      await prisma.guest.update({
        where: { id: stay.guestId },
        data: { nationalite: 'Marocaine' },
      });

      const ligneHebergement = await prisma.folioLine.findFirstOrThrow({
        where: { folio: { stayId: stay.id }, type: 'HEBERGEMENT' },
      });
      const montantHebergement = ligneHebergement.montant.toNumber();
      const folioId = ligneHebergement.folioId;

      const extra = await adminClient
        .post(`/api/folios/${folioId}/lignes`)
        .send({
          type: 'EXTRA',
          libelle: 'Minibar test reporting',
          montant: '100.00',
        });
      expect(extra.status).toBe(201);

      const invoice = await adminClient.post(
        `/api/invoices/generer?folioId=${folioId}`,
      );
      expect(invoice.status).toBe(201);
      const invoiceBody = invoice.body as InvoiceResponse;

      const apres = await getFinancialSummary(comptableClient);

      const deltaHt =
        Number(apres.caNetHtHebergement) - Number(avant.caNetHtHebergement);
      const deltaExtras =
        Number(apres.caNetHtExtras) - Number(avant.caNetHtExtras);
      const deltaTvaHeb =
        Number(apres.tvaHebergementCollectee) -
        Number(avant.tvaHebergementCollectee);
      const deltaTvaExtras =
        Number(apres.tvaExtrasCollectee) - Number(avant.tvaExtrasCollectee);

      expect(deltaHt).toBeCloseTo(montantHebergement, 2);
      expect(deltaExtras).toBeCloseTo(100, 2);
      expect(deltaTvaHeb).toBeCloseTo(montantHebergement * 0.1, 2);
      expect(deltaTvaExtras).toBeCloseTo(20, 2);

      // Recoupement avec la facture immuable (SPRINT_13.md §4 : comparer les
      // totaux consolidés avec la somme brute des factures émises).
      // generateInvoice() matérialise désormais aussi la taxe de séjour
      // (fiscalité configurable, TaxRateConfig.applicableParDefaut) en
      // FolioLine avant de calculer le total — on lit son montant réel
      // plutôt que de le recalculer en dur ici, pour ne pas dupliquer la
      // règle métier (montant fixe × nuits × capacité) dans le test.
      const ligneTaxeSejour = await prisma.folioLine.findFirstOrThrow({
        where: { folioId, type: 'TAXE_SEJOUR' },
      });
      const ttcAttendu =
        montantHebergement * 1.1 + 100 * 1.2 + ligneTaxeSejour.montant.toNumber();
      expect(Number(invoiceBody.montantTotal)).toBeCloseTo(ttcAttendu, 2);
    });
  });

  describe('Rapport de police (BR-CLI-003)', () => {
    it('liste les arrivées du jour avec identité complète en CSV', async () => {
      const roomId = await createRoom();
      const demain = new Date(Date.now() + 86_400_000)
        .toISOString()
        .slice(0, 10);

      const checkin = await adminClient.post('/api/checkin/walk-in').send({
        roomId,
        dateCheckoutPrevue: demain,
        guest: {
          nom: 'Alaoui',
          prenom: 'Karim',
          pieceIdentite: 'AB998877',
        },
      });
      expect(checkin.status).toBe(201);

      const res = await comptableClient.get(
        `/api/reporting/police-report?date=${today}`,
      );
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('rapport-police');
      const csv = res.text;
      expect(csv).toContain('Alaoui');
      expect(csv).toContain('Karim');
      expect(csv).toContain('AB998877');
    });
  });

  describe('Export grand livre (BR-REP-001)', () => {
    it('exporte les lignes de folio de la période en CSV', async () => {
      const res = await comptableClient.get(
        `/api/reporting/export?dateDebut=${today}&dateFin=${today}`,
      );
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const csv = res.text;
      expect(csv.split('\r\n')[0]).toBe(
        'date,folioId,sejourId,type,libelle,montantHT,annulee',
      );
    });
  });
});
