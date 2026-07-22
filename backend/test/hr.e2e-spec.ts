import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { authedRequest, loginAs, SEED_USERS } from './helpers/auth';

interface EmployeeResponse {
  id: number;
  userId: number;
}

interface TimeShiftResponse {
  id: number;
  statut: 'NON_DEMARRE' | 'ACTIF' | 'EN_PAUSE' | 'TERMINE';
  startedAt: string;
  endedAt: string | null;
}

interface StatutCourantResponse {
  bloqueDeconnexion: boolean;
  statut: string;
  timeShiftId: number | null;
}

interface PaySlipResponse {
  id: number;
  retenueCnss: string;
  retenueAmo: string;
  salaireNet: string;
  chargesPatronales: string;
  estValide: boolean;
}

// Module hr (Sprint 11, ADR-007 + BUSINESS_RULES BR-RH-001/003/004/005).
// Vrais appels HTTP contre une vraie base MySQL, aucun mock — même
// discipline que maintenance.e2e-spec.ts.
describe('HR — pointage inviolable et paie CNSS/AMO (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let rhClient: ReturnType<typeof authedRequest>;
  let maintenanceClient: ReturnType<typeof authedRequest>;
  let receptionClient: ReturnType<typeof authedRequest>;
  let maintenanceUserId: number;
  let employeeId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const rhToken = await loginAs(app.getHttpServer(), 'rh');
    rhClient = authedRequest(app.getHttpServer(), rhToken);
    const maintenanceToken = await loginAs(app.getHttpServer(), 'maintenance');
    maintenanceClient = authedRequest(app.getHttpServer(), maintenanceToken);
    const receptionToken = await loginAs(app.getHttpServer(), 'reception');
    receptionClient = authedRequest(app.getHttpServer(), receptionToken);

    const maintenanceUser = await prisma.user.findUniqueOrThrow({
      where: { email: SEED_USERS.maintenance },
    });
    maintenanceUserId = maintenanceUser.id;

    const employee = await rhClient.post('/api/rh/employees').send({
      userId: maintenanceUserId,
      salaireBase: '8500.00',
      dateEmbauche: '2026-01-15',
    });
    expect(employee.status).toBe(201);
    employeeId = (employee.body as EmployeeResponse).id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        targetEntity: { in: ['TimeShift', 'PaySlip'] },
        targetId: { in: [employeeId] },
      },
    });
    await prisma.paySlip.deleteMany({ where: { employeeId } });
    await prisma.timeShiftSegment.deleteMany({
      where: { timeShift: { employeeId } },
    });
    await prisma.timeShift.deleteMany({ where: { employeeId } });
    await prisma.employee.deleteMany({ where: { id: employeeId } });
    await app.close();
  });

  describe('Machine à états du pointage (ADR-007)', () => {
    it('démarrer → pause → reprendre → terminer suit la séquence nominale', async () => {
      const demarrer = await maintenanceClient.post(
        '/api/rh/attendance/demarrer',
      );
      expect(demarrer.status).toBe(201);
      const shift = demarrer.body as TimeShiftResponse;
      expect(shift.statut).toBe('ACTIF');
      expect(shift.endedAt).toBeNull();

      const pause = await maintenanceClient.post('/api/rh/attendance/pause');
      expect(pause.status).toBe(201);
      expect((pause.body as TimeShiftResponse).statut).toBe('EN_PAUSE');

      const statutEnPause = await maintenanceClient.get(
        '/api/rh/attendance/statut-courant',
      );
      const bodyEnPause = statutEnPause.body as StatutCourantResponse;
      expect(bodyEnPause.bloqueDeconnexion).toBe(true);
      expect(bodyEnPause.statut).toBe('EN_PAUSE');

      const reprendre = await maintenanceClient.post(
        '/api/rh/attendance/reprendre',
      );
      expect(reprendre.status).toBe(201);
      expect((reprendre.body as TimeShiftResponse).statut).toBe('ACTIF');

      const terminer = await maintenanceClient.post(
        '/api/rh/attendance/terminer',
      );
      expect(terminer.status).toBe(201);
      const closed = terminer.body as TimeShiftResponse;
      expect(closed.statut).toBe('TERMINE');
      expect(closed.endedAt).not.toBeNull();

      const statutApres = await maintenanceClient.get(
        '/api/rh/attendance/statut-courant',
      );
      expect(
        (statutApres.body as StatutCourantResponse).bloqueDeconnexion,
      ).toBe(false);
    });

    it('INV-TSH-002 : un deuxième "démarrer" pendant un shift actif est refusé (409)', async () => {
      const premier = await maintenanceClient.post(
        '/api/rh/attendance/demarrer',
      );
      expect(premier.status).toBe(201);

      const second = await maintenanceClient.post(
        '/api/rh/attendance/demarrer',
      );
      expect(second.status).toBe(409);

      // Nettoyage pour ne pas polluer les tests suivants avec un shift ouvert.
      const cloture = await maintenanceClient.post(
        '/api/rh/attendance/terminer',
      );
      expect(cloture.status).toBe(201);
    });

    it("INV-TSH-003 : clôturer directement depuis EN_PAUSE est refusé (400), reprendre d'abord fonctionne", async () => {
      await maintenanceClient.post('/api/rh/attendance/demarrer');
      await maintenanceClient.post('/api/rh/attendance/pause');

      const clotureDirecte = await maintenanceClient.post(
        '/api/rh/attendance/terminer',
      );
      expect(clotureDirecte.status).toBe(400);

      const reprendre = await maintenanceClient.post(
        '/api/rh/attendance/reprendre',
      );
      expect(reprendre.status).toBe(201);

      const clotureApresReprise = await maintenanceClient.post(
        '/api/rh/attendance/terminer',
      );
      expect(clotureApresReprise.status).toBe(201);
    });

    it('INV-TSH-001 : un horodatage transmis par le client est ignoré, seule l’heure serveur fait foi', async () => {
      // demarrer() ne déclare aucun @Body() DTO : un champ arbitraire envoyé
      // par le client n'est jamais lu par le contrôleur (rien ne le bind),
      // donc la requête aboutit — mais startedAt reste strictement dérivé de
      // new Date() côté service, jamais de la valeur envoyée ici.
      const avant = Date.now();
      const res = await maintenanceClient
        .post('/api/rh/attendance/demarrer')
        .send({ startedAt: '2020-01-01T00:00:00Z' });
      expect(res.status).toBe(201);

      const shift = res.body as TimeShiftResponse;
      const startedAtMs = new Date(shift.startedAt).getTime();
      expect(startedAtMs).not.toBe(new Date('2020-01-01T00:00:00Z').getTime());
      expect(startedAtMs).toBeGreaterThanOrEqual(avant);
      expect(startedAtMs).toBeLessThanOrEqual(Date.now());

      await maintenanceClient.post('/api/rh/attendance/terminer');
    });
  });

  describe('Cloisonnement RBAC (module rh)', () => {
    it('la Réception ne peut pas créer de fiche employé (403)', async () => {
      const res = await receptionClient.post('/api/rh/employees').send({
        userId: maintenanceUserId,
        salaireBase: '5000.00',
        dateEmbauche: '2026-01-01',
      });
      expect(res.status).toBe(403);
    });

    it('la Réception ne peut pas lister les employés (403)', async () => {
      const res = await receptionClient.get('/api/rh/employees');
      expect(res.status).toBe(403);
    });

    it("le pointage self-service reste accessible à tout rôle authentifié (pas de permission 'rh' requise)", async () => {
      // receptionClient n'a pas de fiche Employee liée : NotFoundException
      // (404) attendue, PAS 403 — la route elle-même n'est pas bloquée par
      // PermissionsGuard, c'est l'absence de dossier RH qui est signalée.
      const res = await receptionClient.get(
        '/api/rh/attendance/statut-courant',
      );
      expect(res.status).toBe(404);
    });
  });

  describe('Paie CNSS/AMO (BR-RH-001)', () => {
    it('calcule un bulletin conforme à l’exemple de référence (brut 8500 MAD)', async () => {
      const calcul = await rhClient.post('/api/rh/payroll/calculate').send({
        employeeId,
        mois: 6,
        annee: 2026,
      });
      expect(calcul.status).toBe(201);
      const slip = calcul.body as PaySlipResponse;
      expect(Number(slip.retenueCnss)).toBe(268.8);
      expect(Number(slip.retenueAmo)).toBe(192.1);
      expect(Number(slip.salaireNet)).toBe(8039.1);
      expect(slip.estValide).toBe(false);
    });

    it('valide le bulletin, puis refuse un recalcul du même mois', async () => {
      const calcul = await rhClient.post('/api/rh/payroll/calculate').send({
        employeeId,
        mois: 7,
        annee: 2026,
      });
      const slipId = (calcul.body as PaySlipResponse).id;

      const validation = await rhClient.patch(
        `/api/rh/payroll/${slipId}/valider`,
      );
      expect(validation.status).toBe(200);
      expect((validation.body as PaySlipResponse).estValide).toBe(true);

      const recalcul = await rhClient.post('/api/rh/payroll/calculate').send({
        employeeId,
        mois: 7,
        annee: 2026,
      });
      expect(recalcul.status).toBe(400);

      const slips = await rhClient.get(
        `/api/rh/payroll/slips?employeeId=${employeeId}`,
      );
      expect(slips.status).toBe(200);
      expect(
        (slips.body as PaySlipResponse[]).some((s) => s.id === slipId),
      ).toBe(true);
    });

    it('un Comptable ne peut pas déclencher de calcul de paie (403, module rh réservé RH/Admin)', async () => {
      const comptableToken = await loginAs(app.getHttpServer(), 'comptable');
      const comptableClient = authedRequest(
        app.getHttpServer(),
        comptableToken,
      );
      const res = await comptableClient
        .post('/api/rh/payroll/calculate')
        .send({ employeeId, mois: 8, annee: 2026 });
      expect(res.status).toBe(403);
    });
  });

  describe('Ajustement audité (ADR-007 §6.4, INV-TSH-004)', () => {
    it('un motif trop court (<10 caractères) est rejeté', async () => {
      const demarrer = await maintenanceClient.post(
        '/api/rh/attendance/demarrer',
      );
      const shiftId = (demarrer.body as TimeShiftResponse).id;
      const segments = await prisma.timeShiftSegment.findFirst({
        where: { timeShiftId: shiftId },
      });

      const res = await rhClient
        .patch(`/api/rh/attendance/segments/${segments!.id}/ajuster`)
        .send({ nouveauDebut: '2026-06-01T08:00:00Z', motif: 'court' });
      expect(res.status).toBe(400);

      await maintenanceClient.post('/api/rh/attendance/terminer');
    });

    it('un ajustement valide écrit une ligne AuditLog avec ancienne/nouvelle valeur', async () => {
      const demarrer = await maintenanceClient.post(
        '/api/rh/attendance/demarrer',
      );
      const shiftId = (demarrer.body as TimeShiftResponse).id;
      const segment = await prisma.timeShiftSegment.findFirstOrThrow({
        where: { timeShiftId: shiftId },
      });

      const nouveauDebut = '2026-06-01T07:30:00.000Z';
      const res = await rhClient
        .patch(`/api/rh/attendance/segments/${segment.id}/ajuster`)
        .send({
          nouveauDebut,
          motif: 'Oubli de pointage signalé par la Gouvernante',
        });
      expect(res.status).toBe(200);

      const log = await prisma.auditLog.findFirst({
        where: {
          targetEntity: 'TimeShift',
          targetId: shiftId,
          action: 'ADJUST_TIME_SHIFT',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toBeDefined();
      expect(log!.motif).toBe('Oubli de pointage signalé par la Gouvernante');
      expect((log!.newValue as { debut: string }).debut).toBe(
        new Date(nouveauDebut).toISOString(),
      );

      await maintenanceClient.post('/api/rh/attendance/terminer');
    });
  });
});
