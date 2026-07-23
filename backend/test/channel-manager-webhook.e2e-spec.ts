import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// CH-026(b) (docs/governance/REGISTRE_CHANTIERS.md) — comparaison à temps
// constant du secret webhook (ChannelWebhookGuard). Vérifie uniquement le
// comportement de la garde elle-même (401 sans secret / secret invalide,
// franchissement de la garde avec le bon secret) — le module
// channel-manager n'avait jusqu'ici aucune suite e2e (gap pré-existant,
// hors périmètre de ce chantier ; seule la garde, modifiée par CH-026(b),
// est couverte ici).
describe('Channel Manager — garde webhook à temps constant (e2e)', () => {
  let app: INestApplication<App>;
  // Fixé par le test lui-même plutôt que relu depuis backend/.env : CI ne
  // fournit pas de CHANNEL_WEBHOOK_SECRET dans son bloc `env:` (voir
  // .github/workflows/ci.yml, même raison que ENCRYPTION_KEY — une valeur
  // propre à CI, sans rapport avec celle du .env de dev). dotenv (utilisé
  // par ConfigModule.forRoot()) ne réécrit jamais une variable déjà
  // présente dans process.env, donc l'affecter avant `compile()` garantit
  // que ChannelWebhookGuard lira cette valeur, en local comme en CI.
  const webhookSecret = 'ci-e2e-webhook-secret';

  beforeAll(async () => {
    process.env.CHANNEL_WEBHOOK_SECRET = webhookSecret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('rejette une requête webhook sans en-tête de secret', async () => {
    const res = await request(server())
      .post('/api/channel-manager/BOOKING_COM/reservations')
      .send({});
    expect(res.status).toBe(401);
  });

  it('rejette un secret invalide, que sa longueur diffère ou coïncide avec celle du secret attendu', async () => {
    const wrongLength = await request(server())
      .post('/api/channel-manager/BOOKING_COM/reservations')
      .set('X-Channel-Webhook-Secret', 'trop-court')
      .send({});
    expect(wrongLength.status).toBe(401);

    const sameLength = await request(server())
      .post('/api/channel-manager/BOOKING_COM/reservations')
      .set('X-Channel-Webhook-Secret', 'x'.repeat(webhookSecret.length))
      .send({});
    expect(sameLength.status).toBe(401);
  });

  it('laisse passer une requête avec le bon secret (échec de validation DTO en aval, jamais 401 — preuve que la garde n’est plus le point de blocage)', async () => {
    const res = await request(server())
      .post('/api/channel-manager/BOOKING_COM/reservations')
      .set('X-Channel-Webhook-Secret', webhookSecret)
      .send({});
    // Corps vide invalide au sens du DTO (ChannelReservationWebhookDto,
    // champs requis manquants) => 400, jamais 401 : la garde a bien
    // authentifié la requête avant que la validation ne s'exécute.
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(400);
  });
});
