import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { Prisma, StatutChambre, TypeLigneFolio } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { computeSoldeDu } from '../src/modules/stay/utils/solde';
import { authedRequest, loginAs } from './helpers/auth';

interface FolioLineResponse {
  id: number;
  type: string;
  libelle: string;
  montant: string;
  annulee: boolean;
  taxRateConfigId: number | null;
  createdAt: string;
}

interface FolioResponse {
  id: number;
  libelle: string;
  lignes: FolioLineResponse[];
}

interface StayResponse {
  id: number;
  roomId: number;
  guestId: number;
  statut: string;
  folios: FolioResponse[];
  soldeDu?: string;
}

interface ReservationResponse {
  id: number;
}

interface InvoiceResponse {
  id: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

// FIN-102B (ADR-008, INV-TEMP-001) — la taxe de séjour (TAXE_SEJOUR) est
// désormais matérialisée en FolioLine dès le check-in/la prolongation
// (jamais seulement à la facturation, contrairement au comportement
// pré-existant) : charges TTC présentes dans le folio = charges dans
// computeSoldeDu = charges prises en compte à la facturation, sans que
// generateInvoice() ne crée jamais silencieusement une nouvelle dette.
// Vrais appels HTTP contre une vraie base MySQL, aucun mock.
describe('FIN-102B — timing de matérialisation de TAXE_SEJOUR (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminClient: ReturnType<typeof authedRequest>;
  let roomTypeId: number;
  let taxeSejourConfigId: number;

  const PRIX_BASE = 100;
  // TaxRateConfig du seed : TAXE_SEJOUR, MONTANT_FIXE, taux=3 MAD/nuit/pers.
  const TAUX_TAXE_SEJOUR = 3;

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

    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-FIN102B-TYPE-${Date.now()}`,
        prixBase: new Prisma.Decimal(PRIX_BASE),
        capacite: 4,
      },
    });
    roomTypeId = roomType.id;

    const taxeSejour = await prisma.taxRateConfig.findFirstOrThrow({
      where: { type: 'TAXE_SEJOUR' },
    });
    taxeSejourConfigId = taxeSejour.id;
    // Sécurise l'état attendu par ce fichier (actif + applicable par
    // défaut), au cas où un autre fichier e2e l'aurait modifié sans le
    // restaurer.
    await prisma.taxRateConfig.update({
      where: { id: taxeSejourConfigId },
      data: {
        actif: true,
        applicableParDefaut: true,
        taux: new Prisma.Decimal(TAUX_TAXE_SEJOUR),
      },
    });
  });

  afterAll(async () => {
    await prisma.folioLine.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.payment.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    // CreditNote référence Invoice par FK — doit être vidée avant
    // invoice.deleteMany (même ordre que payments.e2e-spec.ts).
    await prisma.creditNote.deleteMany({
      where: { invoice: { folio: { stay: { room: { roomTypeId } } } } },
    });
    await prisma.invoice.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.folio.deleteMany({
      where: { stay: { room: { roomTypeId } } },
    });
    await prisma.roomNight.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.stay.deleteMany({ where: { room: { roomTypeId } } });
    // ReservationDeposit référence Reservation par FK (scénario 14, acompte)
    // — doit être vidée avant reservation.deleteMany.
    await prisma.reservationDeposit.deleteMany({
      where: { reservation: { room: { roomTypeId } } },
    });
    await prisma.reservation.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.roomStatusLog.deleteMany({ where: { room: { roomTypeId } } });
    // Scénarios 6/14 (checkout) déclenchent checkout.effectue → une
    // HousekeepingTask A_NETTOYER pour la chambre (HousekeepingTaskService),
    // jamais nettoyée automatiquement — même ordre que checkin-flow.e2e-spec
    // (HousekeepingTaskLog référence HousekeepingTask par FK).
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

  async function createRoom() {
    return prisma.room.create({
      data: {
        numero: `TEST-FIN102B-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        roomTypeId,
        statut: StatutChambre.LIBRE_PROPRE,
      },
    });
  }

  async function fetchStayWithFolios(stayId: number) {
    return prisma.stay.findUniqueOrThrow({
      where: { id: stayId },
      include: { folios: { include: { lignes: true } } },
    });
  }

  // Scénario 1 — occupation 1 / capacité 4 : la taxe doit être calculée pour
  // 1, jamais pour 4 (interdiction absolue de tout repli
  // nombreOccupants ?? capacite).
  it('check-in walk-in : occupation 1 sur une chambre de capacité 4 → TAXE_SEJOUR calculée pour 1 occupant', async () => {
    const room = await createRoom();
    const dateCheckoutPrevue = isoDate(addDays(new Date(), 1));

    const res = await adminClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue,
      guest: { nom: 'FIN102B', prenom: 'OccUn' },
      nombreOccupants: 1,
    });
    expect(res.status).toBe(201);
    const stay = res.body as StayResponse;

    const principal = stay.folios.find((f) => f.libelle === 'Folio principal')!;
    const taxeLignes = principal.lignes.filter((l) => l.type === 'TAXE_SEJOUR');
    expect(taxeLignes).toHaveLength(1);
    // 1 nuit x 1 occupant x 3 MAD = 3 — jamais 1 x 4 x 3 = 12 (capacité).
    expect(Number(taxeLignes[0].montant)).toBe(1 * 1 * TAUX_TAXE_SEJOUR);
  });

  // Scénario 2 — nombreOccupants obligatoire au walk-in (aucune Reservation
  // à consulter en secours).
  it('check-in walk-in sans nombreOccupants → 400, aucun séjour créé', async () => {
    const room = await createRoom();
    const staysBefore = await prisma.stay.count({ where: { roomId: room.id } });

    const res = await adminClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: isoDate(addDays(new Date(), 1)),
      guest: { nom: 'FIN102B', prenom: 'SansOccupants' },
    });
    expect(res.status).toBe(400);

    const staysAfter = await prisma.stay.count({ where: { roomId: room.id } });
    expect(staysAfter).toBe(staysBefore);
  });

  // Scénario 3 — check-in depuis réservation : reprend
  // Reservation.nombreOccupants tel quel, sans corps de requête additionnel.
  it('check-in depuis réservation reprend Reservation.nombreOccupants sans corps de requête', async () => {
    const room = await createRoom();
    const dateArrivee = isoDate(new Date());
    const dateDepart = isoDate(addDays(new Date(), 2));

    const reservationRes = await adminClient.post('/api/reservations').send({
      roomId: room.id,
      dateArrivee,
      dateDepart,
      guest: { nom: 'FIN102B', prenom: 'Reservation' },
      nombreOccupants: 3,
    });
    expect(reservationRes.status).toBe(201);
    const reservation = reservationRes.body as ReservationResponse;

    const checkin = await adminClient
      .post(`/api/checkin/${reservation.id}`)
      .send();
    expect(checkin.status).toBe(201);
    const stay = checkin.body as StayResponse;

    const principal = stay.folios.find((f) => f.libelle === 'Folio principal')!;
    const taxeLignes = principal.lignes.filter((l) => l.type === 'TAXE_SEJOUR');
    expect(taxeLignes).toHaveLength(1);
    // 2 nuits x 3 occupants x 3 MAD = 18.
    expect(Number(taxeLignes[0].montant)).toBe(2 * 3 * TAUX_TAXE_SEJOUR);
  });

  // Scénario 3bis — check-in depuis réservation SANS nombreOccupants connu
  // ni fourni au check-in → 400 (jamais de Stay.nombreOccupants NULL pour un
  // nouveau check-in).
  it('check-in depuis réservation sans nombreOccupants (ni réservation, ni corps) → 400', async () => {
    const room = await createRoom();
    const reservationRes = await adminClient.post('/api/reservations').send({
      roomId: room.id,
      dateArrivee: isoDate(new Date()),
      dateDepart: isoDate(addDays(new Date(), 1)),
      guest: { nom: 'FIN102B', prenom: 'SansOccupantsResa' },
    });
    const reservation = reservationRes.body as ReservationResponse;

    const checkin = await adminClient
      .post(`/api/checkin/${reservation.id}`)
      .send();
    expect(checkin.status).toBe(400);

    // Fourni dans le corps de la requête (secours documenté) : accepté.
    const checkinAvecCorps = await adminClient
      .post(`/api/checkin/${reservation.id}`)
      .send({ nombreOccupants: 2 });
    expect(checkinAvecCorps.status).toBe(201);
  });

  // Scénario 4 — TAXE_SEJOUR présente immédiatement après check-in, via la
  // vraie fonction computeSoldeDu (import réel, jamais recopiée), avant
  // toute facturation.
  it('computeSoldeDu (fonction réelle) inclut TAXE_SEJOUR immédiatement après check-in', async () => {
    const room = await createRoom();
    const res = await adminClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: isoDate(addDays(new Date(), 2)),
      guest: { nom: 'FIN102B', prenom: 'SoldeImmediat' },
      nombreOccupants: 2,
    });
    expect(res.status).toBe(201);
    const stay = res.body as StayResponse;

    const fresh = await fetchStayWithFolios(stay.id);
    const solde = computeSoldeDu(fresh.folios);

    const principal = fresh.folios.find(
      (f) => f.libelle === 'Folio principal',
    )!;
    const hebergement = principal.lignes
      .filter((l) => l.type === TypeLigneFolio.HEBERGEMENT)
      .reduce((sum, l) => sum + Number(l.montant), 0);
    const taxe = principal.lignes
      .filter((l) => l.type === TypeLigneFolio.TAXE_SEJOUR)
      .reduce((sum, l) => sum + Number(l.montant), 0);

    expect(taxe).toBe(2 * 2 * TAUX_TAXE_SEJOUR); // 2 nuits x 2 occupants x 3
    expect(solde.toNumber()).toBeCloseTo(hebergement + taxe, 2);
  });

  // Scénario 5 — prolongation : nouvelle ligne TAXE_SEJOUR pour le seul
  // delta, ligne initiale strictement inchangée (id/montant/createdAt).
  it('extend : delta TAXE_SEJOUR exact, ligne initiale du check-in jamais modifiée', async () => {
    const room = await createRoom();
    const today = new Date();
    const checkinRes = await adminClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: isoDate(addDays(today, 2)),
      guest: { nom: 'FIN102B', prenom: 'Extend' },
      nombreOccupants: 2,
    });
    expect(checkinRes.status).toBe(201);
    const stay = checkinRes.body as StayResponse;
    const principalId = stay.folios.find(
      (f) => f.libelle === 'Folio principal',
    )!.id;

    const avant = await prisma.folioLine.findFirstOrThrow({
      where: { folioId: principalId, type: TypeLigneFolio.TAXE_SEJOUR },
    });

    const extendRes = await adminClient
      .post(`/api/stays/${stay.id}/extend`)
      .send({
        nouvelleDateCheckoutPrevue: isoDate(addDays(today, 4)),
        motif: 'Prolongation FIN-102B — delta TAXE_SEJOUR',
      });
    expect(extendRes.status).toBe(201);

    const apres = await prisma.folioLine.findMany({
      where: { folioId: principalId, type: TypeLigneFolio.TAXE_SEJOUR },
      orderBy: { id: 'asc' },
    });
    expect(apres).toHaveLength(2);

    const ligneInitiale = apres.find((l) => l.id === avant.id)!;
    expect(ligneInitiale.montant.toString()).toBe(avant.montant.toString());
    expect(ligneInitiale.createdAt.toISOString()).toBe(
      avant.createdAt.toISOString(),
    );
    expect(ligneInitiale.annulee).toBe(false);

    const ligneDelta = apres.find((l) => l.id !== avant.id)!;
    // Delta = 2 nuits supplémentaires x 2 occupants x 3 MAD = 12.
    expect(Number(ligneDelta.montant)).toBe(2 * 2 * TAUX_TAXE_SEJOUR);
    expect(ligneDelta.libelle).toContain('Prolongation');
  });

  // Scénario 6 — départ anticipé : réconciliation par annulation + recréation
  // (jamais de montant négatif, jamais de suppression/mutation de la ligne
  // d'origine). Scénario 7 (historique append-only) vérifié dans le même
  // test : la ligne d'origine reste en base, seulement marquée annulée.
  it('checkout anticipé : réconciliation TAXE_SEJOUR par annulation + recréation, jamais de montant négatif ni de suppression', async () => {
    const room = await createRoom();
    const today = new Date();
    // Réservé pour 3 nuits, occupation 2 → taxe initiale matérialisée au
    // check-in = 3 nuits x 2 occupants x 3 MAD = 18.
    const checkinRes = await adminClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: isoDate(addDays(today, 3)),
      guest: { nom: 'FIN102B', prenom: 'DepartAnticipe' },
      nombreOccupants: 2,
    });
    expect(checkinRes.status).toBe(201);
    const stay = checkinRes.body as StayResponse;
    const principal = stay.folios.find((f) => f.libelle === 'Folio principal')!;
    const taxeInitiale = principal.lignes.find(
      (l) => l.type === 'TAXE_SEJOUR',
    )!;
    expect(Number(taxeInitiale.montant)).toBe(3 * 2 * TAUX_TAXE_SEJOUR); // 18
    const hebergementInitial = principal.lignes.find(
      (l) => l.type === 'HEBERGEMENT',
    )!;

    // Départ le jour même (1 nuit réellement consommée) → taxe réellement
    // due = 1 nuit x 2 occupants x 3 MAD = 6, strictement inférieure aux 18
    // déjà matérialisées : correction attendue. HEBERGEMENT n'est jamais
    // recalculé (décision produit déjà tranchée) : le paiement doit couvrir
    // le plein montant HEBERGEMENT + la taxe réellement due après
    // réconciliation.
    const montantDu =
      Number(hebergementInitial.montant) + 1 * 2 * TAUX_TAXE_SEJOUR;
    const paymentRes = await adminClient.post('/api/payments').send({
      folioId: principal.id,
      moyen: 'ESPECES',
      montant: montantDu.toFixed(2),
      idempotencyKey: `fin102b-checkout-anticipe-${stay.id}`,
    });
    expect(paymentRes.status).toBe(201);

    const checkoutRes = await adminClient
      .post(`/api/checkout/${stay.id}`)
      .send();
    expect(checkoutRes.status).toBe(201);
    const checkedOut = checkoutRes.body as StayResponse;
    // Réconciliation exécutée AVANT le contrôle de solde (INV-TEMP-001) :
    // le paiement exact suffit, jamais bloqué à tort par les 18 MAD
    // désormais obsolètes.
    expect(Number(checkedOut.soldeDu)).toBeCloseTo(0, 2);

    const lignesTaxeApres = await prisma.folioLine.findMany({
      where: { folioId: principal.id, type: TypeLigneFolio.TAXE_SEJOUR },
      orderBy: { id: 'asc' },
    });
    expect(lignesTaxeApres).toHaveLength(2);

    // La ligne d'origine (18 MAD) reste en base — jamais supprimée, jamais
    // son montant modifié — seulement annulée (historique append-only,
    // scénario 7).
    const ligneOrigine = lignesTaxeApres.find((l) => l.id === taxeInitiale.id)!;
    expect(ligneOrigine.annulee).toBe(true);
    expect(ligneOrigine.montant.toString()).toBe(
      taxeInitiale.montant.toString(),
    );
    expect(ligneOrigine.motifAnnulation).not.toBeNull();

    // La nouvelle ligne (6 MAD) est active, jamais négative.
    const ligneCorrigee = lignesTaxeApres.find(
      (l) => l.id !== taxeInitiale.id,
    )!;
    expect(ligneCorrigee.annulee).toBe(false);
    expect(Number(ligneCorrigee.montant)).toBe(1 * 2 * TAUX_TAXE_SEJOUR);
    expect(ligneCorrigee.montant.toNumber()).toBeGreaterThanOrEqual(0);

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        targetEntity: 'Folio',
        targetId: principal.id,
        action: 'RECONCILE_TAXE_SEJOUR',
      },
    });
    expect(auditLog).not.toBeNull();
  });

  // Scénario 8 (central) — facture avant/après : computeSoldeDu strictement
  // identique, jamais de nouvelle dette silencieuse à la facturation.
  it('generateInvoice ne modifie jamais computeSoldeDu pour un séjour "nouveau modèle"', async () => {
    const room = await createRoom();
    const checkinRes = await adminClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: isoDate(addDays(new Date(), 2)),
      guest: { nom: 'FIN102B', prenom: 'Facture' },
      nombreOccupants: 2,
    });
    expect(checkinRes.status).toBe(201);
    const stay = checkinRes.body as StayResponse;
    const principal = stay.folios.find((f) => f.libelle === 'Folio principal')!;

    const avantFetch = await fetchStayWithFolios(stay.id);
    const soldeAvant = computeSoldeDu(avantFetch.folios);

    const invoiceRes = await adminClient.post(
      `/api/invoices/generer?folioId=${principal.id}`,
    );
    expect(invoiceRes.status).toBe(201);

    const apresFetch = await fetchStayWithFolios(stay.id);
    const soldeApres = computeSoldeDu(apresFetch.folios);

    expect(soldeApres.toNumber()).toBe(soldeAvant.toNumber());

    // Scénario 10 — aucune duplication de taxe à la facturation (nouveau
    // modèle) : generateInvoice() est en lecture seule pour TAXE_SEJOUR.
    const lignesTaxe = apresFetch.folios
      .flatMap((f) => f.lignes)
      .filter((l) => l.type === TypeLigneFolio.TAXE_SEJOUR);
    expect(lignesTaxe).toHaveLength(1);
  });

  // Scénario 11 — avoir puis régénération : toujours aucune duplication
  // (chemin nouveau modèle).
  it('avoir puis régénération de facture : TAXE_SEJOUR jamais dupliquée (nouveau modèle)', async () => {
    const room = await createRoom();
    const checkinRes = await adminClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: isoDate(addDays(new Date(), 1)),
      guest: { nom: 'FIN102B', prenom: 'Avoir' },
      nombreOccupants: 1,
    });
    const stay = checkinRes.body as StayResponse;
    const principal = stay.folios.find((f) => f.libelle === 'Folio principal')!;

    const invoiceRes = await adminClient.post(
      `/api/invoices/generer?folioId=${principal.id}`,
    );
    expect(invoiceRes.status).toBe(201);
    const invoiceId = (invoiceRes.body as InvoiceResponse).id;

    const creditNoteRes = await adminClient
      .post(`/api/invoices/${invoiceId}/credit-notes`)
      .send({ motif: 'Test FIN-102B — avoir avant régénération' });
    expect(creditNoteRes.status).toBe(201);

    const regenRes = await adminClient.post(
      `/api/invoices/generer?folioId=${principal.id}`,
    );
    expect(regenRes.status).toBe(201);

    const lignesTaxe = await prisma.folioLine.count({
      where: { folioId: principal.id, type: TypeLigneFolio.TAXE_SEJOUR },
    });
    expect(lignesTaxe).toBe(1);
  });

  // Scénario 9 — fallback legacy (Stay.nombreOccupants IS NULL) : la
  // facturation matérialise TAXE_SEJOUR comme le comportement d'avant
  // FIN-102B (chemin volontairement distinct du check-in "nouveau modèle").
  it('fallback legacy (nombreOccupants NULL) : generateInvoice matérialise TAXE_SEJOUR comme avant FIN-102B', async () => {
    const room = await createRoom();
    const guest = await prisma.guest.create({
      data: { nom: 'FIN102B-Legacy', prenom: 'Fallback' },
    });
    const dateCheckin = new Date();
    const dateCheckoutPrevue = addDays(dateCheckin, 2);
    // Écriture Prisma directe, sans passer par StayService — reproduit un
    // séjour créé avant cette migration (nombreOccupants jamais renseigné).
    const stay = await prisma.stay.create({
      data: {
        roomId: room.id,
        guestId: guest.id,
        dateCheckin,
        dateCheckoutPrevue,
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
        montant: new Prisma.Decimal(2 * PRIX_BASE),
      },
    });

    const lignesAvant = await prisma.folioLine.count({
      where: { folioId: folio.id, type: TypeLigneFolio.TAXE_SEJOUR },
    });
    expect(lignesAvant).toBe(0);

    const invoiceRes = await adminClient.post(
      `/api/invoices/generer?folioId=${folio.id}`,
    );
    expect(invoiceRes.status).toBe(201);

    const taxeLigne = await prisma.folioLine.findFirstOrThrow({
      where: { folioId: folio.id, type: TypeLigneFolio.TAXE_SEJOUR },
    });
    // Fallback legacy : nbPersonnes = RoomType.capacite (proxy, comportement
    // identique à avant FIN-102B) = 4, jamais Stay.nombreOccupants (NULL).
    expect(Number(taxeLigne.montant)).toBe(2 * 4 * TAUX_TAXE_SEJOUR);
  });

  // Scénario 12 — taxe inactive jamais matérialisée.
  it('une taxe désactivée (actif: false) n’est jamais matérialisée au check-in', async () => {
    const taxeInactive = await prisma.taxRateConfig.create({
      data: {
        type: `TEST_FIN102B_INACTIVE_${Date.now()}`,
        mode: 'MONTANT_FIXE',
        taux: new Prisma.Decimal(5),
        actif: false,
        applicableParDefaut: true,
      },
    });

    const room = await createRoom();
    const res = await adminClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: isoDate(addDays(new Date(), 1)),
      guest: { nom: 'FIN102B', prenom: 'TaxeInactive' },
      nombreOccupants: 1,
    });
    expect(res.status).toBe(201);
    const stay = res.body as StayResponse;
    const principal = stay.folios.find((f) => f.libelle === 'Folio principal')!;

    const taxeLignes = principal.lignes.filter((l) => l.type === 'TAXE_SEJOUR');
    // Seule TAXE_SEJOUR (active) est matérialisée — jamais la taxe inactive.
    expect(taxeLignes).toHaveLength(1);
    expect(taxeLignes.every((l) => l.taxRateConfigId !== taxeInactive.id)).toBe(
      true,
    );

    await prisma.taxRateConfig.delete({ where: { id: taxeInactive.id } });
  });

  // Scénario 13 — plusieurs taxes applicables simultanément : une ligne par
  // taxe.
  it('deux taxes statutaires actives simultanément → une FolioLine par taxe au check-in', async () => {
    const taxeSupplementaire = await prisma.taxRateConfig.create({
      data: {
        type: `TEST_FIN102B_SUPPL_${Date.now()}`,
        mode: 'MONTANT_FIXE',
        taux: new Prisma.Decimal(2),
        actif: true,
        applicableParDefaut: true,
      },
    });

    const room = await createRoom();
    const res = await adminClient.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: isoDate(addDays(new Date(), 1)),
      guest: { nom: 'FIN102B', prenom: 'DeuxTaxes' },
      nombreOccupants: 1,
    });
    expect(res.status).toBe(201);
    const stay = res.body as StayResponse;
    const principal = stay.folios.find((f) => f.libelle === 'Folio principal')!;

    const taxeLignes = principal.lignes.filter((l) => l.type === 'TAXE_SEJOUR');
    expect(taxeLignes).toHaveLength(2);
    const ids = taxeLignes.map((l) => l.taxRateConfigId).sort();
    expect(ids).toEqual(
      [taxeSejourConfigId, taxeSupplementaire.id].sort((a, b) => a - b),
    );

    await prisma.taxRateConfig.delete({ where: { id: taxeSupplementaire.id } });
  });

  // Scénario 14 — un paiement/acompte déjà présent n'est jamais affecté par
  // la matérialisation de TAXE_SEJOUR au check-in ni par sa réconciliation
  // au départ anticipé.
  it('un acompte imputé au check-in reste intact après matérialisation de TAXE_SEJOUR et réconciliation au départ', async () => {
    const room = await createRoom();
    const today = new Date();
    const reservationRes = await adminClient.post('/api/reservations').send({
      roomId: room.id,
      dateArrivee: isoDate(today),
      dateDepart: isoDate(addDays(today, 3)),
      guest: { nom: 'FIN102B', prenom: 'Acompte' },
      nombreOccupants: 2,
    });
    const reservation = reservationRes.body as ReservationResponse;

    const depositRes = await adminClient
      .post(`/api/reservations/${reservation.id}/deposits`)
      .send({
        montant: '50.00',
        moyen: 'CARTE',
        idempotencyKey: `fin102b-deposit-${reservation.id}`,
      });
    expect(depositRes.status).toBe(201);

    const checkinRes = await adminClient
      .post(`/api/checkin/${reservation.id}`)
      .send();
    expect(checkinRes.status).toBe(201);
    const stay = checkinRes.body as StayResponse;
    const principal = stay.folios.find((f) => f.libelle === 'Folio principal')!;

    const paiementAvant = principal.lignes.find((l) => l.type === 'PAIEMENT')!;
    expect(Number(paiementAvant.montant)).toBe(50);

    const hebergement = principal.lignes.find((l) => l.type === 'HEBERGEMENT')!;
    const taxeInitiale = principal.lignes.find(
      (l) => l.type === 'TAXE_SEJOUR',
    )!;
    // Couvre HEBERGEMENT + la taxe TELLE QUE matérialisée au check-in (3
    // nuits) moins l'acompte déjà imputé : que la réconciliation au départ
    // anticipé réduise ensuite la taxe due (départ le jour même) ne peut
    // jamais faire apparaître un solde positif — seulement un solde encore
    // plus négatif, jamais bloquant.
    const montantRestant =
      Number(hebergement.montant) + Number(taxeInitiale.montant) - 50;
    const paymentRes = await adminClient.post('/api/payments').send({
      folioId: principal.id,
      moyen: 'ESPECES',
      montant: montantRestant.toFixed(2),
      idempotencyKey: `fin102b-solde-${stay.id}`,
    });
    expect(paymentRes.status).toBe(201);

    const checkoutRes = await adminClient
      .post(`/api/checkout/${stay.id}`)
      .send();
    expect(checkoutRes.status).toBe(201);

    const paiementApres = await prisma.folioLine.findFirstOrThrow({
      where: { id: paiementAvant.id },
    });
    expect(paiementApres.annulee).toBe(false);
    expect(Number(paiementApres.montant)).toBe(50);
  });
});
