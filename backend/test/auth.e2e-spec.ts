/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { MailerService } from './../src/modules/notifications/mailer.service';
import { authedRequest, loginAs, SEED_USERS } from './helpers/auth';

// Stockage de secours jamais bloquant, en remplacement du
// ThrottlerStorageService en mémoire par défaut — voir commentaire dans
// beforeAll ci-dessous pour la justification complète.
class NeverBlockingThrottlerStorage implements ThrottlerStorage {
  increment(): Promise<ThrottlerStorageRecord> {
    return Promise.resolve({
      totalHits: 1,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  }
}

// Module core (5.1/5.2/5.2.1) : auth JWT + rôles/permissions. Vérifie les
// deux garanties non négociables demandées explicitement — route protégée
// sans token => 401, rôle sans la permission requise => 403 — ainsi que le
// cycle complet login/refresh/forgot-password/reset-password. Vrais appels
// HTTP contre une vraie base MySQL, aucun mock.
describe('Auth — JWT, rôles et permissions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mailerService: MailerService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Ce fichier exerce /auth/login et /auth/refresh bien plus de 5 fois
      // (limite réelle, AuthController @Throttle) en quelques secondes —
      // légitime pour tester le cycle JWT complet, mais ça faisait échouer
      // les tests suivants avec un 429 (voire un 400 en cascade, le corps
      // {message:"Too Many Requests"} n'ayant pas de refreshToken/
      // accessToken à renvoyer à /refresh). Ce fichier teste la sémantique
      // JWT, pas le rate limiting — aucune autre suite e2e n'exerce le
      // comportement 429 lui-même, donc neutraliser le stockage ici ne
      // fait perdre aucune couverture. La limite de 5/min réelle reste
      // inchangée en production (AuthController).
      //
      // Note : overrideGuard(ThrottlerGuard) ne suffit PAS ici — ThrottlerGuard
      // n'est enregistré que via { provide: APP_GUARD, useClass: ThrottlerGuard }
      // dans AppModule (vérifié en le sabotant : le override restait sans
      // effet, x-ratelimit-limit continuait d'apparaître et le 429 persistait).
      // ThrottlerStorage, en revanche, est son propre token de provider
      // (fourni indépendamment par ThrottlerModule), donc bien overridable.
      .overrideProvider(ThrottlerStorage)
      .useClass(NeverBlockingThrottlerStorage)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    mailerService = app.get(MailerService);
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
    // CH-002 (docs/governance/REGISTRE_CHANTIERS.md) : le jeton n'est plus
    // jamais exposé dans la réponse HTTP (envoyé par email désormais, voir
    // AuthService.forgotPassword) — ces tests le relisent directement en
    // base (vraie base MySQL, pas un mock) plutôt que dans le corps de la
    // réponse, exactement comme le ferait un utilisateur consultant sa
    // boîte mail.
    async function latestTokenFor(email: string): Promise<string> {
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const record = await prisma.passwordResetToken.findFirstOrThrow({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      return record.token;
    }

    it('renvoie un message générique sans jamais exposer de jeton, et envoie le jeton par email, pour un compte existant', async () => {
      const sendSpy = jest
        .spyOn(mailerService, 'send')
        .mockImplementation(() => Promise.resolve());
      try {
        const res = await request(server())
          .post('/api/auth/forgot-password')
          .send({ email: SEED_USERS.comptable });
        expect(res.status).toBe(201);
        expect(res.body).not.toHaveProperty('resetToken');
        expect(res.body).not.toHaveProperty('expiresAt');
        expect(res.body).toHaveProperty('message');

        // Le jeton existe bien en base (envoyé par email, jamais dans la
        // réponse HTTP) — sabotage/restore : si le jeton n'était plus créé
        // du tout, cette relecture échouerait (findFirstOrThrow), ce qui
        // distingue "jeton créé mais pas exposé" de "jeton jamais créé".
        const token = await latestTokenFor(SEED_USERS.comptable);
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);

        // MailerService.send() est bien appelé avec l'adresse du compte et
        // un corps contenant le jeton fraîchement créé — preuve que le
        // jeton part réellement par email plutôt que d'être simplement
        // écrit en base sans être communiqué à personne.
        expect(sendSpy).toHaveBeenCalledTimes(1);
        const [to, subject, html] = sendSpy.mock.calls[0];
        expect(to).toBe(SEED_USERS.comptable);
        expect(subject).toMatch(/réinitialisation/i);
        expect(html).toContain(token);
      } finally {
        sendSpy.mockRestore();
      }
    });

    it('ne révèle pas si un email est inconnu — réponse strictement identique (même forme) au cas existant, et n’envoie aucun email', async () => {
      const sendSpy = jest
        .spyOn(mailerService, 'send')
        .mockImplementation(() => Promise.resolve());
      try {
        const res = await request(server())
          .post('/api/auth/forgot-password')
          .send({ email: 'inconnu@makarim.test' });
        expect(res.status).toBe(201);
        expect(res.body).not.toHaveProperty('resetToken');
        expect(res.body).not.toHaveProperty('expiresAt');
        expect(Object.keys(res.body as object)).toEqual(['message']);
        expect(sendSpy).not.toHaveBeenCalled();
      } finally {
        sendSpy.mockRestore();
      }
    });

    it('permet de définir un nouveau mot de passe avec un jeton valide, puis le rejette à la deuxième utilisation', async () => {
      await request(server())
        .post('/api/auth/forgot-password')
        .send({ email: SEED_USERS.maintenance });
      const resetToken = await latestTokenFor(SEED_USERS.maintenance);

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
      await request(server())
        .post('/api/auth/forgot-password')
        .send({ email: SEED_USERS.maintenance });
      const restoreToken = await latestTokenFor(SEED_USERS.maintenance);
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
          // RH actif depuis le module 5.11 (Sprint 11) — voir seed.ts.
          'RH',
        ]),
      );
    });
  });
});
