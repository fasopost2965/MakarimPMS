import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs } from './helpers/auth';

interface ReservationResponse {
  id: number;
  prixTotalCalcule: string;
  prixTotalFinal: string;
  ajustementManuel: boolean;
  motifAjustement: string | null;
}

// Tarification saisonnière (cahier des charges §5.1/§5.4) : vérifie le calcul
// nuit par nuit contre une vraie base MySQL (docker-compose), avec des
// tarifs saisonniers isolés (pas ceux du seed) pour un test reproductible.
describe('Reservations — tarification saisonnière (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roomTypeId: number;
  let roomId: number;
  let client: ReturnType<typeof authedRequest>;

  const PRIX_BASE = 500;
  const PRIX_SAISON_1 = 600;
  const PRIX_SAISON_2 = 700;

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
      data: { nom: 'TEST-PRICING-TYPE', prixBase: PRIX_BASE, capacite: 2 },
    });
    roomTypeId = roomType.id;

    await prisma.seasonRate.createMany({
      data: [
        {
          roomTypeId,
          libelle: 'Haute saison 1',
          dateDebut: new Date('2026-07-01'),
          dateFin: new Date('2026-07-19'),
          prixNuit: PRIX_SAISON_1,
        },
        {
          roomTypeId,
          libelle: 'Haute saison 2',
          dateDebut: new Date('2026-07-20'),
          dateFin: new Date('2026-08-31'),
          prixNuit: PRIX_SAISON_2,
        },
      ],
    });

    const room = await prisma.room.create({
      data: { numero: `TEST-PRICING-${Date.now()}`, roomTypeId },
    });
    roomId = room.id;
  });

  afterAll(async () => {
    await prisma.roomNight.deleteMany({ where: { roomId } });
    await prisma.reservation.deleteMany({ where: { roomId } });
    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.seasonRate.deleteMany({ where: { roomTypeId } });
    await prisma.roomType.deleteMany({ where: { id: roomTypeId } });
    await app.close();
  });

  it('calcule le prix nuit par nuit pour une réservation à cheval sur deux saisons', async () => {
    // 18, 19 juillet -> Haute saison 1 (600) ; 20, 21 juillet -> Haute
    // saison 2 (700). dateDepart = 22 (exclue, jour de départ non facturé).
    const res = await client.post('/api/reservations').send({
      roomId,
      dateArrivee: '2026-07-18',
      dateDepart: '2026-07-22',
      guest: { nom: 'Cheval', prenom: 'Saisons' },
    });
    const body = res.body as ReservationResponse;

    expect(res.status).toBe(201);
    expect(Number(body.prixTotalCalcule)).toBe(
      2 * PRIX_SAISON_1 + 2 * PRIX_SAISON_2,
    );
    expect(Number(body.prixTotalFinal)).toBe(
      2 * PRIX_SAISON_1 + 2 * PRIX_SAISON_2,
    );
    expect(body.ajustementManuel).toBe(false);

    await prisma.roomNight.deleteMany({ where: { reservationId: body.id } });
    await prisma.reservation.delete({ where: { id: body.id } });
  });

  it('retombe sur RoomType.prixBase pour une nuit hors de toute plage SeasonRate', async () => {
    // 28, 29, 30 juin -> aucune plage ne couvre ces dates (la première
    // commence le 1er juillet) -> tarif de base.
    const res = await client.post('/api/reservations').send({
      roomId,
      dateArrivee: '2026-06-28',
      dateDepart: '2026-07-01',
      guest: { nom: 'Hors', prenom: 'Saison' },
    });
    const body = res.body as ReservationResponse;

    expect(res.status).toBe(201);
    expect(Number(body.prixTotalCalcule)).toBe(3 * PRIX_BASE);

    await prisma.roomNight.deleteMany({ where: { reservationId: body.id } });
    await prisma.reservation.delete({ where: { id: body.id } });
  });

  it('marque ajustementManuel à true quand la réception modifie prixTotalFinal, sans jamais recalculer prixTotalCalcule', async () => {
    const created = await client.post('/api/reservations').send({
      roomId,
      dateArrivee: '2026-07-18',
      dateDepart: '2026-07-20',
      guest: { nom: 'Ajustement', prenom: 'Manuel' },
    });
    const createdBody = created.body as ReservationResponse;
    const reservationId = createdBody.id;
    const prixCalculeInitial = createdBody.prixTotalCalcule;

    const patched = await client
      .patch(`/api/reservations/${reservationId}`)
      .send({ prixTotalFinal: 1000, motifAjustement: 'Geste commercial' });
    const patchedBody = patched.body as ReservationResponse;

    expect(patched.status).toBe(200);
    expect(patchedBody.prixTotalCalcule).toBe(prixCalculeInitial);
    expect(Number(patchedBody.prixTotalFinal)).toBe(1000);
    expect(patchedBody.ajustementManuel).toBe(true);
    expect(patchedBody.motifAjustement).toBe('Geste commercial');

    // Déplacer la réservation (chambre inchangée mais dates décalées) ne
    // doit pas écraser silencieusement l'ajustement manuel déjà en place.
    const moved = await client
      .patch(`/api/reservations/${reservationId}`)
      .send({ dateArrivee: '2026-07-19', dateDepart: '2026-07-21' });
    const movedBody = moved.body as ReservationResponse;

    expect(moved.status).toBe(200);
    expect(Number(movedBody.prixTotalFinal)).toBe(1000);
    expect(movedBody.ajustementManuel).toBe(true);
    // prixTotalCalcule, lui, reflète toujours la période courante.
    expect(Number(movedBody.prixTotalCalcule)).toBe(
      PRIX_SAISON_1 + PRIX_SAISON_2,
    );

    await prisma.roomNight.deleteMany({ where: { reservationId } });
    await prisma.reservation.delete({ where: { id: reservationId } });
  });
});
