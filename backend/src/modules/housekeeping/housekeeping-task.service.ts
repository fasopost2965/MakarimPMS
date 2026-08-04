import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HousekeepingTask,
  OrigineTacheHousekeeping,
  Prisma,
  StatutChambre,
  StatutTacheHousekeeping,
  TypeLogTacheHousekeeping,
  AuditAction,
  AuditEntity,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { StayService } from '../stay/stay.service';
import { HousekeepingTaskQueryDto } from './dto/housekeeping-task-query.dto';

@Injectable()
export class HousekeepingTaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
    private readonly stayService: StayService,
  ) {}

  async findAll(
    query: HousekeepingTaskQueryDto = {} as HousekeepingTaskQueryDto,
  ) {
    const {
      page = 1,
      limit = 25,
      roomId,
      assignedUserId,
      statut,
      active,
    } = query;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const where: Prisma.HousekeepingTaskWhereInput = {};
    if (roomId) where.roomId = roomId;
    if (assignedUserId) where.assignedUserId = assignedUserId;
    if (statut) where.statut = statut;
    if (active === true) where.activeRoomKey = { not: null };
    if (active === false) where.activeRoomKey = null;

    const [items, total] = await Promise.all([
      this.prisma.housekeepingTask.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          room: {
            select: {
              id: true,
              numero: true,
              etage: true,
              statut: true,
              roomTypeId: true,
            },
          },
          assignedUser: { select: { id: true, nom: true, actif: true } },
        },
      }),
      this.prisma.housekeepingTask.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findOne(id: number) {
    const task = await this.prisma.housekeepingTask.findUnique({
      where: { id },
      include: {
        room: {
          select: {
            id: true,
            numero: true,
            etage: true,
            statut: true,
            roomTypeId: true,
          },
        },
        assignedUser: { select: { id: true, nom: true, actif: true } },
      },
    });
    if (!task) {
      throw new NotFoundException(`Tâche ${id} introuvable`);
    }
    return task;
  }

  async findHistory(
    id: number,
    query: HousekeepingTaskQueryDto = {} as HousekeepingTaskQueryDto,
  ) {
    const task = await this.prisma.housekeepingTask.findUnique({
      where: { id },
    });
    if (!task) {
      throw new NotFoundException(`Tâche ${id} introuvable`);
    }

    const { page = 1, limit = 25 } = query;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const [items, total] = await Promise.all([
      this.prisma.housekeepingTaskLog.findMany({
        where: { taskId: id },
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.housekeepingTaskLog.count({
        where: { taskId: id },
      }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findAssignableUsers() {
    return this.prisma.user.findMany({
      where: {
        actif: true,
        deletedAt: null,
        role: {
          permissions: {
            some: {
              permission: {
                module: 'housekeeping',
                action: 'write',
              },
            },
          },
        },
      },
      select: {
        id: true,
        nom: true,
        actif: true,
      },
      orderBy: [{ nom: 'asc' }, { id: 'asc' }],
    });
  }

  private async runInTx<T>(
    tx: Prisma.TransactionClient | undefined,
    fn: (t: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (tx) {
      return fn(tx);
    }
    return this.prisma.$transaction((innerTx) => fn(innerTx));
  }

  private async lockTaskForUpdate(
    taskId: number,
    tx: Prisma.TransactionClient,
  ): Promise<HousekeepingTask> {
    const tasks = await tx.$queryRaw<HousekeepingTask[]>`
      SELECT id, roomId, assignedUserId, statut, origine, sourceEventKey, activeRoomKey, assignedAt, startedAt, completedAt, validatedAt, cancelledAt, createdAt, updatedAt
      FROM HousekeepingTask
      WHERE id = ${taskId}
      FOR UPDATE
    `;
    if (!tasks || tasks.length === 0) {
      throw new NotFoundException(`Tâche housekeeping ${taskId} introuvable.`);
    }
    return tasks[0];
  }

  async createManual(roomId: number, motif: string, actorUserId: number) {
    return this.runInTx(undefined, async (t) => {
      const actorUser = await t.user.findUnique({
        where: { id: actorUserId, deletedAt: null },
        select: { nom: true },
      });
      if (!actorUser) {
        throw new NotFoundException(`Acteur ${actorUserId} introuvable.`);
      }

      // Check for authorization (write permission required)
      const hasWrite = await this.authService.hasPermission(
        actorUserId,
        'housekeeping',
        'write',
        t,
      );
      if (!hasWrite) {
        throw new ForbiddenException(
          `Permission requise : housekeeping:write.`,
        );
      }

      const task = await this.createTask(
        roomId,
        OrigineTacheHousekeeping.MANUELLE,
        undefined,
        t,
      );

      // Update the default creation log with manual details
      const latestLog = await t.housekeepingTaskLog.findFirst({
        where: { taskId: task.id },
        orderBy: { id: 'desc' },
      });
      if (latestLog) {
        await t.housekeepingTaskLog.update({
          where: { id: latestLog.id },
          data: { motif, actorUserId, actorUserNom: actorUser.nom },
        });
      }

      return task;
    });
  }

  async createTask(
    roomId: number,
    origine: OrigineTacheHousekeeping,
    sourceEventKey?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.runInTx(tx, async (t) => {
      // 1. Verrou Room
      const room = await this.roomsService.lockRoomForUpdate(roomId, t);

      // Idempotency check if sourceEventKey is provided
      if (sourceEventKey) {
        const existing = await t.housekeepingTask.findFirst({
          where: { sourceEventKey },
        });
        if (existing) {
          return existing;
        }
      }

      // Verification for manual creation
      if (origine === OrigineTacheHousekeeping.MANUELLE) {
        if (room.statut !== StatutChambre.A_NETTOYER) {
          throw new ConflictException(
            `Création manuelle refusée : la chambre est au statut ${room.statut}, attendu ${StatutChambre.A_NETTOYER}.`,
          );
        }
        // Check for any active task
        const activeTask = await t.housekeepingTask.findUnique({
          where: { activeRoomKey: roomId },
        });
        if (activeTask) {
          throw new ConflictException(
            `Création manuelle refusée : la chambre a déjà une tâche active (ID ${activeTask.id}).`,
          );
        }
      }

      // Check active task uniqueness constraint
      const activeTask = await t.housekeepingTask.findUnique({
        where: { activeRoomKey: roomId },
      });
      if (activeTask) {
        throw new ConflictException(
          `La chambre ${room.numero} a déjà une tâche active (ID ${activeTask.id}).`,
        );
      }

      // Create the task
      const task = await t.housekeepingTask.create({
        data: {
          roomId,
          statut: StatutTacheHousekeeping.A_FAIRE,
          origine,
          activeRoomKey: roomId,
          sourceEventKey,
        },
      });

      // Create log (append-only)
      await t.housekeepingTaskLog.create({
        data: {
          taskId: task.id,
          type: TypeLogTacheHousekeeping.CREATION,
          nouveauStatut: StatutTacheHousekeeping.A_FAIRE,
          motif: `Création de la tâche de ménage (${origine}).`,
        },
      });

      return task;
    });
  }

  async assign(
    taskId: number,
    assignedUserId: number | null,
    actorUserId: number,
    motif?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.runInTx(tx, async (t) => {
      const taskTemp = await t.housekeepingTask.findUnique({
        where: { id: taskId },
      });
      if (!taskTemp) {
        throw new NotFoundException(
          `Tâche housekeeping ${taskId} introuvable.`,
        );
      }

      // 1. Verrou Room
      await this.roomsService.lockRoomForUpdate(taskTemp.roomId, t);

      // 2. Verrou Task (and get fresh state directly from DB to bypass stale repeatable read snapshot cache)
      const task = await this.lockTaskForUpdate(taskId, t);

      // Check if task is active
      const activeStatuses: StatutTacheHousekeeping[] = [
        StatutTacheHousekeeping.A_FAIRE,
        StatutTacheHousekeeping.AFFECTEE,
        StatutTacheHousekeeping.EN_COURS,
        StatutTacheHousekeeping.TERMINEE,
      ];
      if (!activeStatuses.includes(task.statut)) {
        throw new ConflictException(
          `La tâche ${taskId} n'est pas active (statut actuel : ${task.statut}).`,
        );
      }

      // If task is EN_COURS, reassignment or de-assignment is forbidden
      if (task.statut === StatutTacheHousekeeping.EN_COURS) {
        throw new ConflictException(
          `Impossible d'affecter ou de désaffecter une tâche en cours de nettoyage.`,
        );
      }

      // Verify actor user exists
      const actorUser = await t.user.findUnique({
        where: { id: actorUserId, deletedAt: null },
        select: { nom: true },
      });
      if (!actorUser) {
        throw new NotFoundException(
          `Utilisateur acteur ${actorUserId} introuvable.`,
        );
      }

      // Check dynamic permissions for the actor
      const hasWrite = await this.authService.hasPermission(
        actorUserId,
        'housekeeping',
        'write',
        t,
      );
      const hasControl = await this.authService.hasPermission(
        actorUserId,
        'housekeeping',
        'control',
        t,
      );
      if (!hasWrite && !hasControl) {
        throw new ForbiddenException(
          `Permission requise : housekeeping:write ou housekeeping:control.`,
        );
      }

      const ancienAssignedUserId = task.assignedUserId;
      let ancienAssignedUserNom: string | null = null;
      if (ancienAssignedUserId) {
        const oldUser = await t.user.findUnique({
          where: { id: ancienAssignedUserId },
          select: { nom: true },
        });
        ancienAssignedUserNom = oldUser ? oldUser.nom : null;
      }

      let nouveauStatut = task.statut;
      let typeLog: TypeLogTacheHousekeeping;
      let nouveauAssignedUserNom: string | null = null;

      const now = new Date();
      let assignedAt = task.assignedAt;

      if (assignedUserId === null) {
        // De-assignment
        if (task.statut !== StatutTacheHousekeeping.AFFECTEE) {
          throw new ConflictException(
            `Désaffectation impossible : la tâche n'est pas affectée (statut actuel : ${task.statut}).`,
          );
        }
        nouveauStatut = StatutTacheHousekeeping.A_FAIRE;
        typeLog = TypeLogTacheHousekeeping.RETRAIT_AFFECTATION;
      } else {
        // Assignment or Re-assignment
        const newUser = await t.user.findUnique({
          where: { id: assignedUserId, deletedAt: null },
          select: { nom: true, actif: true },
        });
        if (!newUser || !newUser.actif) {
          throw new ConflictException(
            `L'utilisateur affecté ${assignedUserId} est introuvable ou inactif.`,
          );
        }
        nouveauAssignedUserNom = newUser.nom;

        nouveauStatut = StatutTacheHousekeeping.AFFECTEE;
        if (task.statut === StatutTacheHousekeeping.AFFECTEE) {
          // Reassignment
          if (!motif || motif.trim().length === 0) {
            throw new ConflictException(
              `Un motif est obligatoire pour une réaffectation.`,
            );
          }
          typeLog = TypeLogTacheHousekeeping.REAFFECTATION;
        } else {
          // First assignment
          typeLog = TypeLogTacheHousekeeping.AFFECTATION;
          if (!assignedAt) {
            assignedAt = now;
          }
        }
      }

      // Update task
      const updated = await t.housekeepingTask.update({
        where: { id: taskId },
        data: {
          assignedUserId,
          statut: nouveauStatut,
          assignedAt,
        },
      });

      // Create task log
      await t.housekeepingTaskLog.create({
        data: {
          taskId,
          type: typeLog,
          nouveauStatut,
          actorUserId,
          actorUserNom: actorUser.nom,
          ancienAssignedUserId,
          nouveauAssignedUserId: assignedUserId,
          ancienAssignedUserNom,
          nouveauAssignedUserNom,
          motif: motif ?? `Mise à jour de l'affectation.`,
        },
      });

      // Write audit log if it's a reassignment or de-assignment
      if (
        typeLog === TypeLogTacheHousekeeping.REAFFECTATION ||
        typeLog === TypeLogTacheHousekeeping.RETRAIT_AFFECTATION
      ) {
        await this.auditService.writeLog(t, {
          userId: actorUserId,
          action: AuditAction.REASSIGN_HOUSEKEEPING_TASK,
          targetEntity: AuditEntity.HousekeepingTask,
          targetId: taskId,
          oldValue: ancienAssignedUserId
            ? { id: ancienAssignedUserId }
            : undefined,
          newValue: assignedUserId ? { id: assignedUserId } : undefined,
          motif: motif ?? `Modification de l'affectation.`,
        });
      }

      return updated;
    });
  }

  async start(
    taskId: number,
    actorUserId: number,
    tx?: Prisma.TransactionClient,
  ) {
    return this.runInTx(tx, async (t) => {
      const taskTemp = await t.housekeepingTask.findUnique({
        where: { id: taskId },
      });
      if (!taskTemp) {
        throw new NotFoundException(
          `Tâche housekeeping ${taskId} introuvable.`,
        );
      }

      // 1. Verrou Room
      const room = await this.roomsService.lockRoomForUpdate(
        taskTemp.roomId,
        t,
      );

      // 2. Verrou Task (and get fresh state directly from DB to bypass stale repeatable read snapshot cache)
      const task = await this.lockTaskForUpdate(taskId, t);

      // Checks
      if (task.statut !== StatutTacheHousekeeping.AFFECTEE) {
        throw new ConflictException(
          `La tâche doit être affectée pour démarrer.`,
        );
      }
      if (!task.assignedUserId) {
        throw new ConflictException(`La tâche n'a pas d'agent affecté.`);
      }
      if (room.statut === StatutChambre.EN_MAINTENANCE) {
        throw new ConflictException(
          `Démarrage impossible : la chambre est en maintenance.`,
        );
      }
      if (room.statut !== StatutChambre.A_NETTOYER) {
        throw new ConflictException(
          `La chambre doit être au statut A_NETTOYER pour démarrer.`,
        );
      }

      // Authorization: Actor must be the assigned agent, OR have housekeeping:control
      const actorUser = await t.user.findUnique({
        where: { id: actorUserId, deletedAt: null },
        select: { nom: true },
      });
      if (!actorUser) {
        throw new NotFoundException(`Acteur ${actorUserId} introuvable.`);
      }

      if (actorUserId !== task.assignedUserId) {
        const hasControl = await this.authService.hasPermission(
          actorUserId,
          'housekeeping',
          'control',
          t,
        );
        if (!hasControl) {
          throw new ForbiddenException(
            `Permission requise : être l'agent affecté ou posséder la permission housekeeping:control.`,
          );
        }
      }

      // Transition room: A_NETTOYER -> EN_NETTOYAGE
      await this.roomsService.transitionRoom(
        task.roomId,
        StatutChambre.EN_NETTOYAGE,
        {
          motif: `Démarrage du nettoyage (Tâche #${taskId}).`,
          userId: actorUserId,
          tx: t,
        },
      );

      const now = new Date();
      const updated = await t.housekeepingTask.update({
        where: { id: taskId },
        data: {
          statut: StatutTacheHousekeeping.EN_COURS,
          startedAt: task.startedAt ?? now,
        },
      });

      // Log
      await t.housekeepingTaskLog.create({
        data: {
          taskId,
          type: TypeLogTacheHousekeeping.DEMARRAGE,
          nouveauStatut: StatutTacheHousekeeping.EN_COURS,
          actorUserId,
          actorUserNom: actorUser.nom,
          motif: `Début du nettoyage.`,
        },
      });

      return updated;
    });
  }

  async complete(
    taskId: number,
    actorUserId: number,
    tx?: Prisma.TransactionClient,
  ) {
    return this.runInTx(tx, async (t) => {
      const taskTemp = await t.housekeepingTask.findUnique({
        where: { id: taskId },
      });
      if (!taskTemp) {
        throw new NotFoundException(
          `Tâche housekeeping ${taskId} introuvable.`,
        );
      }

      // 1. Verrou Room
      const room = await this.roomsService.lockRoomForUpdate(
        taskTemp.roomId,
        t,
      );

      // 2. Verrou Task (and get fresh state directly from DB to bypass stale repeatable read snapshot cache)
      const task = await this.lockTaskForUpdate(taskId, t);

      // Checks
      if (task.statut !== StatutTacheHousekeeping.EN_COURS) {
        throw new ConflictException(
          `La tâche doit être en cours pour être complétée.`,
        );
      }
      if (room.statut === StatutChambre.EN_MAINTENANCE) {
        throw new ConflictException(
          `Complétion impossible : la chambre est en maintenance.`,
        );
      }
      if (room.statut !== StatutChambre.EN_NETTOYAGE) {
        throw new ConflictException(
          `La chambre doit être au statut EN_NETTOYAGE.`,
        );
      }

      // Authorization: Actor must be the assigned agent, OR have housekeeping:control
      const actorUser = await t.user.findUnique({
        where: { id: actorUserId, deletedAt: null },
        select: { nom: true },
      });
      if (!actorUser) {
        throw new NotFoundException(`Acteur ${actorUserId} introuvable.`);
      }

      if (actorUserId !== task.assignedUserId) {
        const hasControl = await this.authService.hasPermission(
          actorUserId,
          'housekeeping',
          'control',
          t,
        );
        if (!hasControl) {
          throw new ForbiddenException(
            `Permission requise : être l'agent affecté ou posséder la permission housekeeping:control.`,
          );
        }
      }

      const now = new Date();
      const updated = await t.housekeepingTask.update({
        where: { id: taskId },
        data: {
          statut: StatutTacheHousekeeping.TERMINEE,
          completedAt: task.completedAt ?? now,
        },
      });

      // Log
      await t.housekeepingTaskLog.create({
        data: {
          taskId,
          type: TypeLogTacheHousekeeping.COMPLETION,
          nouveauStatut: StatutTacheHousekeeping.TERMINEE,
          actorUserId,
          actorUserNom: actorUser.nom,
          motif: `Nettoyage terminé, en attente de contrôle.`,
        },
      });

      return updated;
    });
  }

  async validate(
    taskId: number,
    actorUserId: number,
    motif: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (!motif || motif.trim().length === 0) {
      throw new ConflictException(
        `Un motif est obligatoire pour valider la tâche.`,
      );
    }

    return this.runInTx(tx, async (t) => {
      const taskTemp = await t.housekeepingTask.findUnique({
        where: { id: taskId },
      });
      if (!taskTemp) {
        throw new NotFoundException(
          `Tâche housekeeping ${taskId} introuvable.`,
        );
      }

      // 1. Verrou Room
      const room = await this.roomsService.lockRoomForUpdate(
        taskTemp.roomId,
        t,
      );

      // 2. Verrou Task (and get fresh state directly from DB to bypass stale repeatable read snapshot cache)
      const task = await this.lockTaskForUpdate(taskId, t);

      // Checks
      if (task.statut !== StatutTacheHousekeeping.TERMINEE) {
        throw new ConflictException(
          `La tâche doit être terminée pour être validée.`,
        );
      }
      if (room.statut !== StatutChambre.EN_NETTOYAGE) {
        throw new ConflictException(
          `La chambre doit être au statut EN_NETTOYAGE.`,
        );
      }

      // Authorization: Actor must have housekeeping:control
      const hasControl = await this.authService.hasPermission(
        actorUserId,
        'housekeeping',
        'control',
        t,
      );
      if (!hasControl) {
        throw new ForbiddenException(
          `Permission requise : housekeeping:control.`,
        );
      }

      // Auto-validation check: Actor cannot be the assigned user
      if (actorUserId === task.assignedUserId) {
        throw new ConflictException(
          `Auto-validation interdite : le contrôleur ne peut pas être l'agent affecté.`,
        );
      }

      const actorUser = await t.user.findUnique({
        where: { id: actorUserId, deletedAt: null },
        select: { nom: true },
      });
      if (!actorUser) {
        throw new NotFoundException(`Acteur ${actorUserId} introuvable.`);
      }

      // Transition room: EN_NETTOYAGE -> LIBRE_PROPRE
      await this.roomsService.transitionRoom(
        task.roomId,
        StatutChambre.LIBRE_PROPRE,
        {
          motif: `Validation du nettoyage (Tâche #${taskId}).`,
          userId: actorUserId,
          tx: t,
        },
      );

      const now = new Date();
      const updated = await t.housekeepingTask.update({
        where: { id: taskId },
        data: {
          statut: StatutTacheHousekeeping.VALIDEE,
          validatedAt: task.validatedAt ?? now,
          activeRoomKey: null, // Clear active key
        },
      });

      // Log
      await t.housekeepingTaskLog.create({
        data: {
          taskId,
          type: TypeLogTacheHousekeeping.VALIDATION,
          nouveauStatut: StatutTacheHousekeeping.VALIDEE,
          actorUserId,
          actorUserNom: actorUser.nom,
          motif,
        },
      });

      // Audit Log
      await this.auditService.writeLog(t, {
        userId: actorUserId,
        action: AuditAction.VALIDATE_HOUSEKEEPING_TASK,
        targetEntity: AuditEntity.HousekeepingTask,
        targetId: taskId,
        motif,
      });

      return updated;
    });
  }

  async refuse(
    taskId: number,
    actorUserId: number,
    motif: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (!motif || motif.trim().length === 0) {
      throw new ConflictException(
        `Un motif est obligatoire pour refuser le contrôle.`,
      );
    }

    return this.runInTx(tx, async (t) => {
      const taskTemp = await t.housekeepingTask.findUnique({
        where: { id: taskId },
      });
      if (!taskTemp) {
        throw new NotFoundException(
          `Tâche housekeeping ${taskId} introuvable.`,
        );
      }

      // 1. Verrou Room
      const room = await this.roomsService.lockRoomForUpdate(
        taskTemp.roomId,
        t,
      );

      // 2. Verrou Task (and get fresh state directly from DB to bypass stale repeatable read snapshot cache)
      const task = await this.lockTaskForUpdate(taskId, t);

      // Checks
      if (task.statut !== StatutTacheHousekeeping.TERMINEE) {
        throw new ConflictException(
          `La tâche doit être terminée pour être refusée.`,
        );
      }
      if (room.statut !== StatutChambre.EN_NETTOYAGE) {
        throw new ConflictException(
          `La chambre doit être au statut EN_NETTOYAGE.`,
        );
      }

      // Authorization: Actor must have housekeeping:control
      const hasControl = await this.authService.hasPermission(
        actorUserId,
        'housekeeping',
        'control',
        t,
      );
      if (!hasControl) {
        throw new ForbiddenException(
          `Permission requise : housekeeping:control.`,
        );
      }

      const actorUser = await t.user.findUnique({
        where: { id: actorUserId, deletedAt: null },
        select: { nom: true },
      });
      if (!actorUser) {
        throw new NotFoundException(`Acteur ${actorUserId} introuvable.`);
      }

      // Refuse transition: task goes back to EN_COURS.
      const updated = await t.housekeepingTask.update({
        where: { id: taskId },
        data: {
          statut: StatutTacheHousekeeping.EN_COURS,
        },
      });

      // Log
      await t.housekeepingTaskLog.create({
        data: {
          taskId,
          type: TypeLogTacheHousekeeping.REFUS_CONTROLE,
          nouveauStatut: StatutTacheHousekeeping.EN_COURS,
          actorUserId,
          actorUserNom: actorUser.nom,
          motif,
        },
      });

      // Audit Log
      await this.auditService.writeLog(t, {
        userId: actorUserId,
        action: AuditAction.REFUSE_HOUSEKEEPING_TASK,
        targetEntity: AuditEntity.HousekeepingTask,
        targetId: taskId,
        motif,
      });

      return updated;
    });
  }

  async cancel(
    taskId: number,
    actorUserId: number,
    motif: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (!motif || motif.trim().length === 0) {
      throw new ConflictException(
        `Un motif est obligatoire pour annuler la tâche.`,
      );
    }

    return this.runInTx(tx, async (t) => {
      const taskTemp = await t.housekeepingTask.findUnique({
        where: { id: taskId },
      });
      if (!taskTemp) {
        throw new NotFoundException(
          `Tâche housekeeping ${taskId} introuvable.`,
        );
      }

      // 1. Verrou Room
      await this.roomsService.lockRoomForUpdate(taskTemp.roomId, t);

      // 2. Verrou Task (and get fresh state directly from DB to bypass stale repeatable read snapshot cache)
      const task = await this.lockTaskForUpdate(taskId, t);

      // Checks
      const cancellableStatuses: StatutTacheHousekeeping[] = [
        StatutTacheHousekeeping.A_FAIRE,
        StatutTacheHousekeeping.AFFECTEE,
      ];
      if (!cancellableStatuses.includes(task.statut)) {
        throw new ConflictException(
          `Annulation impossible : la tâche est dans un statut non annulable (${task.statut}).`,
        );
      }

      // Authorization: Actor must have housekeeping:write or housekeeping:control
      const hasWrite = await this.authService.hasPermission(
        actorUserId,
        'housekeeping',
        'write',
        t,
      );
      const hasControl = await this.authService.hasPermission(
        actorUserId,
        'housekeeping',
        'control',
        t,
      );
      if (!hasWrite && !hasControl) {
        throw new ForbiddenException(
          `Permission requise : housekeeping:write ou housekeeping:control.`,
        );
      }

      const actorUser = await t.user.findUnique({
        where: { id: actorUserId, deletedAt: null },
        select: { nom: true },
      });
      if (!actorUser) {
        throw new NotFoundException(`Acteur ${actorUserId} introuvable.`);
      }

      const now = new Date();
      const updated = await t.housekeepingTask.update({
        where: { id: taskId },
        data: {
          statut: StatutTacheHousekeeping.ANNULEE,
          cancelledAt: task.cancelledAt ?? now,
          activeRoomKey: null, // Clear active key
        },
      });

      // Log
      await t.housekeepingTaskLog.create({
        data: {
          taskId,
          type: TypeLogTacheHousekeeping.ANNULATION,
          nouveauStatut: StatutTacheHousekeeping.ANNULEE,
          actorUserId,
          actorUserNom: actorUser.nom,
          motif,
        },
      });

      // Audit Log
      await this.auditService.writeLog(t, {
        userId: actorUserId,
        action: AuditAction.CANCEL_HOUSEKEEPING_TASK,
        targetEntity: AuditEntity.HousekeepingTask,
        targetId: taskId,
        motif,
      });

      return updated;
    });
  }

  async reopen(
    taskId: number,
    actorUserId: number,
    motif: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (!motif || motif.trim().length === 0) {
      throw new ConflictException(
        `Un motif est obligatoire pour rouvrir la tâche.`,
      );
    }

    return this.runInTx(tx, async (t) => {
      const taskTemp = await t.housekeepingTask.findUnique({
        where: { id: taskId },
      });
      if (!taskTemp) {
        throw new NotFoundException(
          `Tâche housekeeping ${taskId} introuvable.`,
        );
      }

      // 1. Verrou Room
      const room = await this.roomsService.lockRoomForUpdate(
        taskTemp.roomId,
        t,
      );

      // 2. Verrou Task (and get fresh state directly from DB to bypass stale repeatable read snapshot cache)
      const task = await this.lockTaskForUpdate(taskId, t);

      // Checks
      if (task.statut !== StatutTacheHousekeeping.VALIDEE) {
        throw new ConflictException(
          `La tâche doit être VALIDEE pour être rouverte.`,
        );
      }
      if (room.statut !== StatutChambre.LIBRE_PROPRE) {
        throw new ConflictException(
          `La chambre doit être au statut LIBRE_PROPRE pour être rouverte.`,
        );
      }

      // Check if another active task exists
      const activeTask = await t.housekeepingTask.findFirst({
        where: { activeRoomKey: task.roomId },
      });
      if (activeTask) {
        throw new ConflictException(
          `Une autre tâche active existe déjà pour cette chambre.`,
        );
      }

      // Check if an active stay is in progress for this room
      const activeStay = await this.stayService.findActiveStayForRoom(
        task.roomId,
      );
      if (activeStay) {
        throw new ConflictException(
          `Un séjour actif est en cours dans cette chambre.`,
        );
      }

      // Authorization: Actor must have housekeeping:control
      const hasControl = await this.authService.hasPermission(
        actorUserId,
        'housekeeping',
        'control',
        t,
      );
      if (!hasControl) {
        throw new ForbiddenException(
          `Permission requise : housekeeping:control.`,
        );
      }

      const actorUser = await t.user.findUnique({
        where: { id: actorUserId, deletedAt: null },
        select: { nom: true },
      });
      if (!actorUser) {
        throw new NotFoundException(`Acteur ${actorUserId} introuvable.`);
      }

      // Transition room: LIBRE_PROPRE -> A_NETTOYER
      await this.roomsService.transitionRoom(
        task.roomId,
        StatutChambre.A_NETTOYER,
        {
          motif: `Réouverture du nettoyage (Tâche #${taskId}).`,
          userId: actorUserId,
          tx: t,
        },
      );

      // Reopen task: assignedUserId reset to null, activeRoomKey restored to roomId, statut to A_FAIRE
      const updated = await t.housekeepingTask.update({
        where: { id: taskId },
        data: {
          statut: StatutTacheHousekeeping.A_FAIRE,
          assignedUserId: null,
          activeRoomKey: task.roomId,
        },
      });

      // Log
      await t.housekeepingTaskLog.create({
        data: {
          taskId,
          type: TypeLogTacheHousekeeping.REOUVERTURE,
          nouveauStatut: StatutTacheHousekeeping.A_FAIRE,
          actorUserId,
          actorUserNom: actorUser.nom,
          motif,
        },
      });

      // Audit Log
      await this.auditService.writeLog(t, {
        userId: actorUserId,
        action: AuditAction.REOPEN_HOUSEKEEPING_TASK,
        targetEntity: AuditEntity.HousekeepingTask,
        targetId: taskId,
        motif,
      });

      return updated;
    });
  }

  async handleCheckoutEffectue(
    stayId: number,
    roomId: number,
    tx?: Prisma.TransactionClient,
  ) {
    return this.runInTx(tx, async (t) => {
      const sourceEventKey = `checkout:${stayId}`;

      // 1. Verrou Room
      const room = await this.roomsService.lockRoomForUpdate(roomId, t);

      // 2. Créer ou récupérer la tâche idempotente
      let task = await t.housekeepingTask.findFirst({
        where: { sourceEventKey },
      });

      if (!task) {
        task = await this.createTask(
          roomId,
          OrigineTacheHousekeeping.CHECKOUT,
          sourceEventKey,
          t,
        );
      }

      // 3. Transitionner la chambre vers A_NETTOYER si nécessaire
      if (room.statut !== StatutChambre.A_NETTOYER) {
        await this.roomsService.transitionRoom(
          roomId,
          StatutChambre.A_NETTOYER,
          {
            motif: `Checkout du séjour #${stayId} - passage à A_NETTOYER.`,
            userId: undefined, // System action
            tx: t,
          },
        );
      }

      return task;
    });
  }

  async reconcileDirtyRooms(
    actorUserId: number,
    tx?: Prisma.TransactionClient,
  ) {
    return this.runInTx(tx, async (t) => {
      // Find all rooms in A_NETTOYER or EN_NETTOYAGE statuses
      const dirtyRooms = await t.room.findMany({
        where: {
          statut: {
            in: [StatutChambre.A_NETTOYER, StatutChambre.EN_NETTOYAGE],
          },
        },
      });

      const results = { created: 0, skipped: 0 };

      for (const room of dirtyRooms) {
        // Find active task for room
        const activeTask = await t.housekeepingTask.findUnique({
          where: { activeRoomKey: room.id },
        });

        if (!activeTask) {
          // No active task, we must create one.
          // Origin: REPRISE
          const statutTache =
            room.statut === StatutChambre.EN_NETTOYAGE
              ? StatutTacheHousekeeping.EN_COURS
              : StatutTacheHousekeeping.A_FAIRE;

          const task = await t.housekeepingTask.create({
            data: {
              roomId: room.id,
              statut: statutTache,
              origine: OrigineTacheHousekeeping.REPRISE,
              activeRoomKey: room.id,
              // For EN_NETTOYAGE, startedAt remains null since we don't know the exact time
            },
          });

          await t.housekeepingTaskLog.create({
            data: {
              taskId: task.id,
              type: TypeLogTacheHousekeeping.CREATION,
              nouveauStatut: statutTache,
              motif: `Création par réconciliation (statut chambre: ${room.statut}).`,
              actorUserId: null,
            },
          });

          results.created++;
        } else {
          results.skipped++;
        }
      }

      return results;
    });
  }
}
