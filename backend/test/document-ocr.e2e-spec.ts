import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './../src/app.module';
import { authedRequest, loginAs } from './helpers/auth';

// F5/CH-022 (docs/governance/REGISTRE_CHANTIERS.md) — première suite e2e
// pour ce module (gap pré-existant, jamais couvert jusqu'ici). Écrite en
// implémentant le frontend (CH-022) après avoir découvert, en testant
// l'écran en navigateur réel, qu'une image corrompue faisait planter tout
// le process backend (pas seulement la requête HTTP) — voir le correctif
// dans DocumentOcrService (errorHandler + try/catch autour de
// worker.recognize). Ce fichier verrouille cette régression.
describe('Document OCR (e2e)', () => {
  let app: INestApplication;
  let client: ReturnType<typeof authedRequest>;

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

    const token = await loginAs(app.getHttpServer(), 'reception');
    client = authedRequest(app.getHttpServer(), token);
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it(
    'renvoie 400 (pas un crash serveur) sur une image corrompue/illisible — ' +
      'preuve de sabotage/restore : ce test échouait par timeout/ECONNRESET ' +
      'avant le correctif errorHandler+try/catch de DocumentOcrService, ' +
      'confirmé en local en retirant temporairement ce correctif',
    async () => {
      const imageCorrompue = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00]);

      const res = await client
        .post('/api/document-ocr/scan')
        .attach('fichier', imageCorrompue, {
          filename: 'corrompu.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);

      // Preuve que le serveur est resté vivant : un appel normal juste
      // après doit encore répondre (si le process avait crashé, cette
      // requête échouerait par ECONNREFUSED).
      const health = await client.get('/api/auth/me');
      expect(health.status).toBe(200);
    },
    30_000,
  );

  it('extrait un résultat exploitable (sans erreur serveur) sur une image valide sans zone MRZ, avec avertissement explicite', async () => {
    const imageValide = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'document-ocr-sample.jpg'),
    );

    const res = await client
      .post('/api/document-ocr/scan')
      .attach('fichier', imageValide, {
        filename: 'sample.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(201);
    const body = res.body as {
      formatDetecte: string | null;
      checksumValide: boolean;
      avertissement?: string;
      texteBrutOcr: string;
    };
    expect(body.formatDetecte).toBeNull();
    expect(body.checksumValide).toBe(false);
    expect(body.avertissement).toMatch(/MRZ/i);
    expect(typeof body.texteBrutOcr).toBe('string');
  }, 30_000);

  it('rejette une requête sans fichier (400)', async () => {
    const res = await client.post('/api/document-ocr/scan').send();
    expect(res.status).toBe(400);
  });

  it('exige guests:write (403 pour un rôle sans cette permission)', async () => {
    const maintenanceToken = await loginAs(app.getHttpServer(), 'maintenance');
    const maintenanceClient = authedRequest(
      app.getHttpServer(),
      maintenanceToken,
    );
    const res = await maintenanceClient
      .post('/api/document-ocr/scan')
      .attach('fichier', Buffer.from([0xff, 0xd8, 0xff]), {
        filename: 'x.jpg',
        contentType: 'image/jpeg',
      });
    expect(res.status).toBe(403);
  });
});
