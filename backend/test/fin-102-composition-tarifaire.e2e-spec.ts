import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { Prisma, TaxMode, TypeLigneFolio } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { computeSoldeDu } from './../src/modules/stay/utils/solde';
import { authedRequest, loginAs } from './helpers/auth';

// FIN-102 — composition du tarif public TTC (ADR-008 suite). Cas
// discriminant canonique et l'ensemble des scénarios listés dans la
// mission : le tarif public TTC vendu (HEBERGEMENT résiduel + prestations
// standard incluses + taxes statutaires) n'est jamais majoré au-delà du
// montant annoncé au client — jamais un recalcul manuel dans ce fichier,
// toujours une lecture réelle en base (computeSoldeDu importé tel quel,
// jamais réimplémenté ici) après de vrais appels HTTP contre une vraie base
// MySQL.
interface FolioLineResponse {
  id: number;
  type: string;
  libelle: string;
  montant: string;
  taxRateConfigId: number | null;
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
  roomId: number;
  nombreOccupants: number | null;
  dateCheckoutPrevue: string;
  folios: FolioResponse[];
  soldeDu?: string;
}

interface ReservationResponse {
  id: number;
  prixTotalFinal: string;
}

interface InvoiceResponse {
  id: number;
  montantTotal: string;
  statut: string;
}

