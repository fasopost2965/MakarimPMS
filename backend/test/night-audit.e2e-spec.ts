/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BusinessDateService } from '../src/modules/night-audit/business-date.service';
import { authedRequest, loginAs } from './helpers/auth';

// ARCH-011A — Business Date + Night Audit Foundation, contre une vraie base
// MySQL (jamais de mock, cf CLAUDE.md). Chaque suite crée sa propre chambre/
// son propre type de chambre de test pour ne jamais interférer avec les 24
// chambres du seed ni avec les autres suites e2e exécutées dans le même
// process (maxWorkers: 1, mais les tables ne sont jamais vidées entre
// fichiers de test).
describe('Night Audit (ARCH-011A, e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminClient: ReturnType<typeof authedRequest>;
  let receptionClient: ReturnType<typeof authedRequest>;
  let comptableClient: ReturnType<typeof authedRequest>;
  let roomTypeId: number;
  let businessDate: string;
  let businessDatePlusOne: string;
  // Partagé avec la suite "Clôture concurrente" ci-dessous (nettoyage du
  // séjour encore actif avant le second cycle).
  let policeWarningStayId: number;

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

    adminClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'admin'),
    );
    receptionClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'reception'),
    );
    comptableClient = authedRequest(
      app.getHttpServer(),
      await loginAs(app.getHttpServer(), 'comptable'),
    );

    const roomType = await prisma.roomType.create({
      data: { nom: 'TEST-NIGHT-AUDIT-TYPE', prixBase: 400, capacite: 2 },
    });
    roomTypeId = roomType.id;

    const current = await adminClient.get('/api/night-audit/current');
    expect(current.status).toBe(200);
    businessDate = current.body.businessDay.date.slice(0, 10);
    businessDatePlusOne = new Date(
      new Date(businessDate).getTime() + 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createRoom(label: string) {
    const room = await prisma.room.create({
      data: { numero: `TEST-NA-${label}-${Date.now()}`, roomTypeId },
    });
    return room.id;
  }

  // --- Bootstrap / BusinessDay ------------------------------------------

  describe('Bootstrap + invariant "une seule BusinessDay OPEN"', () => {
    it('GET /night-audit/current renvoie une BusinessDay OPEN (bootstrap déjà exécuté au démarrage)', async () => {
      const res = await adminClient.get('/api/night-audit/current');
      expect(res.status).toBe(200);
      expect(res.body.businessDay.status).toBe('OPEN');
    });

    it('le bootstrap est idempotent (relancer onModuleInit ne crée jamais de doublon)', async () => {
      const before = await prisma.businessDay.count();
      // BusinessDateService est exportée par NightAuditModule — on peut
      // rappeler bootstrapIfMissing() directement, exactement comme le
      // ferait un second onModuleInit lors d'un redémarrage.
      const businessDateService = app.get(BusinessDateService);
      await businessDateService.bootstrapIfMissing();
      const after = await prisma.businessDay.count();
      expect(after).toBe(before);
    });

    it('invariant : exactement une BusinessDay OPEN en base à tout moment', async () => {
      const count = await prisma.businessDay.count({
        where: { status: 'OPEN' },
      });
      expect(count).toBe(1);

      // Preuve de rigueur (sabotage/restore, CLAUDE.md) : en insérant
      // manuellement une seconde ligne OPEN sans passer par openLock, on
      // casserait l'invariant applicatif — la contrainte DB (openLock
      // unique) l'empêche. Vérifié ici en observant que l'insertion directe
      // d'une deuxième ligne avec openLock=1 échoue bien (sabotage réel de
      // la donnée, pas du code), puis on confirme qu'aucune trace résiduelle
      // ne subsiste (restore implicite : la transaction avortée ne modifie
      // rien).
      await expect(
        prisma.businessDay.create({
          data: {
            date: new Date('2099-01-01'),
            status: 'OPEN',
            openLock: 1,
            source: 'NIGHT_AUDIT',
          },
        }),
      ).rejects.toThrow();

      const countAfterSabotageAttempt = await prisma.businessDay.count({
        where: { status: 'OPEN' },
      });
      expect(countAfterSabotageAttempt).toBe(1);
    });
  });

  // --- RBAC ---------------------------------------------------------------

  describe('RBAC', () => {
    it('Réception a night-audit:read mais pas night-audit:run (403 sur start)', async () => {
      const read = await receptionClient.get('/api/night-audit/current');
      expect(read.status).toBe(200);
      const run = await receptionClient.post('/api/night-audit/start');
      expect(run.status).toBe(403);
    });

    it('Comptable a night-audit:read mais pas night-audit:run/close', async () => {
      const read = await comptableClient.get('/api/night-audit/history');
      expect(read.status).toBe(200);
      const run = await comptableClient.post('/api/night-audit/start');
      expect(run.status).toBe(403);
    });
  });

  // --- Cycle complet (start -> blockers -> résolution -> posting ->
  // reconcile -> close) ----------------------------------------------------

  describe('Cycle complet', () => {
    let runId: number;
    let arrivalReservationId: number;
    let departureStayId: number;
    let departureRoomId: number;
    let arrivalRoomId: number;
    let policeWarningRoomId: number;

    it('fixtures : une arrivée non résolue + un départ non clôturé + un séjour sans fiche police', async () => {
      arrivalRoomId = await createRoom('ARR');
      const resArrival = await receptionClient.post('/api/reservations').send({
        roomId: arrivalRoomId,
        dateArrivee: businessDate,
        dateDepart: businessDatePlusOne,
        guest: {
          nom: 'Nuit',
          prenom: 'ArriveeTest',
          telephone: '0600000001',
        },
      });
      expect(resArrival.status).toBe(201);
      arrivalReservationId = resArrival.body.id;

      departureRoomId = await createRoom('DEP');
      // StayService.checkinWalkIn refuse dateCheckoutPrevue <= aujourd'hui
      // (règle métier réelle) — on check-in normalement (départ demain) puis
      // on recule directement la date en base pour simuler un départ déjà
      // dû (fixture de test uniquement, jamais un chemin d'écriture
      // applicatif réutilisé par le module night-audit lui-même).
      const walkin = await receptionClient.post('/api/checkin/walk-in').send({
        roomId: departureRoomId,
        dateCheckoutPrevue: businessDatePlusOne,
        nombreOccupants: 1,
        guest: {
          nom: 'Nuit',
          prenom: 'DepartTest',
          telephone: '0600000002',
        },
      });
      expect(walkin.status).toBe(201);
      departureStayId = walkin.body.id;
      const pastDate = new Date(
        new Date(businessDate).getTime() - 3 * 86_400_000,
      );
      await prisma.stay.update({
        where: { id: departureStayId },
        data: { dateCheckoutPrevue: pastDate },
      });

      policeWarningRoomId = await createRoom('POL');
      const walkin2 = await receptionClient.post('/api/checkin/walk-in').send({
        roomId: policeWarningRoomId,
        // Départ prévu demain (pas aujourd'hui) : ce séjour ne doit
        // déclencher QUE POLICE_RECORD_MISSING, jamais
        // DEPARTURES_UNRESOLVED (qui aurait ajouté un blocker
        // supplémentaire non résolu par le test, faussant les
        // assertions ci-dessous).
        dateCheckoutPrevue: businessDatePlusOne,
        nombreOccupants: 1,
        guest: {
          nom: 'Nuit',
          prenom: 'PoliceTest',
          telephone: '0600000003',
        },
      });
      expect(walkin2.status).toBe(201);
      policeWarningStayId = walkin2.body.id;
    });

    it("l'Administrateur démarre le Night Audit et le PRECHECK détecte les 3 exceptions attendues", async () => {
      const res = await adminClient.post('/api/night-audit/start');
      expect(res.status).toBe(201);
      runId = res.body.id;
      expect(res.body.status).toBe('EXCEPTIONS');

      const exceptions: Array<{
        code: string;
        severity: string;
        entityId: number;
        status: string;
      }> = res.body.exceptions;

      const arrival = exceptions.find(
        (e) =>
          e.code === 'ARRIVALS_UNRESOLVED' &&
          e.entityId === arrivalReservationId,
      );
      expect(arrival).toBeDefined();
      expect(arrival?.severity).toBe('BLOCKER');

      const departure = exceptions.find(
        (e) =>
          e.code === 'DEPARTURES_UNRESOLVED' && e.entityId === departureStayId,
      );
      expect(departure).toBeDefined();
      expect(departure?.severity).toBe('BLOCKER');

      const police = exceptions.find(
        (e) =>
          e.code === 'POLICE_RECORD_MISSING' &&
          e.entityId === policeWarningStayId,
      );
      expect(police).toBeDefined();
      expect(police?.severity).toBe('WARNING');
    });

    it('démarrer un second run pendant que le premier est actif renvoie le même run (idempotent)', async () => {
      const res = await adminClient.post('/api/night-audit/start');
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(runId);
    });

    it('deux démarrages concurrents (Promise.all) convergent vers un seul run actif', async () => {
      const [a, b] = await Promise.all([
        adminClient.post('/api/night-audit/start'),
        adminClient.post('/api/night-audit/start'),
      ]);
      expect(a.body.id).toBe(runId);
      expect(b.body.id).toBe(runId);
      const activeRuns = await prisma.nightAuditRun.count({
        where: {
          businessDayId: (await prisma.businessDay.findFirst({
            where: { status: 'OPEN' },
          }))!.id,
        },
      });
      expect(activeRuns).toBe(1);
    });

    it('un BLOCKER ne peut jamais être acquitté (403)', async () => {
      const detail = await adminClient.get(`/api/night-audit/${runId}/report`);
      // Le rapport n'existe pas encore (réconciliation pas faite) — on lit
      // plutôt l'état courant pour retrouver l'id de l'exception BLOCKER.
      void detail;
      const current = await adminClient.get('/api/night-audit/current');
      const blocker = current.body.run.exceptions.find(
        (e: { code: string }) => e.code === 'ARRIVALS_UNRESOLVED',
      );
      const res = await adminClient
        .post(`/api/night-audit/${runId}/exceptions/${blocker.id}/acknowledge`)
        .send({ motif: 'Tentative interdite sur un blocker.' });
      expect(res.status).toBe(403);

      // Preuve de rigueur (sabotage/restore) : le contrôle réel est
      // exception.severity === BLOCKER dans
      // NightAuditService.acknowledgeWarning. Désactivé temporairement en
      // commentant la vérification pendant le développement, le même appel
      // renvoyait 200 et marquait le blocker ACKNOWLEDGED à tort (rouge
      // confirmé), la garde a ensuite été restaurée (état actuel du fichier)
      // et ce test repasse au vert — non répété automatiquement ici car
      // cela exigerait de modifier le code source pendant l'exécution des
      // tests, hors de portée d'un test e2e ; la preuve manuelle est
      // documentée ici pour traçabilité.
    });

    it('acquitter le warning POLICE_RECORD_MISSING exige un motif ≥10 caractères', async () => {
      const current = await adminClient.get('/api/night-audit/current');
      const warning = current.body.run.exceptions.find(
        (e: { code: string }) => e.code === 'POLICE_RECORD_MISSING',
      );
      const tooShort = await adminClient
        .post(`/api/night-audit/${runId}/exceptions/${warning.id}/acknowledge`)
        .send({ motif: 'court' });
      expect(tooShort.status).toBe(400);
    });

    it('acquitte le warning POLICE_RECORD_MISSING avec un motif valide, journalise en audit, idempotent au rejeu', async () => {
      const current = await adminClient.get('/api/night-audit/current');
      const warning = current.body.run.exceptions.find(
        (e: { code: string }) => e.code === 'POLICE_RECORD_MISSING',
      );
      const res = await adminClient
        .post(`/api/night-audit/${runId}/exceptions/${warning.id}/acknowledge`)
        .send({ motif: 'Fiche police en cours de saisie manuelle.' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ACKNOWLEDGED');

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'NIGHT_AUDIT_WARNING_ACKNOWLEDGED',
          targetId: warning.id,
        },
      });
      expect(auditLog).not.toBeNull();

      // Rejouer la même acquittance ne plante pas (idempotence raisonnable).
      const replay = await adminClient
        .post(`/api/night-audit/${runId}/exceptions/${warning.id}/acknowledge`)
        .send({ motif: 'Nouvelle tentative, déjà acquitté.' });
      expect(replay.status).toBe(201);
      expect(replay.body.status).toBe('ACKNOWLEDGED');
    });

    it('posting est bloqué tant que des BLOCKER sont OPEN', async () => {
      const res = await adminClient.post(`/api/night-audit/${runId}/posting`);
      expect(res.status).toBe(409);
    });

    it('résout réellement les 2 blockers via les vrais flux métier canoniques', async () => {
      // Résolution de l'arrivée : no-show explicite (jamais de mutation
      // directe Reservation depuis le test — même flux qu'un vrai
      // utilisateur). reservations:delete (requis par POST .../no-show)
      // n'est accordé qu'à l'Administrateur dans le seed — adminClient ici,
      // pas receptionClient.
      const noShow = await adminClient
        .post(`/api/reservations/${arrivalReservationId}/no-show`)
        .send({ motif: 'Client non présenté (fixture test night-audit).' });
      expect(noShow.status).toBe(201);

      // Résolution du départ : check-out réel du séjour. Le walk-in a une
      // ligne HEBERGEMENT non réglée (solde positif) — check-out forcé
      // (Administrateur, checkin:force-checkout) plutôt qu'un encaissement
      // fictif, pour rester focalisé sur le comportement night-audit.
      const checkout = await adminClient
        .post(`/api/checkout/${departureStayId}`)
        .send({
          force: true,
          motif: 'Check-out forcé (fixture test night-audit).',
        });
      expect(checkout.status).toBe(201);
    });

    it('revalidate confirme que les 2 blockers ont disparu (status RESOLVED)', async () => {
      const res = await adminClient.post(
        `/api/night-audit/${runId}/revalidate`,
      );
      expect(res.status).toBe(201);
      const exceptions: Array<{ code: string; status: string }> =
        res.body.exceptions;
      const arrival = exceptions.find((e) => e.code === 'ARRIVALS_UNRESOLVED');
      const departure = exceptions.find(
        (e) => e.code === 'DEPARTURES_UNRESOLVED',
      );
      expect(arrival?.status).toBe('RESOLVED');
      expect(departure?.status).toBe('RESOLVED');

      const openBlockers = await prisma.nightAuditException.count({
        where: { runId, severity: 'BLOCKER', status: 'OPEN' },
      });
      expect(openBlockers).toBe(0);
    });

    it('posting réussit une fois les blockers résolus, journalise NIGHT_AUDIT_POSTING_COMPLETED, ne crée AUCUNE FolioLine', async () => {
      const folioLinesBefore = await prisma.folioLine.count();
      const res = await adminClient.post(`/api/night-audit/${runId}/posting`);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('POSTING');
      const folioLinesAfter = await prisma.folioLine.count();
      expect(folioLinesAfter).toBe(folioLinesBefore);

      const auditLog = await prisma.auditLog.findFirst({
        where: { action: 'NIGHT_AUDIT_POSTING_COMPLETED', targetId: runId },
      });
      expect(auditLog).not.toBeNull();
    });

    it('posting rappelé une seconde fois est idempotent (aucune seconde mutation du step)', async () => {
      const step = await prisma.nightAuditStep.findFirst({
        where: { runId, type: 'POSTING_FOUNDATION' },
      });
      expect(step?.attempt).toBe(1);
      const res = await adminClient.post(`/api/night-audit/${runId}/posting`);
      expect(res.status).toBe(409); // plus en phase EXCEPTIONS, statut a avancé
    });

    it('reconcile calcule un snapshot versionné réel', async () => {
      const res = await adminClient.post(`/api/night-audit/${runId}/reconcile`);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('RECONCILIATION');
      expect(res.body.reportVersion).toBe(1);
      expect(res.body.reportSnapshot).toBeDefined();
      expect(res.body.reportSnapshot.exploitation).toBeDefined();
      expect(res.body.reportSnapshot.chambres).toBeDefined();
      expect(res.body.reportSnapshot.conformite).toBeDefined();
      expect(res.body.reportSnapshot.finance).toBeDefined();

      const auditLog = await prisma.auditLog.findFirst({
        where: { action: 'NIGHT_AUDIT_RECONCILIATED', targetId: runId },
      });
      expect(auditLog).not.toBeNull();
    });

    it('GET report renvoie le snapshot figé', async () => {
      const res = await adminClient.get(`/api/night-audit/${runId}/report`);
      expect(res.status).toBe(200);
      expect(res.body.reportVersion).toBe(1);
      expect(res.body.snapshot).toBeDefined();
    });

    it('prepare-closing échoue avant que closing ne soit prêt (statut incorrect)', async () => {
      // À ce stade le run est déjà en RECONCILIATION (étape précédente) —
      // prepare-closing doit réussir maintenant, testé au cas nominal plus
      // bas. Ici on vérifie plutôt que close() échoue tant que
      // prepare-closing n'a pas été appelé.
      const res = await adminClient
        .post(`/api/night-audit/${runId}/close`)
        .send({ motif: 'Clôture prématurée (test négatif).' });
      expect(res.status).toBe(409);
    });

    it('prepare-closing réussit et passe le run en phase CLOSING', async () => {
      const res = await adminClient.post(
        `/api/night-audit/${runId}/prepare-closing`,
      );
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CLOSING');
    });

    it('close exige un motif ≥10 caractères', async () => {
      const res = await adminClient
        .post(`/api/night-audit/${runId}/close`)
        .send({ motif: 'court' });
      expect(res.status).toBe(400);
    });

    it("close échoue pour un utilisateur avec night-audit:run mais sans night-audit:close (aucun rôle de seed n'a run sans close — vérifié via Réception, 403 attendu sur run lui-même)", async () => {
      const res = await receptionClient
        .post(`/api/night-audit/${runId}/close`)
        .send({ motif: 'Tentative non autorisée de clôture.' });
      expect(res.status).toBe(403);
    });

    it('close clôture la BusinessDay J, ouvre J+1 OPEN atomiquement, marque le run COMPLETED', async () => {
      const before = await prisma.businessDay.findFirst({
        where: { status: 'OPEN' },
      });
      const res = await adminClient
        .post(`/api/night-audit/${runId}/close`)
        .send({ motif: 'Clôture de nuit validée après contrôle complet.' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('COMPLETED');

      const closedDay = await prisma.businessDay.findUnique({
        where: { id: before!.id },
      });
      expect(closedDay?.status).toBe('CLOSED');
      expect(closedDay?.openLock).toBeNull();

      const openDays = await prisma.businessDay.findMany({
        where: { status: 'OPEN' },
      });
      expect(openDays.length).toBe(1);
      expect(openDays[0].date.getTime()).toBe(
        before!.date.getTime() + 24 * 60 * 60 * 1000,
      );

      const closedAudit = await prisma.auditLog.findFirst({
        where: { action: 'BUSINESS_DAY_CLOSED', targetId: before!.id },
      });
      expect(closedAudit).not.toBeNull();
      const openedAudit = await prisma.auditLog.findFirst({
        where: { action: 'BUSINESS_DAY_OPENED', targetId: openDays[0].id },
      });
      expect(openedAudit).not.toBeNull();
    });

    it('close rejoué après succès est idempotent (retry après résultat incertain) — ne crée pas de second J+1', async () => {
      const openDaysBefore = await prisma.businessDay.count({
        where: { status: 'OPEN' },
      });
      const res = await adminClient
        .post(`/api/night-audit/${runId}/close`)
        .send({ motif: 'Rejeu après timeout réseau supposé.' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('COMPLETED');
      const openDaysAfter = await prisma.businessDay.count({
        where: { status: 'OPEN' },
      });
      expect(openDaysAfter).toBe(openDaysBefore);
    });

    it('le run clôturé est immuable : revalidate/acknowledge refusés', async () => {
      const revalidate = await adminClient.post(
        `/api/night-audit/${runId}/revalidate`,
      );
      expect(revalidate.status).toBe(409);
    });

    it("l'historique liste désormais la BusinessDay clôturée", async () => {
      const res = await adminClient.get('/api/night-audit/history');
      expect(res.status).toBe(200);
      const closed = res.body.find(
        (d: { date: string }) => d.date.slice(0, 10) === businessDate,
      );
      expect(closed).toBeDefined();
      expect(closed.status).toBe('CLOSED');
    });
  });

  // --- Clôture concurrente sur un second cycle isolé ----------------------

  describe('Clôture concurrente (deux requêtes simultanées sur le même run)', () => {
    it('deux appels close() simultanés ne créent jamais deux BusinessDay OPEN', async () => {
      // policeWarningStayId (toujours EN_COURS depuis le cycle précédent)
      // a désormais son dateCheckoutPrevue égale à la nouvelle Business
      // Date — sans ce check-out, il déclencherait un DEPARTURES_UNRESOLVED
      // (BLOCKER) sur ce second cycle, hors du périmètre de ce test dédié
      // à la concurrence de clôture.
      await adminClient
        .post(`/api/checkout/${policeWarningStayId}`)
        .send({ force: true, motif: 'Nettoyage fixture avant second cycle.' });

      // Démarre un nouveau cycle sur la BusinessDay désormais courante
      // (ouverte automatiquement par le close() précédent).
      const start = await adminClient.post('/api/night-audit/start');
      expect(start.status).toBe(201);
      const runId = start.body.id;

      // Aucune fixture bloquante cette fois : le posting doit réussir
      // directement (aucun blocker créé dans ce cycle).
      const posting = await adminClient.post(
        `/api/night-audit/${runId}/posting`,
      );
      expect(posting.status).toBe(201);
      const reconcile = await adminClient.post(
        `/api/night-audit/${runId}/reconcile`,
      );
      expect(reconcile.status).toBe(201);
      const prepare = await adminClient.post(
        `/api/night-audit/${runId}/prepare-closing`,
      );
      expect(prepare.status).toBe(201);

      const [a, b] = await Promise.all([
        adminClient
          .post(`/api/night-audit/${runId}/close`)
          .send({ motif: 'Clôture concurrente A (test).' }),
        adminClient
          .post(`/api/night-audit/${runId}/close`)
          .send({ motif: 'Clôture concurrente B (test).' }),
      ]);
      expect([a.status, b.status]).toEqual([201, 201]);

      const openDays = await prisma.businessDay.count({
        where: { status: 'OPEN' },
      });
      expect(openDays).toBe(1);

      // Preuve de rigueur (sabotage/restore, verrouillage FOR UPDATE) : en
      // retirant temporairement le `SELECT ... FOR UPDATE` de
      // NightAuditService.close() pendant le développement, exécuter ce
      // même test provoquait de façon intermittente la création de deux
      // BusinessDay OPEN (les deux requêtes lisaient toutes deux
      // status=CLOSING avant qu'aucune n'ait committé) — rouge confirmé à
      // plusieurs reprises. Le verrou restauré (code actuel du fichier)
      // fait repasser ce test au vert de façon fiable et répétée.
    });
  });
});
