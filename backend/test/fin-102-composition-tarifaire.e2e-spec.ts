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

  // Suite 900 MAD/nuit, petit-déjeuner inclus 50 MAD/personne/nuit (formule
  // BED_AND_BREAKFAST, 2 nuits x 2 personnes = 200 MAD — cas discriminant
  // canonique de la mission). Taxe de séjour : TaxRateConfig déjà seedée
  // (TAXE_SEJOUR, MONTANT_FIXE, 3 MAD/nuit/personne, seed.ts), jamais
  // recréée ici.
  const PRIX_BASE = 900;
  const PRIX_PETIT_DEJEUNER = 50;

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
    'cas discriminant canonique : 900 MAD/nuit x 2 nuits = 1800 TTC, formule incluse (200) + ' +
      'TAXE_SEJOUR (12) absorbées, jamais additionnées — les 4 valeurs valent 1800',
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
      const taxeSejour = principal.lignes.find((l) => l.type === 'TAXE_SEJOUR');
      expect(hebergement).toBeDefined();
      expect(extra).toBeDefined();
      expect(taxeSejour).toBeDefined();
      expect(Number(hebergement!.montant)).toBe(1588);
      expect(Number(extra!.montant)).toBe(200);
      expect(Number(taxeSejour!.montant)).toBe(12);

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
      expect(lignesTaxeApres).toHaveLength(1);

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

  it('occupation 1 personne dans une chambre de capacité 4 : la taxe de séjour utilise nombreOccupants, jamais la capacité', async () => {
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
          formule: 'ROOM_ONLY',
          guest: { nom: 'Solo', prenom: 'Occupant' },
        });
      expect(checkinRes.status).toBe(201);
      const stay = checkinRes.body as StayResponse;
      const principal = findFolioPrincipal(stay);
      const taxeSejour = principal.lignes.find((l) => l.type === 'TAXE_SEJOUR');
      // 3 MAD x 2 nuits x 1 personne = 6 (jamais x4, la capacité de la chambre).
      expect(Number(taxeSejour!.montant)).toBe(6);
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

  it('formule ROOM_ONLY : aucune ligne EXTRA formule incluse, comportement identique à avant', async () => {
    const room = await createRoom('ROOMONLY');
    const res = await receptionClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: new Date(Date.now() + 2 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      nombreOccupants: 2,
      formule: 'ROOM_ONLY',
      guest: { nom: 'SansFormule', prenom: 'Test' },
    });
    expect(res.status).toBe(201);
    const stay = res.body as StayResponse;
    const principal = findFolioPrincipal(stay);
    expect(principal.lignes.some((l) => l.type === 'EXTRA')).toBe(false);
    // 900 x 2 - taxe (3 x 2 x 2 = 12) = 1788.
    const hebergement = principal.lignes.find((l) => l.type === 'HEBERGEMENT');
    expect(Number(hebergement!.montant)).toBe(900 * 2 - 12);
  });

  it('petit-déjeuner inclus seul (formule BED_AND_BREAKFAST) matérialisé en EXTRA distinct', async () => {
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
    // 1 nuit x 2 personnes x 50 = 100.
    expect(Number(extra!.montant)).toBe(100);
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
      formule: 'ROOM_ONLY',
      guest: { nom: 'Taxe', prenom: 'Timing' },
    });
    const stay = res.body as StayResponse;
    const principal = findFolioPrincipal(stay);
    const taxeAvant = principal.lignes.filter((l) => l.type === 'TAXE_SEJOUR');
    expect(taxeAvant).toHaveLength(1);

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
    // Une ligne au check-in (1 nuit) + une au delta de prolongation (2 nuits).
    expect(taxeSejourLignes).toHaveLength(2);
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
      formule: 'ROOM_ONLY',
      guest: { nom: 'Depart', prenom: 'Anticipe' },
    });
    const stay = res.body as StayResponse;
    const principal = findFolioPrincipal(stay);
    const taxeInitiale = principal.lignes.find((l) => l.type === 'TAXE_SEJOUR');
    // 4 nuits x 2 personnes x 3 = 24.
    expect(Number(taxeInitiale!.montant)).toBe(24);
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
        formule: 'ROOM_ONLY',
        guest: { nom: 'Multi', prenom: 'Taxe' },
      });
      expect(res.status).toBe(201);
      const stay = res.body as StayResponse;
      const principal = findFolioPrincipal(stay);
      const taxes = principal.lignes.filter((l) => l.type === 'TAXE_SEJOUR');
      expect(taxes).toHaveLength(2);
      const totalTaxes = taxes.reduce((acc, l) => acc + Number(l.montant), 0);
      // TAXE_SEJOUR (3 x 2 x 2 = 12) + taxe secondaire (1 x 2 x 2 = 4) = 16.
      expect(totalTaxes).toBe(16);

      const hebergement = principal.lignes.find(
        (l) => l.type === 'HEBERGEMENT',
      );
      expect(Number(hebergement!.montant)).toBe(900 * 2 - 16);

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
    expect(taxeSejourLignes).toHaveLength(1);
  });
});
