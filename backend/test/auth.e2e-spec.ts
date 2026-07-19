/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs, SEED_USERS } from './helpers/auth';

// Module core (5.1/5.2/5.2.1) : auth JWT + rôles/permissions. Vérifie les
// deux garanties non négociables demandées explicitement — route protégée
// sans token => 401, rôle sans la permission requise => 403 — ainsi que le
// cycle complet login/refresh/forgot-password/reset-password. Vrais appels
// HTTP contre une vraie base MySQL, aucun mock.
describe('Auth — JWT, rôles et permissions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  describe('Protection des routes (JwtAuthGuard + PermissionsGuard)', () => {
    it('renvoie 401 sur une route protégée sans token', async () => {
      const res = await request(server()).get('/api/dashboard/resume');
      expect(res.status).toBe(401);
    });

    it('renvoie 401 avec un token invalide/mal formé', async () => {
      const res = await request(server())
        .get('/api/dashboard/resume')
        .set('Authorization', 'Bearer ceci-nest-pas-un-jwt-valide');
      expect(res.status).toBe(401);
    });

    it("renvoie 403 quand le rôle authentifié n'a pas la permission requise", async () => {
      // Gouvernante n'a que housekeeping:read/write (voir prisma/seed.ts) —
      // pas d'accès à billing.
      const token = await loginAs(server(), 'gouvernante');
      const client = authedRequest(server(), token);
      const res = await client.get('/api/invoices/1');
      expect(res.status).toBe(403);
    });

    it('autorise une route protégée avec un token valide et la bonne permission', async () => {
      const token = await loginAs(server(), 'gouvernante');
      const client = authedRequest(server(), token);
      const res = await client.get('/api/rooms');
      expect(res.status).toBe(200);
    });

    it('les routes publiques du module auth restent accessibles sans token', async () => {
      const res = await request(server()).get('/api/auth/roles-actifs');
      expect(res.status).toBe(200);
    });
  });

  describe('Connexion (POST /auth/login)', () => {
    it('renvoie un access token et un refresh token pour des identifiants valides', async () => {
      const res = await request(server()).post('/api/auth/login').send({
        email: SEED_USERS.admin,
        motDePasse: 'Password123!',
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('renvoie 401 pour un mot de passe incorrect, et journalise la tentative en échec', async () => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: SEED_USERS.admin },
      });
      const logsBefore = await prisma.loginLog.count({
        where: { userId: user.id, succes: false },
      });

      const res = await request(server()).post('/api/auth/login').send({
        email: SEED_USERS.admin,
        motDePasse: 'mauvais-mot-de-passe',
      });
      expect(res.status).toBe(401);

      const logsAfter = await prisma.loginLog.count({
        where: { userId: user.id, succes: false },
      });
      expect(logsAfter).toBe(logsBefore + 1);
    });

    it('renvoie 401 pour un email inconnu', async () => {
      const res = await request(server()).post('/api/auth/login').send({
        email: 'personne@makarim.test',
        motDePasse: 'Password123!',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('Rafraîchissement (POST /auth/refresh)', () => {
    it('émet un nouveau access token à partir d’un refresh token valide', async () => {
      const login = await request(server()).post('/api/auth/login').send({
        email: SEED_USERS.reception,
        motDePasse: 'Password123!',
      });
      const { refreshToken } = login.body as { refreshToken: string };

      const refreshed = await request(server())
        .post('/api/auth/refresh')
        .send({ refreshToken });
      expect(refreshed.status).toBe(201);
      expect(refreshed.body).toHaveProperty('accessToken');

      // Le nouveau token fonctionne bien sur une route protégée.
      const client = authedRequest(
        server(),
        (refreshed.body as { accessToken: string }).accessToken,
      );
      const res = await client.get('/api/reservations/arrivees-du-jour');
      expect(res.status).toBe(200);
    });

    it('renvoie 401 pour un refresh token invalide', async () => {
      const res = await request(server())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'jeton-invalide' });
      expect(res.status).toBe(401);
    });

    it('un access token ne peut pas être utilisé comme refresh token (secrets distincts)', async () => {
      const login = await request(server()).post('/api/auth/login').send({
        email: SEED_USERS.reception,
        motDePasse: 'Password123!',
      });
      const { accessToken } = login.body as { accessToken: string };

      const refreshed = await request(server())
        .post('/api/auth/refresh')
        .send({ refreshToken: accessToken });
      expect(refreshed.status).toBe(401);
    });
  });

  describe('Mot de passe oublié (POST /auth/forgot-password + reset-password)', () => {
    it('génère un jeton à usage unique pour un compte existant', async () => {
      const res = await request(server())
        .post('/api/auth/forgot-password')
        .send({ email: SEED_USERS.comptable });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('resetToken');
      expect(res.body).toHaveProperty('expiresAt');
    });

    it('ne révèle pas si un email est inconnu (même message, pas de resetToken)', async () => {
      const res = await request(server())
        .post('/api/auth/forgot-password')
        .send({ email: 'inconnu@makarim.test' });
      expect(res.status).toBe(201);
      expect(res.body).not.toHaveProperty('resetToken');
    });

    it('permet de définir un nouveau mot de passe avec un jeton valide, puis le rejette à la deuxième utilisation', async () => {
      const forgot = await request(server())
        .post('/api/auth/forgot-password')
        .send({ email: SEED_USERS.maintenance });
      const { resetToken } = forgot.body as { resetToken: string };

      const reset = await request(server())
        .post('/api/auth/reset-password')
        .send({ token: resetToken, nouveauMotDePasse: 'NouveauMdp123!' });
      expect(reset.status).toBe(201);

      // Le nouveau mot de passe fonctionne.
      const loginNew = await request(server()).post('/api/auth/login').send({
        email: SEED_USERS.maintenance,
        motDePasse: 'NouveauMdp123!',
      });
      expect(loginNew.status).toBe(201);

      // L'ancien mot de passe ne fonctionne plus.
      const loginOld = await request(server()).post('/api/auth/login').send({
        email: SEED_USERS.maintenance,
        motDePasse: 'Password123!',
      });
      expect(loginOld.status).toBe(401);

      // Le jeton est à usage unique : une deuxième tentative est refusée.
      const reuse = await request(server())
        .post('/api/auth/reset-password')
        .send({ token: resetToken, nouveauMotDePasse: 'AutreMdp456!' });
      expect(reuse.status).toBe(400);

      // Remettre le mot de passe de seed pour ne pas perturber d'autres
      // suites qui s'authentifient avec ce compte (maintenance.e2e-spec.ts,
      // module 5.8) — l'ordre d'exécution des fichiers par Jest n'est pas
      // garanti alphabétique, donc laisser le mot de passe modifié ferait
      // échouer maintenance.e2e-spec.ts de façon intermittente selon l'ordre.
      const restore = await request(server())
        .post('/api/auth/forgot-password')
        .send({ email: SEED_USERS.maintenance });
      const { resetToken: restoreToken } = restore.body as {
        resetToken: string;
      };
      await request(server())
        .post('/api/auth/reset-password')
        .send({ token: restoreToken, nouveauMotDePasse: 'Password123!' });
    });

    it('rejette un jeton invalide', async () => {
      const res = await request(server())
        .post('/api/auth/reset-password')
        .send({ token: 'jeton-inexistant', nouveauMotDePasse: 'Xxxxxxxx1!' });
      expect(res.status).toBe(400);
    });
  });

  describe('Rôles actifs (GET /auth/roles-actifs)', () => {
    it('ne renvoie que les rôles ayant au moins une permission accordée', async () => {
      const res = await request(server()).get('/api/auth/roles-actifs');
      expect(res.status).toBe(200);
      const noms = (res.body as { nom: string }[]).map((r) => r.nom);
      expect(noms).toEqual(
        expect.arrayContaining([
          'Administrateur',
          'Réception',
          'Gouvernante',
          'Comptable',
          'Maintenance',
        ]),
      );
      // RH existe en base (seed) mais sans permission accordée tant que le
      // module RH n'est pas construit : ne doit pas apparaître sur la
      // landing page. Maintenance, lui, est actif depuis le module 5.8.
      expect(noms).not.toContain('RH');
    });
  });
});
