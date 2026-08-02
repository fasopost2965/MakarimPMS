import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { HousekeepingTaskService } from './../src/modules/housekeeping/housekeeping-task.service';
import {
  OrigineTacheHousekeeping,
  StatutChambre,
  StatutTacheHousekeeping,
  TypeLogTacheHousekeeping,
  AuditAction,
  AuditEntity,
} from '@prisma/client';

describe('HousekeepingTaskService — Domaine, Transactions, Verrous et Concurrence (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: HousekeepingTaskService;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let roomTypeId: number;
  let gouvRole: any;
  let agentRole: any;
  let randomRole: any;

  let userGouv: any;
  let userAgent: any;
  let userUnauthorized: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    service = app.get(HousekeepingTaskService);

    // Setup Test Roles
    gouvRole = await prisma.role.create({
      data: { nom: `TestGouvRole-${suffix}` },
    });
    // Associate permission housekeeping:control and write (create if missing)
    let permControl = await prisma.permission.findUnique({
      where: { module_action: { module: 'housekeeping', action: 'control' } },
    });
    if (!permControl) {
      permControl = await prisma.permission.create({
        data: { module: 'housekeeping', action: 'control' },
      });
    }
    await prisma.rolePermission.create({
      data: { roleId: gouvRole.id, permissionId: permControl.id },
    });

    let permWrite = await prisma.permission.findUnique({
      where: { module_action: { module: 'housekeeping', action: 'write' } },
    });
    if (!permWrite) {
      permWrite = await prisma.permission.create({
        data: { module: 'housekeeping', action: 'write' },
      });
    }
    await prisma.rolePermission.create({
      data: { roleId: gouvRole.id, permissionId: permWrite.id },
    });

    agentRole = await prisma.role.create({
      data: { nom: `TestAgentRole-${suffix}` },
    });
    // agent role has no housekeeping permissions

    randomRole = await prisma.role.create({
      data: { nom: `TestRandomRole-${suffix}` },
    });

    // Create Test Users
    userGouv = await prisma.user.create({
      data: {
        nom: `TestGouv-${suffix}`,
        email: `testgouv-${suffix}@makarimpms.com`,
        motDePasseHash: 'hash',
        roleId: gouvRole.id,
        actif: true,
      },
    });

    userAgent = await prisma.user.create({
      data: {
        nom: `TestAgent-${suffix}`,
        email: `testagent-${suffix}@makarimpms.com`,
        motDePasseHash: 'hash',
        roleId: agentRole.id,
        actif: true,
      },
    });

    userUnauthorized = await prisma.user.create({
      data: {
        nom: `TestUnauth-${suffix}`,
        email: `testunauth-${suffix}@makarimpms.com`,
        motDePasseHash: 'hash',
        roleId: randomRole.id,
        actif: true,
      },
    });

    // Create Room Type
    const roomType = await prisma.roomType.create({
      data: {
        nom: `TEST-HK-TASK-INTEG-${suffix}`,
        prixBase: 200,
        capacite: 2,
      },
    });
    roomTypeId = roomType.id;
  });

  afterAll(async () => {
    // Cleanup Test Users, Roles, Rooms, etc.
    if (prisma) {
      if (roomTypeId) {
        await prisma.housekeepingTaskLog.deleteMany({
          where: { task: { room: { roomTypeId } } },
        });
        await prisma.housekeepingTask.deleteMany({
          where: { room: { roomTypeId } },
        });
        await prisma.roomStatusLog.deleteMany({
          where: { room: { roomTypeId } },
        });
        await prisma.room.deleteMany({
          where: { roomTypeId },
        });
        await prisma.roomType
          .delete({
            where: { id: roomTypeId },
          })
          .catch(() => {});
      }

      // Delete users
      const userIds = [
        userGouv?.id,
        userAgent?.id,
        userUnauthorized?.id,
      ].filter(Boolean);
      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        });
      }

      // Delete roles
      const roleIds = [gouvRole?.id, agentRole?.id, randomRole?.id].filter(
        Boolean,
      );
      if (roleIds.length > 0) {
        await prisma.rolePermission.deleteMany({
          where: { roleId: { in: roleIds } },
        });
        await prisma.role.deleteMany({
          where: { id: { in: roleIds } },
        });
      }
    }

    if (app) {
      await app.close();
    }
  });

  async function createRoom(numero: string, statut: StatutChambre) {
    return prisma.room.create({
      data: {
        numero: `${numero}-${suffix}`,
        roomTypeId,
        statut,
      },
    });
  }

  describe('Création de tâche (createTask)', () => {
    it('crée une tâche au statut A_FAIRE avec log de création', async () => {
      const room = await createRoom('R1', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );

      expect(task.statut).toBe(StatutTacheHousekeeping.A_FAIRE);
      expect(task.activeRoomKey).toBe(room.id);
      expect(task.roomId).toBe(room.id);

      const logs = await prisma.housekeepingTaskLog.findMany({
        where: { taskId: task.id },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe(TypeLogTacheHousekeeping.CREATION);
      expect(logs[0].nouveauStatut).toBe(StatutTacheHousekeeping.A_FAIRE);
    });

    it('refuse la création manuelle si la chambre n’est pas A_NETTOYER', async () => {
      const room = await createRoom('R2', StatutChambre.LIBRE_PROPRE);
      await expect(
        service.createTask(room.id, OrigineTacheHousekeeping.MANUELLE),
      ).rejects.toThrow(ConflictException);
    });

    it('refuse la création manuelle si la chambre a déjà une tâche active', async () => {
      const room = await createRoom('R3', StatutChambre.A_NETTOYER);
      await service.createTask(room.id, OrigineTacheHousekeeping.MANUELLE);
      await expect(
        service.createTask(room.id, OrigineTacheHousekeeping.MANUELLE),
      ).rejects.toThrow(ConflictException);
    });

    it('retourne la tâche existante (idempotence) si sourceEventKey est fourni', async () => {
      const room = await createRoom('R4', StatutChambre.A_NETTOYER);
      const key = `event-key-${suffix}`;
      const task1 = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.REPRISE,
        key,
      );
      const task2 = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.REPRISE,
        key,
      );

      expect(task1.id).toBe(task2.id);
      const tasks = await prisma.housekeepingTask.findMany({
        where: { roomId: room.id },
      });
      expect(tasks).toHaveLength(1);
    });
  });

  describe('Affectation de tâche (assign)', () => {
    it('permet d’affecter un agent (A_FAIRE -> AFFECTEE) avec logs et initialisation de assignedAt', async () => {
      const room = await createRoom('R5', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );

      const updated = await service.assign(task.id, userAgent.id, userGouv.id);
      expect(updated.statut).toBe(StatutTacheHousekeeping.AFFECTEE);
      expect(updated.assignedUserId).toBe(userAgent.id);
      expect(updated.assignedAt).not.toBeNull();

      const logs = await prisma.housekeepingTaskLog.findMany({
        where: { taskId: task.id, type: TypeLogTacheHousekeeping.AFFECTATION },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].nouveauAssignedUserId).toBe(userAgent.id);
      expect(logs[0].actorUserId).toBe(userGouv.id);
    });

    it('permet de réaffecter un agent (AFFECTEE -> AFFECTEE) avec motif obligatoire', async () => {
      const room = await createRoom('R6', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );
      await service.assign(task.id, userAgent.id, userGouv.id);

      // Sans motif -> doit échouer
      await expect(
        service.assign(task.id, userGouv.id, userGouv.id),
      ).rejects.toThrow(ConflictException);

      // Avec motif
      const updated = await service.assign(
        task.id,
        userGouv.id,
        userGouv.id,
        'Changement d’équipe',
      );
      expect(updated.assignedUserId).toBe(userGouv.id);

      const logs = await prisma.housekeepingTaskLog.findMany({
        where: {
          taskId: task.id,
          type: TypeLogTacheHousekeeping.REAFFECTATION,
        },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].motif).toBe('Changement d’équipe');
    });

    it('permet de retirer l’affectation (AFFECTEE -> A_FAIRE) avec retrait log', async () => {
      const room = await createRoom('R7', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );
      await service.assign(task.id, userAgent.id, userGouv.id);

      const updated = await service.assign(task.id, null, userGouv.id);
      expect(updated.statut).toBe(StatutTacheHousekeeping.A_FAIRE);
      expect(updated.assignedUserId).toBeNull();

      const logs = await prisma.housekeepingTaskLog.findMany({
        where: {
          taskId: task.id,
          type: TypeLogTacheHousekeeping.RETRAIT_AFFECTATION,
        },
      });
      expect(logs).toHaveLength(1);
    });

    it('refuse l’affectation par un utilisateur non autorisé', async () => {
      const room = await createRoom('R8', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );

      await expect(
        service.assign(task.id, userAgent.id, userUnauthorized.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Démarrage et complétion (start / complete)', () => {
    it('permet de démarrer et compléter le nettoyage par l’agent affecté', async () => {
      const room = await createRoom('R9', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );
      await service.assign(task.id, userAgent.id, userGouv.id);

      // Démarrage
      const started = await service.start(task.id, userAgent.id);
      expect(started.statut).toBe(StatutTacheHousekeeping.EN_COURS);
      expect(started.startedAt).not.toBeNull();

      const roomAfterStart = await prisma.room.findUnique({
        where: { id: room.id },
      });
      expect(roomAfterStart.statut).toBe(StatutChambre.EN_NETTOYAGE);

      // Complétion
      const completed = await service.complete(task.id, userAgent.id);
      expect(completed.statut).toBe(StatutTacheHousekeeping.TERMINEE);
      expect(completed.completedAt).not.toBeNull();
    });

    it('refuse le démarrage si la chambre est en maintenance', async () => {
      const room = await createRoom('R10', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );
      await service.assign(task.id, userAgent.id, userGouv.id);

      // Passer en maintenance
      await prisma.room.update({
        where: { id: room.id },
        data: { statut: StatutChambre.EN_MAINTENANCE },
      });

      await expect(service.start(task.id, userAgent.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('autorise le démarrage par un superviseur (control) même si non affecté', async () => {
      const room = await createRoom('R11', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );
      await service.assign(task.id, userAgent.id, userGouv.id);

      const started = await service.start(task.id, userGouv.id);
      expect(started.statut).toBe(StatutTacheHousekeeping.EN_COURS);
    });
  });

  describe('Validation, Refus et Réouverture', () => {
    it('permet de valider le nettoyage (TERMINEE -> VALIDEE) par un contrôleur distinct de l’agent affecté', async () => {
      const room = await createRoom('R12', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );
      await service.assign(task.id, userAgent.id, userGouv.id);
      await service.start(task.id, userAgent.id);
      await service.complete(task.id, userAgent.id);

      // Auto-validation interdite (Gouv user has control permission but cannot validate their own task)
      await prisma.housekeepingTask.update({
        where: { id: task.id },
        data: { assignedUserId: userGouv.id },
      });

      await expect(
        service.validate(task.id, userGouv.id, 'Ménage OK'),
      ).rejects.toThrow(ConflictException);

      // Reassign to userAgent to test valid validation by Gouv
      await prisma.housekeepingTask.update({
        where: { id: task.id },
        data: { assignedUserId: userAgent.id },
      });

      // Validation valide
      const validated = await service.validate(
        task.id,
        userGouv.id,
        'Ménage parfait',
      );
      expect(validated.statut).toBe(StatutTacheHousekeeping.VALIDEE);
      expect(validated.activeRoomKey).toBeNull();

      const roomAfterVal = await prisma.room.findUnique({
        where: { id: room.id },
      });
      expect(roomAfterVal.statut).toBe(StatutChambre.LIBRE_PROPRE);

      // Audit Log créé
      const audits = await prisma.auditLog.findMany({
        where: {
          action: AuditAction.VALIDATE_HOUSEKEEPING_TASK,
          targetId: task.id,
        },
      });
      expect(audits).toHaveLength(1);
    });

    it('permet de refuser le nettoyage (TERMINEE -> EN_COURS) en conservant l’agent et les jalons', async () => {
      const room = await createRoom('R13', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );
      await service.assign(task.id, userAgent.id, userGouv.id);
      await service.start(task.id, userAgent.id);
      const completed = await service.complete(task.id, userAgent.id);

      const refused = await service.refuse(
        task.id,
        userGouv.id,
        'Cheveux trouvés',
      );
      expect(refused.statut).toBe(StatutTacheHousekeeping.EN_COURS);
      expect(refused.assignedUserId).toBe(userAgent.id);
      expect(refused.completedAt.getTime()).toBe(
        completed.completedAt.getTime(),
      );

      const roomAfterRefuse = await prisma.room.findUnique({
        where: { id: room.id },
      });
      expect(roomAfterRefuse.statut).toBe(StatutChambre.EN_NETTOYAGE);
    });

    it('permet de rouvrir une tâche validée (VALIDEE -> A_FAIRE) avec libération', async () => {
      const room = await createRoom('R14', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );
      await service.assign(task.id, userAgent.id, userGouv.id);
      await service.start(task.id, userAgent.id);
      await service.complete(task.id, userAgent.id);
      await service.validate(task.id, userGouv.id, 'Validation initiale');

      // Reopen
      const reopened = await service.reopen(
        task.id,
        userGouv.id,
        'Salie par un visiteur',
      );
      expect(reopened.statut).toBe(StatutTacheHousekeeping.A_FAIRE);
      expect(reopened.assignedUserId).toBeNull();
      expect(reopened.activeRoomKey).toBe(room.id);

      const roomAfterReopen = await prisma.room.findUnique({
        where: { id: room.id },
      });
      expect(roomAfterReopen.statut).toBe(StatutChambre.A_NETTOYER);
    });
  });

  describe('Annulation (cancel)', () => {
    it('permet d’annuler une tâche au statut A_FAIRE ou AFFECTEE', async () => {
      const room = await createRoom('R15', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );

      const cancelled = await service.cancel(
        task.id,
        userGouv.id,
        'Changement planning',
      );
      expect(cancelled.statut).toBe(StatutTacheHousekeeping.ANNULEE);
      expect(cancelled.activeRoomKey).toBeNull();

      // Vérifie qu'on peut maintenant recréer une tâche active sur cette chambre
      const task2 = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );
      expect(task2.statut).toBe(StatutTacheHousekeeping.A_FAIRE);
    });
  });

  describe('Concurrence & Transactions (Concurrency)', () => {
    it('ne permet pas de créer deux tâches actives en même temps pour la même chambre', async () => {
      const room = await createRoom('R16', StatutChambre.A_NETTOYER);

      const [res1, res2] = await Promise.allSettled([
        service.createTask(room.id, OrigineTacheHousekeeping.MANUELLE),
        service.createTask(room.id, OrigineTacheHousekeeping.MANUELLE),
      ]);

      const success = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r) => r.status === 'rejected');

      expect(success).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);

      const activeTasks = await prisma.housekeepingTask.findMany({
        where: { roomId: room.id, activeRoomKey: room.id },
      });
      expect(activeTasks).toHaveLength(1);
    });

    it('ne permet pas de démarrer la même tâche deux fois simultanément', async () => {
      const room = await createRoom('R17', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );
      await service.assign(task.id, userAgent.id, userGouv.id);

      const [res1, res2] = await Promise.allSettled([
        service.start(task.id, userAgent.id),
        service.start(task.id, userAgent.id),
      ]);

      const success = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r) => r.status === 'rejected');

      expect(success).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    });

    it('ne permet pas de valider et refuser la même tâche en même temps', async () => {
      const room = await createRoom('R18', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );
      await service.assign(task.id, userAgent.id, userGouv.id);
      await service.start(task.id, userAgent.id);
      await service.complete(task.id, userAgent.id);

      const [resVal, resRef] = await Promise.allSettled([
        service.validate(task.id, userGouv.id, 'Valide'),
        service.refuse(task.id, userGouv.id, 'Refusé'),
      ]);

      const success = [resVal, resRef].filter((r) => r.status === 'fulfilled');
      const rejected = [resVal, resRef].filter((r) => r.status === 'rejected');

      expect(success).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const freshTask = await prisma.housekeepingTask.findUnique({
        where: { id: task.id },
      });
      expect(['VALIDEE', 'EN_COURS']).toContain(freshTask.statut);
    });

    it('ne permet pas de valider la même tâche deux fois simultanément', async () => {
      const room = await createRoom('R20', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );
      await service.assign(task.id, userAgent.id, userGouv.id);
      await service.start(task.id, userAgent.id);
      await service.complete(task.id, userAgent.id);

      const [res1, res2] = await Promise.allSettled([
        service.validate(task.id, userGouv.id, 'Valide 1'),
        service.validate(task.id, userGouv.id, 'Valide 2'),
      ]);

      const success = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r) => r.status === 'rejected');

      expect(success).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    });

    it('assure l’atomicité et le rollback complet en cas d’erreur au démarrage', async () => {
      const room = await createRoom('R19', StatutChambre.A_NETTOYER);
      const task = await service.createTask(
        room.id,
        OrigineTacheHousekeeping.MANUELLE,
      );
      await service.assign(task.id, userAgent.id, userGouv.id);

      await expect(
        service.start(task.id, 999999), // Acteur inexistant
      ).rejects.toThrow();

      const freshTask = await prisma.housekeepingTask.findUnique({
        where: { id: task.id },
      });
      const freshRoom = await prisma.room.findUnique({
        where: { id: room.id },
      });

      expect(freshTask.statut).toBe(StatutTacheHousekeeping.AFFECTEE);
      expect(freshRoom.statut).toBe(StatutChambre.A_NETTOYER);

      const logs = await prisma.housekeepingTaskLog.findMany({
        where: { taskId: task.id, type: TypeLogTacheHousekeeping.DEMARRAGE },
      });
      expect(logs).toHaveLength(0);
    });
  });
});
