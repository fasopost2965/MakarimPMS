import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

interface ReservationResponse {
  id: number;
  statut: string;
  prixTotalFinal: string;
}

interface FolioLineResponse {
  type: string;
  montant: string;
}

interface FolioResponse {
  libelle: string;
  lignes: FolioLineResponse[];
}

interface StayResponse {
  id: number;
  statut: string;
  roomId: number;
  reservationId: number | null;
  folios: FolioResponse[];
  soldeDu?: string;
}

// Cycle de vie complet réservation -> séjour -> check-out (cahier des
// charges §5.5), contre une vraie base MySQL. Vérifie en particulier la
// règle non négociable : la ligne HEBERGEMENT du folio principal reprend
// prixTotalFinal tel quel, jamais un recalcul indépendant (CLAUDE.md règle
// 3 — voir aussi le module reservations, tarification saisonnière).
describe('Checkin — cycle réservation → séjour → check-out (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roomTypeId: number;
  let client: ReturnType<typeof authedRequest>;

  const PRIX_BASE = 400;
  const PRIX_SAISON = 550;

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
    const token = await loginAs(app.getHttpServer(), 'reception');
    client = authedRequest(app.getHttpServer(), token);

    const roomType = await prisma.roomType.create({
      data: { nom: 'TEST-CHECKIN-FLOW-TYPE', prixBase: PRIX_BASE, capacite: 2 },
    });
    roomTypeId = roomType.id;

    await prisma.seasonRate.create({
      data: {
        roomTypeId,
        libelle: 'Haute saison test-checkin',
        dateDebut: new Date('2027-04-01'),
        dateFin: new Date('2027-04-30'),
        prixNuit: PRIX_SAISON,
      },
    });
  });

  afterAll(async () => {
    await prisma.roomNight.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.folioLine.deleteMany({
      where: { folio: { stay: { room: { roomTypeId } } } },
    });
    await prisma.folio.deleteMany({
      where: { stay: { room: { roomTypeId } } },
    });
    await prisma.stay.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.reservation.deleteMany({ where: { room: { roomTypeId } } });
    await prisma.room.deleteMany({ where: { roomTypeId } });
    await prisma.seasonRate.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  it('reprend prixTotalFinal (ajusté manuellement) dans la ligne HEBERGEMENT, et libère la chambre au check-out', async () => {
    const room = await prisma.room.create({
      data: { numero: `TEST-CHECKIN-FLOW-${Date.now()}`, roomTypeId },
    });

    const created = await client.post('/api/reservations').send({
      roomId: room.id,
      dateArrivee: '2027-04-10',
      dateDepart: '2027-04-12',
      guest: { nom: 'Flow', prenom: 'Checkin' },
    });
    const reservation = created.body as ReservationResponse;
    expect(Number(reservation.prixTotalFinal)).toBe(PRIX_SAISON * 2);

    // Ajustement manuel avant le check-in : la ligne HEBERGEMENT doit
    // reprendre CETTE valeur, pas prixTotalCalcule.
    const patched = await client
      .patch(`/api/reservations/${reservation.id}`)
      .send({ prixTotalFinal: 900, motifAjustement: 'Geste commercial' });
    expect(Number((patched.body as ReservationResponse).prixTotalFinal)).toBe(
      900,
    );

    const checkin = await client.post(`/api/checkin/${reservation.id}`).send();
    expect(checkin.status).toBe(201);
    const stay = checkin.body as StayResponse;
    expect(stay.reservationId).toBe(reservation.id);

    const principal = stay.folios.find((f) => f.libelle === 'Folio principal');
    expect(principal).toBeDefined();
    expect(principal!.lignes).toHaveLength(1);
    expect(principal!.lignes[0].type).toBe('HEBERGEMENT');
    expect(Number(principal!.lignes[0].montant)).toBe(900);

    // La réservation d'origine est marquée transformée, et une chambre
    // occupée doit refuser une nouvelle vente sur les mêmes dates tant que
    // le séjour est en cours.
    const reservationAfter = await client.get(
      `/api/reservations/${reservation.id}`,
    );
    expect((reservationAfter.body as ReservationResponse).statut).toBe(
      'TRANSFORMEE_EN_SEJOUR',
    );

    const blockedBooking = await client.post('/api/reservations').send({
      roomId: room.id,
      dateArrivee: '2027-04-10',
      dateDepart: '2027-04-12',
      guest: { nom: 'Refuse', prenom: 'CarOccupe' },
    });
    expect(blockedBooking.status).toBe(409);

    const checkout = await client.post(`/api/checkout/${stay.id}`).send();
    expect(checkout.status).toBe(201);
    const checkedOut = checkout.body as StayResponse;
    expect(checkedOut.statut).toBe('CHECKOUT');
    // Aucun paiement encore enregistré (module billing pas encore livré) :
    // le solde dû est intégralement la ligne HEBERGEMENT ajustée.
    expect(Number(checkedOut.soldeDu)).toBe(900);

    // La chambre redevient réservable après le check-out.
    const rebooking = await client.post('/api/reservations').send({
      roomId: room.id,
      dateArrivee: '2027-04-10',
      dateDepart: '2027-04-12',
      guest: { nom: 'Nouvelle', prenom: 'Vente' },
    });
    expect(rebooking.status).toBe(201);
    await prisma.roomNight.deleteMany({
      where: { reservationId: (rebooking.body as ReservationResponse).id },
    });
    await prisma.reservation.delete({
      where: { id: (rebooking.body as ReservationResponse).id },
    });
  });

  it('calcule le prix du folio HEBERGEMENT selon la tarification saisonnière pour un check-in walk-in', async () => {
    const room = await prisma.room.create({
      data: { numero: `TEST-CHECKIN-WI-${Date.now()}`, roomTypeId },
    });

    // Se caler sur une date de check-in future n'est pas possible (le
    // service utilise "aujourd'hui" comme première nuit) : on vérifie donc
    // uniquement que la ligne HEBERGEMENT est cohérente avec le nombre de
    // nuits réellement verrouillées, pas un montant fixe.
    const dateCheckoutPrevue = new Date();
    dateCheckoutPrevue.setUTCDate(dateCheckoutPrevue.getUTCDate() + 3);

    const res = await client.post('/api/checkin/walk-in').send({
      roomId: room.id,
      dateCheckoutPrevue: dateCheckoutPrevue.toISOString().slice(0, 10),
      guest: { nom: 'Walk', prenom: 'In' },
    });
    expect(res.status).toBe(201);
    const stay = res.body as StayResponse;

    const nights = await prisma.roomNight.findMany({
      where: { stayId: stay.id },
    });
    expect(nights).toHaveLength(3);

    const principal = stay.folios.find((f) => f.libelle === 'Folio principal');
    // Toutes les nuits sont hors de la plage SeasonRate définie plus haut
    // (avril 2027) : le montant doit retomber sur PRIX_BASE * nb nuits.
    expect(Number(principal!.lignes[0].montant)).toBe(PRIX_BASE * 3);

    await prisma.roomNight.deleteMany({ where: { stayId: stay.id } });
    await prisma.folioLine.deleteMany({
      where: { folio: { stayId: stay.id } },
    });
    await prisma.folio.deleteMany({ where: { stayId: stay.id } });
    await prisma.stay.delete({ where: { id: stay.id } });
  });
});
