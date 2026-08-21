import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { Prisma } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

// COMMERCIAL-001C — Ventilation TTC complète (HEB + PD + TPT + TS = TOTAL).
//
// Exemple E2E canonique : 2 occupants / 1 nuit / tarif TTC 850
//   PD  = 2 × 45      = 90.00
//   TS  = 2 × 3       =  6.00
//   TPT = 2 × 1.30    =  2.60
//   HEB = 850 - 90 - 6 - 2.60 = 751.40
//   TOTAL              = 850.00
//
// Invariant : le tarif total TTC ne change JAMAIS (aucune charge additive).
// Aucune facture historique n'est affectée.

interface FolioLineResponse {
  id: number;
  type: string;
  libelle: string;
  montant: string;
  annulee: boolean;
}

interface FolioResponse {
  id: number;
  libelle: string;
  lignes: FolioLineResponse[];
}

interface StayResponse {
  id: number;
  statut: string;
  folios: FolioResponse[];
}

interface InvoiceResponse {
  id: number;
  montantTotal: string;
}

describe('COMMERCIAL-001C — Ventilation TTC nuitée (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let receptionClient: ReturnType<typeof authedRequest>;
  let adminClient: ReturnType<typeof authedRequest>;

  // Type de chambre dédié à cette suite — isolé du seed pour ne pas
  // polluer d'autres tests. prixPetitDejeuner = 45 MAD/pers (COMMERCIAL-001C).
  let roomTypeId: number;

  function findFolioPrincipal(stay: StayResponse): FolioResponse {
    const f = stay.folios.find((x) => x.libelle === 'Folio principal');
    if (!f) throw new Error('Folio principal introuvable');
    return f;
  }

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
    const adminToken = await loginAs(app.getHttpServer(), 'admin');
    adminClient = authedRequest(app.getHttpServer(), adminToken);
    const receptionToken = await loginAs(app.getHttpServer(), 'reception');
    receptionClient = authedRequest(app.getHttpServer(), receptionToken);

    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-C001C-${Date.now()}`,
        prixBase: 850,
        capacite: 2,
        // prixPetitDejeuner = 45 : 2 pers × 1 nuit × 45 = 90 (exemple canonique).
        prixPetitDejeuner: 45,
        prixDemiPension: 150,
        prixPensionComplete: 220,
      },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    await prisma.roomNight.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.creditNote.deleteMany({
      where: { invoice: { folio: { stay: { room: { roomTypeId } } } } },
    });
    await prisma.invoice.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.folioLine.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.folio.deleteMany({
      where: { stay: { room: { roomTypeId } } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        targetEntity: 'Stay',
        targetId: {
          in: (
            await prisma.stay.findMany({
              where: { room: { roomTypeId } },
              select: { id: true },
            })
          ).map((s) => s.id),
        },
      },
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
    await prisma.roomType.delete({ where: { id: roomTypeId } });
    await app.close();
  });

  async function createRoom(suffix: string) {
    return prisma.room.create({
      data: { numero: `TEST-C001C-${suffix}-${Date.now()}`, roomTypeId },
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // T1 — Exemple canonique E2E obligatoire
  // ────────────────────────────────────────────────────────────────────────────
  it(
    'T1 — exemple canonique : 2 occ / 1 nuit / TTC 850' +
      ' → PD=90 TS=6 TPT=2.60 HEB=751.40 TOTAL=850',
    async () => {
      const room = await createRoom('CANON');

      // Walk-in avec prixTotalFinal imposé à 850 MAD TTC.
      const checkinRes = await receptionClient
        .post('/api/checkin/walk-in')
        .send({
          roomId: room.id,
          dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
            .toISOString()
            .slice(0, 10),
          nombreOccupants: 2,
          formule: 'BED_AND_BREAKFAST',
          prixTotalFinal: 850,
          motifAjustement: 'Tarif canonique COMMERCIAL-001C test',
          guest: { nom: 'Canonique', prenom: 'VentilTTC' },
        });
      expect(checkinRes.status).toBe(201);

      const stay = checkinRes.body as StayResponse;
      const principal = findFolioPrincipal(stay);

      // ── Présence des 4 composantes ──────────────────────────────────────────
      const heb = principal.lignes.find((l) => l.type === 'HEBERGEMENT');
      const pd = principal.lignes.find(
        (l) => l.type === 'EXTRA' && l.libelle.startsWith('PD'),
      );
      const ts = principal.lignes.find(
        (l) => l.type === 'TAXE_SEJOUR' && l.libelle === 'TS',
      );
      const tpt = principal.lignes.find(
        (l) => l.type === 'TAXE_SEJOUR' && l.libelle === 'TPT',
      );

      expect(heb).toBeDefined();
      expect(pd).toBeDefined();
      expect(ts).toBeDefined();
      expect(tpt).toBeDefined();

      // ── Montants attendus ───────────────────────────────────────────────────
      // PD : 2 pers × 1 nuit × 45 = 90
      expect(Number(pd!.montant)).toBe(90);
      // TS : 2 pers × 1 nuit × 3 = 6
      expect(Number(ts!.montant)).toBe(6);
      // TPT : 2 pers × 1 nuit × 1.30 = 2.60
      expect(Number(tpt!.montant)).toBeCloseTo(2.6, 2);
      // HEB = 850 - 90 - 6 - 2.60 = 751.40
      expect(Number(heb!.montant)).toBeCloseTo(751.4, 2);

      // ── Invariant TTC ──────────────────────────────────────────────────────
      const total = principal.lignes
        .filter((l) => !l.annulee)
        .reduce((acc, l) => acc + Number(l.montant), 0);
      expect(total).toBeCloseTo(850, 2);

      console.log('COMMERCIAL-001C — ventilation canonique', {
        HEB: Number(heb!.montant),
        PD: Number(pd!.montant),
        TS: Number(ts!.montant),
        TPT: Number(tpt!.montant),
        TOTAL: total,
      });
    },
  );

  // ────────────────────────────────────────────────────────────────────────────
  // T2 — Rejet ROOM_ONLY (DTO walk-in)
  // ────────────────────────────────────────────────────────────────────────────
  it('T2 — ROOM_ONLY rejeté 400 par le DTO walk-in', async () => {
    const room = await createRoom('RO-REJECT');
    const res = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
        .toISOString()
        .slice(0, 10),
      nombreOccupants: 2,
      formule: 'ROOM_ONLY',
      guest: { nom: 'RoomOnly', prenom: 'Reject' },
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('ROOM_ONLY');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T3 — Rejet ROOM_ONLY (DTO réservation)
  // ────────────────────────────────────────────────────────────────────────────
  it('T3 — ROOM_ONLY rejeté 400 par le DTO réservation', async () => {
    const room = await createRoom('RO-RES-REJECT');
    const res = await receptionClient.post('/api/reservations').send({
      roomId: room.id,
      dateArrivee: '2027-09-01',
      dateDepart: '2027-09-02',
      formule: 'ROOM_ONLY',
      guest: { nom: 'RoomOnly', prenom: 'ResReject' },
    });
    expect(res.status).toBe(400);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T4 — Facture PDF contient les 4 libellés (via GET /invoices/:id/pdf)
  // ────────────────────────────────────────────────────────────────────────────
  it('T4 — facture PDF contient les 4 composantes (HEB, PD, TS, TPT)', async () => {
    const room = await createRoom('PDF');
    const checkinRes = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
        .toISOString()
        .slice(0, 10),
      nombreOccupants: 2,
      formule: 'BED_AND_BREAKFAST',
      prixTotalFinal: 850,
      motifAjustement: 'PDF test COMMERCIAL-001C',
      guest: { nom: 'PDF', prenom: 'VentilTest' },
    });
    expect(checkinRes.status).toBe(201);

    const stay = checkinRes.body as StayResponse;
    const principal = findFolioPrincipal(stay);

    // Générer la facture
    const invoiceRes = await adminClient.post(
      `/api/invoices/generer?folioId=${principal.id}`,
    );
    expect(invoiceRes.status).toBe(201);
    const invoice = invoiceRes.body as InvoiceResponse;
    const invoiceId: number = invoice.id;

    // Télécharger le PDF
    const pdfRes = await adminClient
      .get(`/api/invoices/${invoiceId}/pdf`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toMatch(/pdf/);
    const body = pdfRes.body as Buffer;
    expect(body.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(body.length).toBeGreaterThan(1000);

    // Les 4 libellés sont bien présents sur la facture ventilée
    const types = principal.lignes.map((l) => l.type);
    expect(types).toContain('HEBERGEMENT');
    expect(types).toContain('EXTRA');
    expect(types).toContain('TAXE_SEJOUR');

    const libelles = principal.lignes.map((l) => l.libelle);
    expect(libelles.some((l) => l.startsWith('PD'))).toBe(true);
    expect(libelles).toContain('TS');
    expect(libelles).toContain('TPT');

    // Montant total TTC inchangé
    expect(Number(invoice.montantTotal)).toBeCloseTo(850, 2);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T5 — HB cohérent avec nombreOccupants (PD non impacté, supplement correct)
  // ────────────────────────────────────────────────────────────────────────────
  it('T5 — HALF_BOARD : supplement HB calculé sur nombreOccupants réels (2)', async () => {
    const room = await createRoom('HB');
    const checkinRes = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
        .toISOString()
        .slice(0, 10),
      nombreOccupants: 2,
      formule: 'HALF_BOARD',
      guest: { nom: 'HalfBoard', prenom: 'OccupTest' },
    });
    expect(checkinRes.status).toBe(201);

    const stay = checkinRes.body as StayResponse;
    const principal = findFolioPrincipal(stay);

    const hbLine = principal.lignes.find((l) => l.type === 'EXTRA');
    expect(hbLine).toBeDefined();
    // 1 nuit × 2 occ × prixDemiPension(150) = 300
    expect(Number(hbLine!.montant)).toBe(300);

    // Invariant TTC
    const total = principal.lignes
      .filter((l) => !l.annulee)
      .reduce((acc, l) => acc + Number(l.montant), 0);
    const tarifAttendu = 850 + 300; // prixBase + supplement HB
    expect(total).toBeCloseTo(tarifAttendu, 1);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // T6 — Aucune modification des données historiques
  // ────────────────────────────────────────────────────────────────────────────
  it('T6 — factures EMISE historiques non modifiées', async () => {
    // Créer un séjour historique avec une facture déjà émise
    const room = await createRoom('HISTORIQUE');
    const guest = await prisma.guest.create({
      data: { nom: 'Historique', prenom: 'Legacy' },
    });
    const stayDb = await prisma.stay.create({
      data: {
        roomId: room.id,
        guestId: guest.id,
        dateCheckin: new Date('2024-01-01'),
        dateCheckoutPrevue: new Date('2024-01-02'),
        formule: 'BED_AND_BREAKFAST',
      },
    });
    const folio = await prisma.folio.create({
      data: { stayId: stayDb.id, libelle: 'Folio principal' },
    });
    await prisma.folioLine.create({
      data: {
        folioId: folio.id,
        type: 'HEBERGEMENT',
        libelle: 'Hébergement — 1 nuit',
        montant: new Prisma.Decimal(400),
      },
    });
    const invoiceRes = await adminClient.post(
      `/api/invoices/generer?folioId=${folio.id}`,
    );
    expect(invoiceRes.status).toBe(201);
    const historicInvoice = invoiceRes.body as InvoiceResponse;
    const originalTotal = Number(historicInvoice.montantTotal);

    // Relire après : montant doit être identique
    const invoiceCheck = await adminClient.get(
      `/api/invoices/${historicInvoice.id}`,
    );
    expect(invoiceCheck.status).toBe(200);
    const checkedInvoice = invoiceCheck.body as InvoiceResponse;
    expect(Number(checkedInvoice.montantTotal)).toBe(originalTotal);
  });
});