describe('FIN-102 — composition du tarif public TTC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminClient: ReturnType<typeof authedRequest>;
  let receptionClient: ReturnType<typeof authedRequest>;
  let roomTypeId: number;

  // Suite 900 MAD/nuit, petit-déjeuner inclus 45 MAD/personne/nuit (formule
  // BED_AND_BREAKFAST, 2 nuits x 2 personnes = 180 MAD — cas discriminant
  // canonique de la mission). Taxes seedées : TS (3 MAD/nuit/pers.) et
  // TPT (1.30 MAD/nuit/pers.), jamais recréées ici (COMMERCIAL-001C).
  const PRIX_BASE = 900;
  const PRIX_PETIT_DEJEUNER = 45;

  function findFolioPrincipal(stay: StayResponse): FolioResponse {
    const folio = stay.folios.find((f) => f.libelle === 'Folio principal');
    if (!folio) throw new Error('Folio principal introuvable.');
    return folio;
  }

  async function refetchStayFolios(stayId: number) {
    return prisma.stay.findUniqueOrThrow({
      where: { id: stayId },
      include: { folios: { include: { lignes: true } } },
    });
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

    // capacite = 2 (>= nombreOccupants: 2 utilisé au check-in dans la
    // plupart des scénarios ci-dessous — common/utils/occupancy.ts borne
    // haute). Depuis la correction ADR-008 §4.5, ReservationsService.
    // calculatePrixTotal n'additionne plus la formule BED_AND_BREAKFAST sur
    // le tarif nuitée (calculateFormuleSupplement) — le cas discriminant
    // canonique (900 x 2 = 1800) retombe donc nativement sur 1800, quelle
    // que soit la capacité, sans ajustement manuel. Le test dédié à la
    // capacité 4 (walk-in, qui ne consulte jamais capacite pour le calcul du
    // tarif — seulement pour la borne haute de validation) utilise un type
    // de chambre séparé, voir plus bas.
    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-FIN102-SUITE-${Date.now()}`,
        prixBase: PRIX_BASE,
        capacite: 2,
        prixPetitDejeuner: PRIX_PETIT_DEJEUNER,
        prixDemiPension: 80,
        prixPensionComplete: 120,
      },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    await prisma.roomNight.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.payment.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    // DESIGN-010 — le test « facture EMISE + départ anticipé » crée un
    // CreditNote (avoir) : à supprimer avant Invoice (contrainte FK), même
    // précédent que billing.e2e-spec.ts.
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
        targetId: { in: await stayIdsForCleanup() },
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
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  async function stayIdsForCleanup(): Promise<number[]> {
    const stays = await prisma.stay.findMany({
      where: { room: { roomTypeId } },
      select: { id: true },
    });
    return stays.map((s) => s.id);
  }

  async function createRoom(prefix: string) {
    return prisma.room.create({
      data: { numero: `TEST-FIN102-${prefix}-${Date.now()}`, roomTypeId },
    });
  }

  it(
    'cas discriminant canonique : 900 MAD/nuit x 2 nuits = 1800 TTC, formule incluse (180) + ' +
      'TS (12) + TPT (5.20) absorbées, jamais additionnées — les 4 valeurs valent 1800',
    async () => {
      const room = await createRoom('CANON');
      const dateArrivee = '2027-06-10';
      const dateDepart = '2027-06-12';

      // Parcours applicatif normal, SANS AUCUN ajustement manuel de prix :
      // formule BED_AND_BREAKFAST (défaut de l'hôtel, non précisée ici) —
      // règle métier validée (ADR-008 §4.5) : le petit-déjeuner standard est
      // déjà inclus dans RoomType.prixBase, ReservationsService.
      // calculatePrixTotal ne l'additionne donc plus par-dessus
      // (calculateFormuleSupplement, reservations/utils/pricing.ts).
      // prixTotalCalcule doit retomber nativement sur 900 x 2 = 1800.
      const reservationRes = await receptionClient
        .post('/api/reservations')
        .send({
          roomId: room.id,
          dateArrivee,
          dateDepart,
          guest: { nom: 'Canonique', prenom: 'FIN102' },
        });
      expect(reservationRes.status).toBe(201);
      const reservation = reservationRes.body as ReservationResponse;
      const tarifPublicTTC = Number(reservation.prixTotalFinal);
      expect(tarifPublicTTC).toBe(1800);

      const checkinRes = await receptionClient
        .post(`/api/checkin/${reservation.id}`)
        .send({ nombreOccupants: 2 });
      expect(checkinRes.status).toBe(201);
      const stay = checkinRes.body as StayResponse;
      expect(stay.nombreOccupants).toBe(2);

      const principal = findFolioPrincipal(stay);
      const hebergement = principal.lignes.find(
        (l) => l.type === 'HEBERGEMENT',
      );
      const extra = principal.lignes.find((l) => l.type === 'EXTRA');
      const taxeLines = principal.lignes.filter((l) => l.type === 'TAXE_SEJOUR');
      expect(hebergement).toBeDefined();
      expect(extra).toBeDefined();
      // TS + TPT (COMMERCIAL-001C) : 2 lignes TAXE_SEJOUR.
      expect(taxeLines.length).toBeGreaterThanOrEqual(1);
      const totalTaxes = taxeLines.reduce((acc, l) => acc + Number(l.montant), 0);
      // 2 nuits x 2 pers : TS = 12 + TPT = 5.20 = 17.20
      expect(totalTaxes).toBeCloseTo(17.2, 1);
      // PD : 2 nuits x 2 pers x 45 = 180
      expect(Number(extra!.montant)).toBe(180);
      // HEB = 1800 - 180 - 17.20 = 1602.80
      expect(Number(hebergement!.montant)).toBeCloseTo(1602.8, 1);

      // Valeur 1 : tarif public — déjà vérifiée ci-dessus (1800).
      // Valeur 2 : total folio après check-in.
      const totalFolioCheckin = principal.lignes.reduce(
        (acc, l) => acc + Number(l.montant),
        0,
      );
      expect(totalFolioCheckin).toBe(1800);

      // Valeur 3 : computeSoldeDu (fonction canonique réelle, jamais
      // réimplémentée ici), lue depuis une relecture fraîche en base.
      const stayFresh = await refetchStayFolios(stay.id);
      const soldeApresCheckin = computeSoldeDu(stayFresh.folios);
      expect(soldeApresCheckin.toNumber()).toBe(1800);

      // Valeur 4 : Invoice.montantTotal après génération de facture.
      const invoiceRes = await adminClient.post(
        `/api/invoices/generer?folioId=${principal.id}`,
      );
      expect(invoiceRes.status).toBe(201);
      const invoice = invoiceRes.body as InvoiceResponse;
      expect(Number(invoice.montantTotal)).toBe(1800);

      // Valeur 5 : solde après facture — generateInvoice() ne doit plus
      // jamais muter les charges d'un séjour non-legacy (point 8 de la
      // mission) : même nombre de lignes TAXE_SEJOUR avant/après, solde
      // inchangé.
      const stayApresFacture = await refetchStayFolios(stay.id);
      const soldeApresFacture = computeSoldeDu(stayApresFacture.folios);
      expect(soldeApresFacture.toNumber()).toBe(1800);
      const lignesTaxeApres = stayApresFacture.folios
        .flatMap((f) => f.lignes)
        .filter((l) => l.type === TypeLigneFolio.TAXE_SEJOUR);
      expect(lignesTaxeApres).toHaveLength(2);

      // Rapport exigé par la mission (les 5 valeurs, toutes à 1800) :

      console.log('FIN-102 — rapport 5 valeurs', {
        tarifPublic: tarifPublicTTC,
        totalFolioCheckin,
        computeSoldeDuApresCheckin: soldeApresCheckin.toNumber(),
        invoiceMontantTotal: Number(invoice.montantTotal),
        soldeApresFacture: soldeApresFacture.toNumber(),
      });
    },
  );

  it('occupation 1 personne dans une chambre de capacité 4 : la taxe de séjour utilise nombreOccupants, jamais la capacité (BED_AND_BREAKFAST)', async () => {
    // Type de chambre dédié (capacite: 4) — un walk-in ne consulte jamais
    // RoomType.capacite pour le calcul du tarif public TTC (seulement pour
    // la borne haute de validation, common/utils/occupancy.ts), donc sans
    // impact sur le roomType partagé capacite: 2 des autres scénarios.
    const roomTypeCap4 = await prisma.roomType.create({
      data: {
        nom: `TEST-FIN102-CAP4-${Date.now()}`,
        prixBase: PRIX_BASE,
        capacite: 4,
      },
    });
    try {
      const room = await prisma.room.create({
        data: {
          numero: `TEST-FIN102-OCC1-${Date.now()}`,
          roomTypeId: roomTypeCap4.id,
        },
      });
      const checkinRes = await receptionClient
        .post('/api/checkin/walk-in')
        .send({
          roomId: room.id,
          dateCheckoutPrevue: new Date(Date.now() + 2 * 86_400_000)
            .toISOString()
            .slice(0, 10),
          nombreOccupants: 1,
          // COMMERCIAL-001C : ROOM_ONLY interdit — on utilise B&B.
          formule: 'BED_AND_BREAKFAST',
          guest: { nom: 'Solo', prenom: 'Occupant' },
        });
      expect(checkinRes.status).toBe(201);
      const stay = checkinRes.body as StayResponse;
      const principal = findFolioPrincipal(stay);
      const taxeLines = principal.lignes.filter((l) => l.type === 'TAXE_SEJOUR');
      // TS = 3 x 2 nuits x 1 pers = 6 + TPT = 1.30 x 2 x 1 = 2.60 → total 8.60
      // Vérifie que nombreOccupants (1) est utilisé, jamais capacite (4).
      const totalTaxes = taxeLines.reduce((acc, l) => acc + Number(l.montant), 0);
      expect(totalTaxes).toBeCloseTo(8.6, 1);
    } finally {
      await prisma.roomNight.deleteMany({
        where: { room: { roomTypeId: roomTypeCap4.id } },
      });
      await prisma.folioLine.deleteMany({
        where: { folio: { stay: { room: { roomTypeId: roomTypeCap4.id } } } },
      });
      await prisma.folio.deleteMany({
        where: { stay: { room: { roomTypeId: roomTypeCap4.id } } },
      });
      await prisma.stay.deleteMany({
        where: { room: { roomTypeId: roomTypeCap4.id } },
      });
      await prisma.roomStatusLog.deleteMany({
        where: { room: { roomTypeId: roomTypeCap4.id } },
      });
      await prisma.housekeepingTaskLog.deleteMany({
        where: { task: { room: { roomTypeId: roomTypeCap4.id } } },
      });
      await prisma.housekeepingTask.deleteMany({
        where: { room: { roomTypeId: roomTypeCap4.id } },
      });
      await prisma.room.deleteMany({ where: { roomTypeId: roomTypeCap4.id } });
      await prisma.roomType.delete({ where: { id: roomTypeCap4.id } });
    }
  });

  it('check-in depuis réservation : nombreOccupants requis, refusé si ni la réservation ni la requête ne le fournissent', async () => {
    const room = await createRoom('RES-NOOCC');
    const reservationRes = await receptionClient
      .post('/api/reservations')
      .send({
        roomId: room.id,
        dateArrivee: '2027-06-20',
        dateDepart: '2027-06-21',
        guest: { nom: 'SansOccupation', prenom: 'Test' },
      });
    const reservation = reservationRes.body as ReservationResponse;

    const rejected = await receptionClient
      .post(`/api/checkin/${reservation.id}`)
      .send({});
    expect(rejected.status).toBe(400);

    const accepted = await receptionClient
      .post(`/api/checkin/${reservation.id}`)
      .send({ nombreOccupants: 2 });
    expect(accepted.status).toBe(201);
  });

  it('check-in walk-in : nombreOccupants strictement obligatoire (rejeté par le DTO si absent)', async () => {
    const room = await createRoom('WI-NOOCC');
    const res = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
        .toISOString()
        .slice(0, 10),
      guest: { nom: 'SansOccupation', prenom: 'WalkIn' },
    });
    expect(res.status).toBe(400);
  });

  it('COMMERCIAL-001C : formule ROOM_ONLY rejetée (400) par le DTO walk-in — interdit pour les nuitées', async () => {
    const room = await createRoom('ROOMONLY-REJECT');
    const res = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: new Date(Date.now() + 2 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      nombreOccupants: 2,
      formule: 'ROOM_ONLY',
      guest: { nom: 'SansFormule', prenom: 'Test' },
    });
    expect(res.status).toBe(400);
  });

  it('COMMERCIAL-001C : PD libellé "PD" — 1 nuit x 2 pers x 45 = 90', async () => {
    const room = await createRoom('BB-SEUL');
    const res = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
        .toISOString()
        .slice(0, 10),
      nombreOccupants: 2,
      formule: 'BED_AND_BREAKFAST',
      guest: { nom: 'PetitDej', prenom: 'Inclus' },
    });
    expect(res.status).toBe(201);
    const stay = res.body as StayResponse;
    const principal = findFolioPrincipal(stay);
    const extra = principal.lignes.find((l) => l.type === 'EXTRA');
    expect(extra).toBeDefined();
    // COMMERCIAL-001C : libellé normalisé 'PD — 1 nuit'.
    expect(extra!.libelle).toMatch(/^PD/);
    // 1 nuit x 2 personnes x 45 = 90.
    expect(Number(extra!.montant)).toBe(90);
  });

  it('petit-déjeuner inclus + petit-déjeuner supplémentaire vendu séparément : deux lignes EXTRA distinctes, additionnées correctement', async () => {
    const room = await createRoom('BB-DOUBLE');
    const res = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
        .toISOString()
        .slice(0, 10),
      nombreOccupants: 2,
      formule: 'BED_AND_BREAKFAST',
      guest: { nom: 'PetitDej', prenom: 'DoubleVente' },
    });
    const stay = res.body as StayResponse;
    const principal = findFolioPrincipal(stay);
    const inclus = principal.lignes.find((l) => l.type === 'EXTRA');
    expect(inclus).toBeDefined();

    const supplementaire = await adminClient
      .post(`/api/folios/${principal.id}/lignes`)
      .send({
        type: 'EXTRA',
        libelle: 'Petit-déjeuner supplémentaire vendu séparément',
        montant: '35.00',
      });
    expect(supplementaire.status).toBe(201);

    const stayFresh = await refetchStayFolios(stay.id);
    const soldeDu = computeSoldeDu(stayFresh.folios);
    const lignesExtra = stayFresh.folios
      .flatMap((f) => f.lignes)
      .filter((l) => l.type === TypeLigneFolio.EXTRA && !l.annulee);
    expect(lignesExtra).toHaveLength(2);
    // Solde = HEBERGEMENT résiduel + EXTRA inclus + EXTRA supplémentaire +
    // TAXE_SEJOUR — les deux lignes EXTRA jamais fusionnées.
    const totalAttendu = stayFresh.folios
      .flatMap((f) => f.lignes)
      .filter((l) => !l.annulee)
      .reduce((acc, l) => acc.add(l.montant), new Prisma.Decimal(0));
    expect(soldeDu.toNumber()).toBe(totalAttendu.toNumber());
  });

  it('taxe de séjour matérialisée au check-in, jamais à la facturation (point 8)', async () => {
    const room = await createRoom('TAXE-TIMING');
    const res = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
        .toISOString()
        .slice(0, 10),
      nombreOccupants: 2,
      // COMMERCIAL-001C : ROOM_ONLY interdit — B&B utilisé pour ce test d'invariant.
      formule: 'BED_AND_BREAKFAST',
      guest: { nom: 'Taxe', prenom: 'Timing' },
    });
    const stay = res.body as StayResponse;
    const principal = findFolioPrincipal(stay);
    // COMMERCIAL-001C : TS + TPT → 2 lignes TAXE_SEJOUR dès le check-in.
    const taxeAvant = principal.lignes.filter((l) => l.type === 'TAXE_SEJOUR');
    expect(taxeAvant.length).toBeGreaterThanOrEqual(1);

    const lignesAvant = await prisma.folioLine.count({
      where: { folioId: principal.id },
    });
    const soldeAvant = computeSoldeDu(
      (await refetchStayFolios(stay.id)).folios,
    );

    const invoiceRes = await adminClient.post(
      `/api/invoices/generer?folioId=${principal.id}`,
    );
    expect(invoiceRes.status).toBe(201);

    const lignesApres = await prisma.folioLine.count({
      where: { folioId: principal.id },
    });
    const soldeApres = computeSoldeDu(
      (await refetchStayFolios(stay.id)).folios,
    );
    expect(lignesApres).toBe(lignesAvant);
    expect(soldeApres.toNumber()).toBe(soldeAvant.toNumber());
  });

  it('prolongation (avec formule incluse) : invariant du delta préservé, TAXE_SEJOUR absorbée', async () => {
    // HALF_BOARD (demi-pension), pas BED_AND_BREAKFAST : seule la formule
    // B&B standard est couverte par la règle métier validée FIN-102
    // (petit-déjeuner déjà inclus dans prixBase, jamais additionné) —
    // HALF_BOARD/FULL_BOARD restent additives (comportement historique
    // inchangé, non traité par cette mission), donc toujours pertinentes
    // pour démontrer une formule qui s'ajoute réellement au tarif nuitée.
    const room = await createRoom('EXTEND');
    const dateCheckoutPrevue = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10);
    const res = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue,
      nombreOccupants: 2,
      formule: 'HALF_BOARD',
      guest: { nom: 'Extend', prenom: 'FIN102' },
    });
    const stay = res.body as StayResponse;
    const stayAvant = await refetchStayFolios(stay.id);
    const soldeAvant = computeSoldeDu(stayAvant.folios);

    const nouvelleDate = new Date(Date.now() + 3 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const extendRes = await receptionClient
      .post(`/api/stays/${stay.id}/extend`)
      .send({
        nouvelleDateCheckoutPrevue: nouvelleDate,
        motif: 'Prolongation test FIN-102 avec formule incluse',
      });
    expect(extendRes.status).toBe(201);

    const stayApres = await refetchStayFolios(stay.id);
    const soldeApres = computeSoldeDu(stayApres.folios);

    // Delta tarif public TTC = 2 nuits x 900 (hébergement brut) + 2 nuits x
    // 2 personnes x 80 (demi-pension, additive) = 1800 + 320 = 2120.
    const tarifPublicTTCDelta = 900 * 2 + 80 * 2 * 2;
    expect(soldeApres.sub(soldeAvant).toNumber()).toBe(tarifPublicTTCDelta);

    const taxeSejourLignes = stayApres.folios
      .flatMap((f) => f.lignes)
      .filter((l) => l.type === TypeLigneFolio.TAXE_SEJOUR && !l.annulee);
    // 2 lignes au check-in (TS + TPT) + 2 au delta de prolongation (TS + TPT).
    expect(taxeSejourLignes).toHaveLength(4);
  });

  it('départ anticipé : réconciliation append-only de TAXE_SEJOUR, jamais de montant négatif', async () => {
    const room = await createRoom('DEPART-ANTICIPE');
    const dateCheckoutPrevue = new Date(Date.now() + 4 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const res = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue,
      nombreOccupants: 2,
      // COMMERCIAL-001C : ROOM_ONLY interdit — B&B utilisé.
      formule: 'BED_AND_BREAKFAST',
      guest: { nom: 'Depart', prenom: 'Anticipe' },
    });
    const stay = res.body as StayResponse;
    const principal = findFolioPrincipal(stay);
    const taxeInitiales = principal.lignes.filter((l) => l.type === 'TAXE_SEJOUR');
    // COMMERCIAL-001C : TS (4x2x3=24) + TPT (4x2x1.30=10.40) = 34.40
    expect(taxeInitiales.length).toBeGreaterThanOrEqual(1);
    const totalTaxesInit = taxeInitiales.reduce((acc, l) => acc + Number(l.montant), 0);
    expect(totalTaxesInit).toBeGreaterThan(0);
    const soldeInitial = computeSoldeDu(
      (await refetchStayFolios(stay.id)).folios,
    );

    // Check-out forcé dès aujourd'hui (départ anticipé — nuits réellement
    // consommées, 1, très inférieures aux 4 nuits prévues initialement).
    const checkoutRes = await adminClient
      .post(`/api/checkout/${stay.id}`)
      .send({
        force: true,
        motif: 'Départ anticipé test FIN-102 (réconciliation TAXE_SEJOUR)',
      });
    expect(checkoutRes.status).toBe(201);

    const stayApres = await refetchStayFolios(stay.id);
    const lignes = stayApres.folios.flatMap((f) => f.lignes);
    const taxeAnnulees = lignes.filter(
      (l) => l.type === TypeLigneFolio.TAXE_SEJOUR && l.annulee,
    );
    const taxeActives = lignes.filter(
      (l) => l.type === TypeLigneFolio.TAXE_SEJOUR && !l.annulee,
    );
    expect(taxeAnnulees.length).toBeGreaterThan(0);
    expect(taxeActives.length).toBeGreaterThan(0);
    // Jamais de montant négatif écrit (contrainte CHECK MySQL, mais vérifié
    // aussi applicativement ici).
    for (const l of lignes) {
      expect(Number(l.montant)).toBeGreaterThanOrEqual(0);
    }

    // Le total du package initial reste préservé (aucune réduction du
    // montant total dû — l'hébergement réservé reste dû, seule sa
    // ventilation TAXE_SEJOUR/HEBERGEMENT est corrigée).
    const soldeApres = computeSoldeDu(stayApres.folios);
    expect(soldeApres.toNumber()).toBe(soldeInitial.toNumber());

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        targetEntity: 'Stay',
        targetId: stay.id,
        action: 'RECONCILE_TAXE_SEJOUR',
      },
    });
    expect(auditLog).not.toBeNull();
  });

  // DESIGN-010 (Billing Center, mission §7/§23.D) — gap réel identifié à
  // l'audit de la garde « facture figée » : rien n'empêche aujourd'hui
  // BillingService.generateInvoice() d'émettre une facture EMISE sur le
  // folio d'un séjour encore EN_COURS (aucune vérification de Stay.statut
  // dans generateInvoice — voir aussi le commentaire dédié dans
  // billing/utils/invoice.pdf.spec.ts). Un départ anticipé consécutif à une
  // telle facture écrivait alors directement dans FolioLine
  // (StayService.reconcileTaxeSejourDepartAnticipe : annulation +
  // recréation de TAXE_SEJOUR/HEBERGEMENT), en dehors de
  // BillingService.addFolioLine/cancelFolioLine et de leur garde « facture
  // émise » — écart silencieux entre le solde recalculé au check-out et la
  // facture déjà émise et remise au client, jamais mis à jour. Corrigé en
  // ajoutant la même garde dans reconcileTaxeSejourDepartAnticipe elle-même
  // (StayService), avant toute écriture, dans la même transaction que le
  // check-out.
  it('facture EMISE active sur le folio + départ anticipé → check-out rejeté (409), aucune réconciliation FolioLine', async () => {
    const room = await createRoom('DEPART-ANTICIPE-EMISE');
    const dateCheckoutPrevue = new Date(Date.now() + 4 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const res = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue,
      nombreOccupants: 2,
      // COMMERCIAL-001C : ROOM_ONLY interdit — B&B utilisé.
      formule: 'BED_AND_BREAKFAST',
      guest: { nom: 'DepartEmise', prenom: 'Anticipe' },
    });
    const stay = res.body as StayResponse;
    const principal = findFolioPrincipal(stay);

    // Générer une facture EMISE alors que le séjour est encore EN_COURS —
    // seule façon d'atteindre ce scénario, aucune restriction serveur ne
    // l'empêche aujourd'hui (voir commentaire ci-dessus).
    const invoiceRes = await adminClient
      .post(`/api/invoices/generer?folioId=${principal.id}`)
      .send({});
    expect(invoiceRes.status).toBe(201);
    const invoice = invoiceRes.body as InvoiceResponse;
    expect(invoice.statut).toBe('EMISE');

    const lignesAvant = (await refetchStayFolios(stay.id)).folios.flatMap(
      (f) => f.lignes,
    );

    // Preuve de rigueur sabotage/restore : avant l'ajout de la garde dans
    // reconcileTaxeSejourDepartAnticipe (StayService), ce check-out forcé
    // renvoyait 201 et réécrivait silencieusement TAXE_SEJOUR/HEBERGEMENT
    // sur un folio déjà couvert par une facture EMISE — vérifié en
    // retirant temporairement l'appel à assertFolioNonFacture() pendant le
    // développement (201 au lieu du 409 attendu ci-dessous, confirmant que
    // ce test est discriminant), puis restauré.
    const checkoutRes = await adminClient
      .post(`/api/checkout/${stay.id}`)
      .send({
        force: true,
        motif: 'Départ anticipé test DESIGN-010 (folio déjà facturé)',
      });
    expect(checkoutRes.status).toBe(409);

    // Aucune écriture FolioLine (ni annulation, ni recréation) : le séjour
    // reste EN_COURS, la facture EMISE conserve la valeur exacte du folio
    // qu'elle a figée.
    const stayApres = await prisma.stay.findUniqueOrThrow({
      where: { id: stay.id },
    });
    expect(stayApres.statut).toBe('EN_COURS');
    const lignesApres = (await refetchStayFolios(stay.id)).folios.flatMap(
      (f) => f.lignes,
    );
    expect(lignesApres.length).toBe(lignesAvant.length);
    expect(lignesApres.every((l) => !l.annulee)).toBe(true);

    // Avoir total : débloque le folio, un check-out forcé identique
    // réussit alors normalement (réconciliation TAXE_SEJOUR appliquée).
    const creditNoteRes = await adminClient
      .post(`/api/invoices/${invoice.id}/credit-notes`)
      .send({ motif: 'Avoir de test e2e pour débloquer le check-out' });
    expect(creditNoteRes.status).toBe(201);

    const checkoutApresAvoirRes = await adminClient
      .post(`/api/checkout/${stay.id}`)
      .send({
        force: true,
        motif: 'Départ anticipé après avoir — doit réussir',
      });
    expect(checkoutApresAvoirRes.status).toBe(201);
  });

  it('plusieurs taxes statutaires simultanées : la boucle fonctionne avec une seconde TaxRateConfig de test', async () => {
    const secondeTaxe = await prisma.taxRateConfig.create({
      data: {
        type: `TEST-FIN102-TAXE-SECONDAIRE-${Date.now()}`,
        mode: TaxMode.MONTANT_FIXE,
        taux: new Prisma.Decimal(1),
        actif: true,
        collectePourTresor: true,
        applicableParDefaut: true,
      },
    });
    try {
      const room = await createRoom('MULTI-TAXE');
      const res = await receptionClient.post('/api/checkin/walk-in').send({
        roomId: room.id,
        dateCheckoutPrevue: new Date(Date.now() + 2 * 86_400_000)
          .toISOString()
          .slice(0, 10),
        nombreOccupants: 2,
        // COMMERCIAL-001C : ROOM_ONLY interdit — B&B utilisé.
        formule: 'BED_AND_BREAKFAST',
        guest: { nom: 'Multi', prenom: 'Taxe' },
      });
      expect(res.status).toBe(201);
      const stay = res.body as StayResponse;
      const principal = findFolioPrincipal(stay);
      const taxes = principal.lignes.filter((l) => l.type === 'TAXE_SEJOUR');
      // COMMERCIAL-001C : TS + TPT (seedées) + taxe secondaire de test = 3 lignes.
      expect(taxes.length).toBeGreaterThanOrEqual(2);
      const totalTaxes = taxes.reduce((acc, l) => acc + Number(l.montant), 0);
      // TS(12) + TPT(5.20) + secondaire(4) = 21.20 minimum.
      expect(totalTaxes).toBeGreaterThan(16);

      const hebergement = principal.lignes.find(
        (l) => l.type === 'HEBERGEMENT',
      );
      // HEB = 900*2 - PD(180) - total taxes
      expect(Number(hebergement!.montant)).toBeCloseTo(1800 - 180 - totalTaxes, 1);

      // Nettoie les FolioLine qui référencent la taxe secondaire (FK
      // RESTRICT sur TaxRateConfig, aucune cascade) avant de la supprimer.
      await prisma.folioLine.deleteMany({
        where: { folio: { stayId: stay.id } },
      });
      await prisma.folio.deleteMany({ where: { stayId: stay.id } });
      await prisma.roomNight.deleteMany({ where: { stayId: stay.id } });
      await prisma.stay.delete({ where: { id: stay.id } });
    } finally {
      await prisma.taxRateConfig.delete({ where: { id: secondeTaxe.id } });
    }
  });

  it('composition impossible (formule + taxes > tarif public) → exception explicite, rollback, aucune ligne créée', async () => {
    const roomTypeCher = await prisma.roomType.create({
      data: {
        nom: `TEST-FIN102-IMPOSSIBLE-${Date.now()}`,
        prixBase: 1,
        capacite: 4,
        prixPetitDejeuner: 1000,
        prixDemiPension: 0,
        prixPensionComplete: 0,
      },
    });
    try {
      const room = await prisma.room.create({
        data: {
          numero: `TEST-FIN102-IMP-${Date.now()}`,
          roomTypeId: roomTypeCher.id,
        },
      });

      const res = await receptionClient.post('/api/checkin/walk-in').send({
        roomId: room.id,
        dateCheckoutPrevue: new Date(Date.now() + 86_400_000)
          .toISOString()
          .slice(0, 10),
        nombreOccupants: 2,
        formule: 'BED_AND_BREAKFAST',
        guest: { nom: 'Impossible', prenom: 'Composition' },
      });
      expect(res.status).toBe(409);

      const stays = await prisma.stay.findMany({
        where: { room: { roomTypeId: roomTypeCher.id } },
      });
      expect(stays).toHaveLength(0);
      const lines = await prisma.folioLine.findMany({
        where: { folio: { stay: { room: { roomTypeId: roomTypeCher.id } } } },
      });
      expect(lines).toHaveLength(0);
    } finally {
      await prisma.room.deleteMany({ where: { roomTypeId: roomTypeCher.id } });
      await prisma.roomType.delete({ where: { id: roomTypeCher.id } });
    }
  });

  it('acompte/paiement déjà présent avant génération de facture : n’interfère pas avec l’invariant', async () => {
    const room = await createRoom('ACOMPTE');
    const res = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: new Date(Date.now() + 2 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      nombreOccupants: 2,
      formule: 'BED_AND_BREAKFAST',
      guest: { nom: 'Acompte', prenom: 'Preexistant' },
    });
    const stay = res.body as StayResponse;
    const principal = findFolioPrincipal(stay);
    const totalCharges = principal.lignes.reduce(
      (acc, l) => acc + Number(l.montant),
      0,
    );

    const paymentRes = await adminClient.post('/api/payments').send({
      folioId: principal.id,
      moyen: 'ESPECES',
      montant: '100.00',
      idempotencyKey: `fin102-acompte-${stay.id}-${Date.now()}`,
    });
    expect(paymentRes.status).toBe(201);

    const soldeApresPaiement = computeSoldeDu(
      (await refetchStayFolios(stay.id)).folios,
    );
    expect(soldeApresPaiement.toNumber()).toBe(totalCharges - 100);

    const invoiceRes = await adminClient.post(
      `/api/invoices/generer?folioId=${principal.id}`,
    );
    expect(invoiceRes.status).toBe(201);
    const invoice = invoiceRes.body as InvoiceResponse;
    // Le total de facture reste le total des CHARGES (jamais net du
    // paiement, PAIEMENT toujours exclu de calculateInvoiceTotal) —
    // inchangé par la présence du paiement.
    expect(Number(invoice.montantTotal)).toBe(totalCharges);

    const soldeApresFacture = computeSoldeDu(
      (await refetchStayFolios(stay.id)).folios,
    );
    expect(soldeApresFacture.toNumber()).toBe(totalCharges - 100);
  });

  it('séjour legacy (nombreOccupants IS NULL) : fallback de facturation historique inchangé', async () => {
    const room = await createRoom('LEGACY');
    // Fixture directe (bypass du check-in HTTP, qui exige désormais
    // nombreOccupants) pour simuler un séjour créé avant ce déploiement —
    // Stay.nombreOccupants reste NULL, jamais un backfill inventé ici.
    const guest = await prisma.guest.create({
      data: { nom: 'Legacy', prenom: 'SansOccupation' },
    });
    const stay = await prisma.stay.create({
      data: {
        roomId: room.id,
        guestId: guest.id,
        dateCheckin: new Date(),
        dateCheckoutPrevue: new Date(Date.now() + 2 * 86_400_000),
        formule: 'ROOM_ONLY',
      },
    });
    expect(stay.nombreOccupants).toBeNull();
    const folio = await prisma.folio.create({
      data: { stayId: stay.id, libelle: 'Folio principal' },
    });
    await prisma.folioLine.create({
      data: {
        folioId: folio.id,
        type: TypeLigneFolio.HEBERGEMENT,
        libelle: 'Hébergement — 2 nuits',
        montant: new Prisma.Decimal(1800),
      },
    });

    const lignesAvant = await prisma.folioLine.count({
      where: { folioId: folio.id },
    });
    expect(lignesAvant).toBe(1); // aucune TAXE_SEJOUR au check-in, legacy.

    const invoiceRes = await adminClient.post(
      `/api/invoices/generer?folioId=${folio.id}`,
    );
    expect(invoiceRes.status).toBe(201);
    const invoice = invoiceRes.body as InvoiceResponse;

    // Fallback historique : TAXE_SEJOUR matérialisée à la facturation, comme
    // avant FIN-102 (comportement inchangé pour ce séjour legacy).
    const lignesApres = await prisma.folioLine.findMany({
      where: { folioId: folio.id },
    });
    const taxeSejour = lignesApres.find(
      (l) => l.type === TypeLigneFolio.TAXE_SEJOUR,
    );
    expect(taxeSejour).toBeDefined();
    const totalAttendu = lignesApres
      .filter((l) => !l.annulee)
      .reduce((acc, l) => acc.add(l.montant), new Prisma.Decimal(0));
    expect(Number(invoice.montantTotal)).toBe(totalAttendu.toNumber());
  });

  it('séjour legacy prolongé (nombreOccupants IS NULL + extendStay) : aucune TAXE_SEJOUR ajoutée par la prolongation, une seule matérialisation fiscale (fallback) à la facturation', async () => {
    const room = await createRoom('LEGACY-EXTEND');
    // Même fixture directe que le test legacy ci-dessus (bypass du check-in
    // HTTP, qui exige désormais nombreOccupants) — Stay.nombreOccupants
    // reste NULL, jamais un backfill inventé ici.
    const guest = await prisma.guest.create({
      data: { nom: 'Legacy', prenom: 'Prolonge' },
    });
    const dateCheckoutPrevueInitiale = new Date(Date.now() + 2 * 86_400_000);
    const stay = await prisma.stay.create({
      data: {
        roomId: room.id,
        guestId: guest.id,
        dateCheckin: new Date(),
        dateCheckoutPrevue: dateCheckoutPrevueInitiale,
        formule: 'ROOM_ONLY',
      },
    });
    expect(stay.nombreOccupants).toBeNull();
    const folio = await prisma.folio.create({
      data: { stayId: stay.id, libelle: 'Folio principal' },
    });
    await prisma.folioLine.create({
      data: {
        folioId: folio.id,
        type: TypeLigneFolio.HEBERGEMENT,
        libelle: 'Hébergement — 2 nuits',
        montant: new Prisma.Decimal(1800),
      },
    });

    const nouvelleDate = new Date(Date.now() + 4 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const extendRes = await receptionClient
      .post(`/api/stays/${stay.id}/extend`)
      .send({
        nouvelleDateCheckoutPrevue: nouvelleDate,
        motif: 'Prolongation séjour legacy — test FIN-102',
      });
    expect(extendRes.status).toBe(201);

    // extendStay ne doit jamais matérialiser TAXE_SEJOUR pour un séjour
    // legacy (taxesStatutairesDelta = [] tant que Stay.nombreOccupants est
    // NULL) — seule une nouvelle ligne HEBERGEMENT (delta) est attendue.
    const lignesApresExtend = await prisma.folioLine.findMany({
      where: { folioId: folio.id },
    });
    expect(
      lignesApresExtend.filter((l) => l.type === TypeLigneFolio.TAXE_SEJOUR),
    ).toHaveLength(0);
    expect(
      lignesApresExtend.filter((l) => l.type === TypeLigneFolio.HEBERGEMENT),
    ).toHaveLength(2);

    const invoiceRes = await adminClient.post(
      `/api/invoices/generer?folioId=${folio.id}`,
    );
    expect(invoiceRes.status).toBe(201);

    // Une seule matérialisation fiscale (le fallback legacy de
    // generateInvoice, sur la durée totale du séjour prolongé) — jamais de
    // duplication entre la prolongation et la facturation.
    const lignesApresFacture = await prisma.folioLine.findMany({
      where: { folioId: folio.id },
    });
    const taxeSejourLignes = lignesApresFacture.filter(
      (l) => l.type === TypeLigneFolio.TAXE_SEJOUR,
    );
    expect(taxeSejourLignes).toHaveLength(2);
  });
});
