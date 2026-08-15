import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntity,
  BusinessDayStatus,
  NightAuditExceptionSeverity,
  NightAuditExceptionStatus,
  NightAuditRunStatus,
  NightAuditStepStatus,
  NightAuditStepType,
  Prisma,
  StatutChambre,
  StatutReservation,
  StatutSejour,
  TypeLigneFolio,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReservationsService } from '../reservations/reservations.service';
import { StayService } from '../stay/stay.service';
import { HousekeepingTaskService } from '../housekeeping/housekeeping-task.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { BusinessDateService } from './business-date.service';
import { AcknowledgeWarningDto } from './dto/acknowledge-warning.dto';
import { CloseNightAuditDto } from './dto/close-night-audit.dto';
import { dayRange, formatBusinessDateKey } from './utils/business-date.util';

interface DetectedException {
  code: string;
  severity: NightAuditExceptionSeverity;
  entityType: string;
  entityId: number | null;
  message: string;
  metadata?: Prisma.InputJsonValue;
}

const RUN_INCLUDE = {
  businessDay: true,
  steps: { orderBy: { id: 'asc' as const } },
  exceptions: { orderBy: { id: 'asc' as const } },
};

type RunWithDetails = Prisma.NightAuditRunGetPayload<{
  include: typeof RUN_INCLUDE;
}>;

// ARCH-011A — orchestrateur du workflow de clôture de nuit. Ne mute JAMAIS
// Reservation/Stay/Housekeeping/Maintenance/Billing (CLAUDE.md) : toutes
// les lectures de PRECHECK passent par les façades des modules
// propriétaires ; la RECONCILIATION lit Prisma directement pour les
// agrégats cross-domaine (même convention que
// FinancialReportingService, docs/modules/reporting.md) — jamais une
// écriture. `businessDayId` n'est ajouté à AUCUNE table métier existante
// (Payment/FolioLine/Invoice) : hors scope absolu de cette itération.
@Injectable()
export class NightAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessDateService: BusinessDateService,
    private readonly auditService: AuditService,
    private readonly reservationsService: ReservationsService,
    private readonly stayService: StayService,
    private readonly housekeepingTaskService: HousekeepingTaskService,
    private readonly maintenanceService: MaintenanceService,
  ) {}

  // --- Lecture ------------------------------------------------------------

  async getCurrent() {
    const businessDay = await this.businessDateService.getCurrentBusinessDay();
    const run = await this.prisma.nightAuditRun.findFirst({
      where: { businessDayId: businessDay.id },
      orderBy: { id: 'desc' },
      include: RUN_INCLUDE,
    });
    return { businessDay, run };
  }

  async getHistory() {
    return this.prisma.businessDay.findMany({
      where: { status: BusinessDayStatus.CLOSED },
      orderBy: { date: 'desc' },
      include: {
        nightAuditRuns: {
          where: { status: NightAuditRunStatus.COMPLETED },
          select: {
            id: true,
            status: true,
            completedAt: true,
            reportVersion: true,
          },
        },
      },
    });
  }

  // Snapshot figé — jamais recalculé une fois la BusinessDay CLOSED :
  // cette méthode ne fait que RELIRE reportSnapshot tel quel, aucune
  // méthode de ce service ne le réécrit après un close() réussi.
  async getReport(runId: number) {
    const run = await this.getRunOrThrow(runId);
    if (!run.reportSnapshot) {
      throw new NotFoundException(
        `Aucun rapport de réconciliation disponible pour le run ${runId} (réconciliation non encore exécutée).`,
      );
    }
    return {
      runId: run.id,
      businessDate: run.businessDay.date,
      reportVersion: run.reportVersion,
      runStatus: run.status,
      snapshot: run.reportSnapshot,
    };
  }

  private async getRunOrThrow(runId: number): Promise<RunWithDetails> {
    const run = await this.prisma.nightAuditRun.findUnique({
      where: { id: runId },
      include: RUN_INCLUDE,
    });
    if (!run) {
      throw new NotFoundException(`Night Audit run ${runId} introuvable.`);
    }
    return run;
  }

  private async countOpenBlockers(runId: number): Promise<number> {
    return this.prisma.nightAuditException.count({
      where: {
        runId,
        severity: NightAuditExceptionSeverity.BLOCKER,
        status: NightAuditExceptionStatus.OPEN,
      },
    });
  }

  // --- PRECHECK -------------------------------------------------------
  //
  // Contrôles implémentés (voir mission ARCH-011A) :
  //   A. ARRIVALS_UNRESOLVED (BLOCKER)
  //   B. DEPARTURES_UNRESOLVED (BLOCKER)
  //   C. STAY_ROOM_INCONSISTENCY (BLOCKER) — Stay EN_COURS rattaché à une
  //      Room soft-supprimée (seule incohérence réellement démontrable avec
  //      les invariants existants : la FK garantit déjà l'existence de la
  //      ligne, seul le soft delete peut la rendre "logiquement" invalide).
  //   D. POLICE_RECORD_MISSING (WARNING)
  //   E. HOUSEKEEPING_PENDING (WARNING)
  //   F. MAINTENANCE_OPEN (WARNING)
  //
  // Omis volontairement (voir mission ARCH-011A, limitation assumée) :
  //   G. FINANCIAL_INCONSISTENCY — aucune fonction existante ne démontre
  //      une véritable incohérence financière distincte d'un solde positif
  //      normal avant check-out (computeSoldeDu > 0 est un état attendu,
  //      pas une anomalie). Ajouter un blocker sur cette base aurait été un
  //      faux positif inventé plutôt qu'un contrôle réel — non implémenté.
  private async detectExceptions(
    businessDate: Date,
  ): Promise<DetectedException[]> {
    const detected: DetectedException[] = [];

    // A — arrivées non résolues.
    const arrivals =
      await this.reservationsService.findConfirmedArrivingOn(businessDate);
    for (const r of arrivals) {
      detected.push({
        code: 'ARRIVALS_UNRESOLVED',
        severity: NightAuditExceptionSeverity.BLOCKER,
        entityType: 'Reservation',
        entityId: r.id,
        message: `Réservation #${r.id} (${r.guest?.nom ?? ''} ${r.guest?.prenom ?? ''}) attendue aujourd'hui — ni check-in, ni no-show/annulation enregistrés.`,
        metadata: { reservationId: r.id, guestId: r.guestId },
      });
    }

    // B — départs non résolus (dus au plus tard à la Business Date).
    const dueStays =
      await this.stayService.findActiveStaysDueForCheckout(businessDate);
    for (const s of dueStays) {
      detected.push({
        code: 'DEPARTURES_UNRESOLVED',
        severity: NightAuditExceptionSeverity.BLOCKER,
        entityType: 'Stay',
        entityId: s.id,
        message: `Séjour #${s.id} (chambre ${s.room?.numero ?? s.roomId}) — départ prévu au plus tard le ${formatBusinessDateKey(businessDate)}, check-out non effectué.`,
        metadata: { stayId: s.id, roomId: s.roomId },
      });
    }

    // C + D — parcours unique des séjours actifs (chambre incohérente /
    // fiche police manquante).
    const activeStays = await this.stayService.findEnCours();
    for (const s of activeStays) {
      if (s.room?.deletedAt) {
        detected.push({
          code: 'STAY_ROOM_INCONSISTENCY',
          severity: NightAuditExceptionSeverity.BLOCKER,
          entityType: 'Stay',
          entityId: s.id,
          message: `Séjour #${s.id} rattaché à une chambre supprimée (chambre #${s.roomId}).`,
          metadata: { stayId: s.id, roomId: s.roomId },
        });
      }
      if (!s.policeRecord) {
        detected.push({
          code: 'POLICE_RECORD_MISSING',
          severity: NightAuditExceptionSeverity.WARNING,
          entityType: 'Stay',
          entityId: s.id,
          message: `Fiche de police manquante pour le séjour #${s.id} (chambre ${s.room?.numero ?? s.roomId}).`,
          metadata: { stayId: s.id },
        });
      }
    }

    // E — tâches de ménage actives non terminées.
    const tasks = await this.housekeepingTaskService.findAll({
      active: true,
      limit: 100,
      page: 1,
    });
    for (const t of tasks.data) {
      detected.push({
        code: 'HOUSEKEEPING_PENDING',
        severity: NightAuditExceptionSeverity.WARNING,
        entityType: 'HousekeepingTask',
        entityId: t.id,
        message: `Tâche de ménage #${t.id} (chambre ${t.room?.numero ?? t.roomId}) non terminée (statut ${t.statut}).`,
        metadata: { taskId: t.id, roomId: t.roomId },
      });
    }

    // F — tickets de maintenance encore ouverts.
    const tickets = await this.maintenanceService.findAll({ ouvert: true });
    for (const tk of tickets) {
      detected.push({
        code: 'MAINTENANCE_OPEN',
        severity: NightAuditExceptionSeverity.WARNING,
        entityType: 'MaintenanceTicket',
        entityId: tk.id,
        message: `Ticket de maintenance #${tk.id} (chambre ${tk.roomId}) toujours ouvert.`,
        metadata: { ticketId: tk.id, roomId: tk.roomId },
      });
    }

    return detected;
  }

  // Upsert idempotent des NightAuditException à partir de l'état réel
  // détecté — jamais une seconde formule de détection ailleurs. Une
  // exception qui n'est plus détectée passe à RESOLVED ; une exception déjà
  // ACKNOWLEDGED (warning acquitté en connaissance de cause) qui redevient
  // vraie n'est PAS réécrasée (l'acquittement reste valable jusqu'à
  // résolution réelle) ; une exception RESOLVED qui réapparaît est
  // rouverte (OPEN).
  private async syncExceptions(
    tx: Prisma.TransactionClient,
    runId: number,
    businessDate: Date,
  ) {
    const detected = await this.detectExceptions(businessDate);
    const existing = await tx.nightAuditException.findMany({
      where: { runId },
    });
    const keyOf = (code: string, entityType: string, entityId: number | null) =>
      `${code}:${entityType}:${entityId ?? 'null'}`;
    const existingByKey = new Map(
      existing.map((e) => [keyOf(e.code, e.entityType, e.entityId), e]),
    );
    const detectedKeys = new Set<string>();

    for (const d of detected) {
      const key = keyOf(d.code, d.entityType, d.entityId);
      detectedKeys.add(key);
      const found = existingByKey.get(key);
      if (!found) {
        await tx.nightAuditException.create({
          data: {
            runId,
            code: d.code,
            severity: d.severity,
            entityType: d.entityType,
            entityId: d.entityId,
            message: d.message,
            metadata: d.metadata,
          },
        });
      } else if (found.status === NightAuditExceptionStatus.RESOLVED) {
        await tx.nightAuditException.update({
          where: { id: found.id },
          data: {
            status: NightAuditExceptionStatus.OPEN,
            message: d.message,
            detectedAt: new Date(),
            resolvedAt: null,
          },
        });
      } else if (found.status === NightAuditExceptionStatus.OPEN) {
        await tx.nightAuditException.update({
          where: { id: found.id },
          data: { message: d.message },
        });
      }
      // ACKNOWLEDGED : laissé tel quel, voir commentaire ci-dessus.
    }

    for (const e of existing) {
      const key = keyOf(e.code, e.entityType, e.entityId);
      if (
        !detectedKeys.has(key) &&
        (e.status === NightAuditExceptionStatus.OPEN ||
          e.status === NightAuditExceptionStatus.ACKNOWLEDGED)
      ) {
        await tx.nightAuditException.update({
          where: { id: e.id },
          data: {
            status: NightAuditExceptionStatus.RESOLVED,
            resolvedAt: new Date(),
          },
        });
      }
    }
  }

  // --- Steps (idempotence stricte) ---------------------------------------

  // Retrouve/crée le step par idempotencyKey (jamais par runId seul) — une
  // relance après crash retombe toujours sur la même ligne, jamais une
  // seconde mutation effective si déjà COMPLETED (mission ARCH-011A,
  // "idempotence stricte").
  private async beginStep(
    tx: Prisma.TransactionClient,
    runId: number,
    type: NightAuditStepType,
    idempotencyKey: string,
  ) {
    const existing = await tx.nightAuditStep.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.status === NightAuditStepStatus.COMPLETED) {
        return existing;
      }
      return tx.nightAuditStep.update({
        where: { id: existing.id },
        data: {
          status: NightAuditStepStatus.RUNNING,
          attempt: { increment: 1 },
        },
      });
    }
    return tx.nightAuditStep.create({
      data: {
        runId,
        type,
        status: NightAuditStepStatus.RUNNING,
        idempotencyKey,
        startedAt: new Date(),
      },
    });
  }

  private async completeStep(tx: Prisma.TransactionClient, stepId: number) {
    return tx.nightAuditStep.update({
      where: { id: stepId },
      data: { status: NightAuditStepStatus.COMPLETED, completedAt: new Date() },
    });
  }

  // --- Démarrage / cycle de vie du run -------------------------------

  // Idempotent par construction (mission ARCH-011A, "retry après résultat
  // incertain" + "deux utilisateurs démarrent Night Audit simultanément") :
  // un seul run actif par BusinessDay (contrainte DB, NightAuditRun.
  // activeBusinessDayKey) — si un run actif existe déjà pour la journée
  // courante (créé par cet appelant ou un autre), on le retourne tel quel
  // plutôt que d'échouer, y compris si la création concurrente perd la
  // course sur la contrainte unique (P2002 avalé).
  async start(userId: number) {
    const day = await this.businessDateService.getCurrentBusinessDay();

    const existingActive = await this.prisma.nightAuditRun.findFirst({
      where: { activeBusinessDayKey: day.id },
    });
    if (existingActive) {
      return this.getRunOrThrow(existingActive.id);
    }

    let runId: number;
    try {
      runId = await this.prisma.$transaction(async (tx) => {
        const created = await tx.nightAuditRun.create({
          data: {
            businessDayId: day.id,
            activeBusinessDayKey: day.id,
            status: NightAuditRunStatus.PRECHECK,
            startedByUserId: userId,
          },
        });
        await this.auditService.writeLog(tx, {
          userId,
          action: AuditAction.NIGHT_AUDIT_STARTED,
          targetEntity: AuditEntity.NightAuditRun,
          targetId: created.id,
          motif: `Démarrage du Night Audit pour la Business Date ${formatBusinessDateKey(day.date)}.`,
        });
        return created.id;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const fallback = await this.prisma.nightAuditRun.findFirst({
          where: { activeBusinessDayKey: day.id },
        });
        if (fallback) {
          return this.getRunOrThrow(fallback.id);
        }
      }
      throw error;
    }

    await this.runPrecheck(runId, day.date);
    return this.getRunOrThrow(runId);
  }

  private async runPrecheck(runId: number, businessDate: Date) {
    const idempotencyKey = `NIGHT_AUDIT:${formatBusinessDateKey(businessDate)}:PRECHECK`;
    await this.prisma.$transaction(async (tx) => {
      const step = await this.beginStep(
        tx,
        runId,
        NightAuditStepType.PRECHECK,
        idempotencyKey,
      );
      if (step.status !== NightAuditStepStatus.COMPLETED) {
        await this.syncExceptions(tx, runId, businessDate);
        await this.completeStep(tx, step.id);
      }
      await tx.nightAuditRun.update({
        where: { id: runId },
        data: { status: NightAuditRunStatus.EXCEPTIONS },
      });
    });
  }

  // Re-exécute les contrôles PRECHECK sans toucher le step déjà COMPLETED
  // (celui-ci ne représente que "le premier passage a eu lieu") — permet au
  // frontend de rafraîchir l'état après une action corrective dans un
  // module canonique (check-in, check-out, fiche police...).
  async revalidate(runId: number) {
    const run = await this.getRunOrThrow(runId);
    if (run.status === NightAuditRunStatus.COMPLETED) {
      throw new ConflictException(
        'Ce run est clôturé — aucune revalidation possible (BusinessDay CLOSED, immuable).',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await this.syncExceptions(tx, runId, run.businessDay.date);
    });
    return this.getRunOrThrow(runId);
  }

  async acknowledgeWarning(
    runId: number,
    exceptionId: number,
    dto: AcknowledgeWarningDto,
    userId: number,
  ) {
    const run = await this.getRunOrThrow(runId);
    if (run.status === NightAuditRunStatus.COMPLETED) {
      throw new ConflictException(
        'Ce run est clôturé — aucun acquittement possible (BusinessDay CLOSED, immuable).',
      );
    }
    const exception = await this.prisma.nightAuditException.findUnique({
      where: { id: exceptionId },
    });
    if (!exception || exception.runId !== runId) {
      throw new NotFoundException(
        `Exception ${exceptionId} introuvable pour ce run.`,
      );
    }
    if (exception.severity === NightAuditExceptionSeverity.BLOCKER) {
      throw new ForbiddenException(
        'Une exception bloquante ne peut jamais être acquittée — seule une revalidation confirmant que le problème réel a disparu la fait passer à RESOLVED.',
      );
    }
    if (exception.status === NightAuditExceptionStatus.RESOLVED) {
      throw new ConflictException('Cette exception est déjà résolue.');
    }
    if (exception.status === NightAuditExceptionStatus.ACKNOWLEDGED) {
      // Idempotence raisonnable (mission ARCH-011A) : rejouer le même
      // acquittement ne duplique rien, ne plante pas.
      return exception;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.nightAuditException.update({
        where: { id: exceptionId },
        data: {
          status: NightAuditExceptionStatus.ACKNOWLEDGED,
          acknowledgedAt: new Date(),
          acknowledgedByUserId: userId,
          acknowledgementReason: dto.motif,
        },
      });
      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.NIGHT_AUDIT_WARNING_ACKNOWLEDGED,
        targetEntity: AuditEntity.NightAuditException,
        targetId: exceptionId,
        motif: dto.motif,
      });
      return updated;
    });
  }

  // --- POSTING_FOUNDATION --------------------------------------------
  //
  // ARCH-011A posting foundation only. No room-charge reposting : ce step
  // ne crée AUCUNE FolioLine, ne modifie aucune facture, ne recalcule
  // aucune nuitée — il se contente de vérifier qu'aucun blocker n'est
  // encore OPEN et d'enregistrer un step COMPLETED. Le repostage réel des
  // charges récurrentes (téléphone, etc.) reste hors périmètre de cette
  // itération (voir mission).
  async posting(runId: number, userId: number) {
    const run = await this.getRunOrThrow(runId);
    if (run.status !== NightAuditRunStatus.EXCEPTIONS) {
      throw new ConflictException(
        `Le posting nécessite un run en phase EXCEPTIONS (statut actuel : ${run.status}).`,
      );
    }
    const businessDate = run.businessDay.date;
    const idempotencyKey = `NIGHT_AUDIT:${formatBusinessDateKey(businessDate)}:POSTING_FOUNDATION`;

    await this.prisma.$transaction(async (tx) => {
      const openBlockers = await tx.nightAuditException.count({
        where: {
          runId,
          severity: NightAuditExceptionSeverity.BLOCKER,
          status: NightAuditExceptionStatus.OPEN,
        },
      });
      if (openBlockers > 0) {
        throw new ConflictException(
          `${openBlockers} exception(s) bloquante(s) encore ouverte(s) — posting impossible.`,
        );
      }

      const step = await this.beginStep(
        tx,
        runId,
        NightAuditStepType.POSTING_FOUNDATION,
        idempotencyKey,
      );
      if (step.status !== NightAuditStepStatus.COMPLETED) {
        // Aucune écriture métier ici volontairement — voir commentaire
        // de méthode ci-dessus.
        await this.completeStep(tx, step.id);
      }

      await tx.nightAuditRun.update({
        where: { id: runId },
        data: { status: NightAuditRunStatus.POSTING },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.NIGHT_AUDIT_POSTING_COMPLETED,
        targetEntity: AuditEntity.NightAuditRun,
        targetId: runId,
        motif: `Posting foundation validé pour la Business Date ${formatBusinessDateKey(businessDate)} — aucune nuitée repostée (ARCH-011A).`,
      });
    });

    return this.getRunOrThrow(runId);
  }

  // --- RECONCILIATION -------------------------------------------------

  async reconcile(runId: number, userId: number) {
    const run = await this.getRunOrThrow(runId);
    if (run.status !== NightAuditRunStatus.POSTING) {
      throw new ConflictException(
        `La réconciliation nécessite un run en phase POSTING (statut actuel : ${run.status}).`,
      );
    }
    const businessDate = run.businessDay.date;
    const idempotencyKey = `NIGHT_AUDIT:${formatBusinessDateKey(businessDate)}:RECONCILIATION`;
    const snapshot = await this.buildReconciliationSnapshot(
      businessDate,
      runId,
    );

    await this.prisma.$transaction(async (tx) => {
      const step = await this.beginStep(
        tx,
        runId,
        NightAuditStepType.RECONCILIATION,
        idempotencyKey,
      );
      if (step.status !== NightAuditStepStatus.COMPLETED) {
        await this.completeStep(tx, step.id);
      }

      await tx.nightAuditRun.update({
        where: { id: runId },
        data: {
          status: NightAuditRunStatus.RECONCILIATION,
          reportVersion: 1,
          reportSnapshot: snapshot,
        },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.NIGHT_AUDIT_RECONCILIATED,
        targetEntity: AuditEntity.NightAuditRun,
        targetId: runId,
        motif: `Réconciliation de nuit calculée pour la Business Date ${formatBusinessDateKey(businessDate)}.`,
      });
    });

    return this.getRunOrThrow(runId);
  }

  // Snapshot cross-domaine — lecture Prisma directe pour les agrégats
  // (même convention que FinancialReportingService.getFinancialSummary,
  // docs/modules/reporting.md), PAS un nouveau reporting Business-Date
  // financier complet : les métriques financières restent filtrées par
  // FolioLine/Payment/Invoice.createdAt (comme le reste du module
  // reporting existant, jamais modifié ici), pas par une notion de
  // "journée d'exploitation" qui n'existe sur aucune de ces tables
  // (businessDayId hors scope absolu de cette itération).
  private async buildReconciliationSnapshot(businessDate: Date, runId: number) {
    const { start, end } = dayRange(businessDate);

    const [
      reservationsToday,
      departuresDueToday,
      activeStaysCount,
      roomCounts,
      policeMissingOpen,
      warningsAcknowledged,
      blockersOpen,
      folioCharges,
      restaurantCharges,
      taxes,
      payments,
      invoicesIssued,
      creditNotes,
    ] = await Promise.all([
      this.prisma.reservation.findMany({
        where: { dateArrivee: { gte: start, lt: end } },
        select: { statut: true },
      }),
      this.prisma.stay.findMany({
        where: { dateCheckoutPrevue: { gte: start, lt: end } },
        select: { statut: true },
      }),
      this.prisma.stay.count({ where: { statut: StatutSejour.EN_COURS } }),
      this.prisma.room.groupBy({
        by: ['statut'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.nightAuditException.count({
        where: {
          runId,
          code: 'POLICE_RECORD_MISSING',
          status: NightAuditExceptionStatus.OPEN,
        },
      }),
      this.prisma.nightAuditException.count({
        where: {
          runId,
          severity: NightAuditExceptionSeverity.WARNING,
          status: NightAuditExceptionStatus.ACKNOWLEDGED,
        },
      }),
      this.prisma.nightAuditException.count({
        where: {
          runId,
          severity: NightAuditExceptionSeverity.BLOCKER,
          status: NightAuditExceptionStatus.OPEN,
        },
      }),
      this.prisma.folioLine.aggregate({
        where: {
          createdAt: { gte: start, lt: end },
          annulee: false,
          type: {
            in: [
              TypeLigneFolio.HEBERGEMENT,
              TypeLigneFolio.EXTRA,
              TypeLigneFolio.AJUSTEMENT_HAUSSE,
            ],
          },
        },
        _sum: { montant: true },
      }),
      this.prisma.folioLine.aggregate({
        where: {
          createdAt: { gte: start, lt: end },
          annulee: false,
          type: TypeLigneFolio.RESTAURANT,
        },
        _sum: { montant: true },
      }),
      this.prisma.folioLine.aggregate({
        where: {
          createdAt: { gte: start, lt: end },
          annulee: false,
          type: TypeLigneFolio.TAXE_SEJOUR,
        },
        _sum: { montant: true },
      }),
      this.prisma.payment.aggregate({
        where: { createdAt: { gte: start, lt: end }, deletedAt: null },
        _sum: { montant: true },
      }),
      this.prisma.invoice.count({
        where: { createdAt: { gte: start, lt: end } },
      }),
      this.prisma.creditNote.count({
        where: { createdAt: { gte: start, lt: end } },
      }),
    ]);

    const occupiedRoomStatuts = new Set<StatutChambre>([
      StatutChambre.OCCUPEE,
      StatutChambre.DEPART_PREVU,
    ]);
    const dirtyRoomStatuts = new Set<StatutChambre>([
      StatutChambre.A_NETTOYER,
      StatutChambre.EN_NETTOYAGE,
    ]);
    const countByStatut = (statuts: Set<StatutChambre>) =>
      roomCounts
        .filter((r) => statuts.has(r.statut))
        .reduce((sum, r) => sum + r._count._all, 0);

    return {
      businessDate: formatBusinessDateKey(businessDate),
      exploitation: {
        arrivalsExpected: reservationsToday.length,
        checkins: reservationsToday.filter(
          (r) => r.statut === StatutReservation.TRANSFORMEE_EN_SEJOUR,
        ).length,
        noShows: reservationsToday.filter(
          (r) => r.statut === StatutReservation.NO_SHOW,
        ).length,
        departuresExpected: departuresDueToday.length,
        checkouts: departuresDueToday.filter(
          (s) => s.statut === StatutSejour.CHECKOUT,
        ).length,
        activeStays: activeStaysCount,
      },
      chambres: {
        occupied: countByStatut(occupiedRoomStatuts),
        availableClean: countByStatut(
          new Set<StatutChambre>([
            StatutChambre.LIBRE_PROPRE,
            StatutChambre.RESERVEE,
          ]),
        ),
        dirty: countByStatut(dirtyRoomStatuts),
        maintenance: countByStatut(
          new Set<StatutChambre>([StatutChambre.EN_MAINTENANCE]),
        ),
      },
      conformite: {
        policeComplete: activeStaysCount - policeMissingOpen,
        policeMissing: policeMissingOpen,
        warningsAcknowledged,
        blockersOpen,
      },
      finance: {
        folioCharges: (
          folioCharges._sum.montant ?? new Prisma.Decimal(0)
        ).toString(),
        payments: (payments._sum.montant ?? new Prisma.Decimal(0)).toString(),
        invoicesIssued,
        creditNotes,
        taxes: (taxes._sum.montant ?? new Prisma.Decimal(0)).toString(),
        restaurantCharges: (
          restaurantCharges._sum.montant ?? new Prisma.Decimal(0)
        ).toString(),
      },
    };
  }

  // --- CLOSING ---------------------------------------------------------

  async prepareClosing(runId: number) {
    const run = await this.getRunOrThrow(runId);
    if (run.status !== NightAuditRunStatus.RECONCILIATION) {
      throw new ConflictException(
        `La préparation de la clôture nécessite un run en phase RECONCILIATION (statut actuel : ${run.status}).`,
      );
    }
    const openBlockers = await this.countOpenBlockers(runId);
    if (openBlockers > 0) {
      throw new ConflictException(
        `${openBlockers} exception(s) bloquante(s) encore ouverte(s) — clôture impossible.`,
      );
    }
    if (!run.reportSnapshot) {
      throw new ConflictException(
        'Réconciliation manquante — impossible de préparer la clôture.',
      );
    }

    await this.prisma.nightAuditRun.update({
      where: { id: runId },
      data: { status: NightAuditRunStatus.CLOSING },
    });
    return this.getRunOrThrow(runId);
  }

  // Transaction unique : verrouille la BusinessDay courante, vérifie son
  // statut, la clôture, ouvre J+1 OPEN, marque le run COMPLETED — jamais
  // aucun instant observable avec 0 ou 2 BusinessDay OPEN après commit
  // (voir BusinessDateService.openNextBusinessDay). Idempotent : si le run
  // est déjà COMPLETED (retry après résultat incertain, ou deux clôtures
  // concurrentes), renvoie l'état déjà clôturé sans rien recréer.
  async close(runId: number, userId: number, dto: CloseNightAuditDto) {
    const run = await this.getRunOrThrow(runId);
    if (run.status === NightAuditRunStatus.COMPLETED) {
      return run;
    }
    if (run.status !== NightAuditRunStatus.CLOSING) {
      throw new ConflictException(
        `La clôture nécessite un run en phase CLOSING (statut actuel : ${run.status}).`,
      );
    }
    const openBlockers = await this.countOpenBlockers(runId);
    if (openBlockers > 0) {
      throw new ConflictException(
        `${openBlockers} exception(s) bloquante(s) encore ouverte(s) — clôture impossible.`,
      );
    }
    if (!run.reportSnapshot) {
      throw new ConflictException(
        'Réconciliation manquante — clôture impossible.',
      );
    }

    const businessDate = run.businessDay.date;
    const idempotencyKey = `NIGHT_AUDIT:${formatBusinessDateKey(businessDate)}:CLOSING`;

    await this.prisma.$transaction(async (tx) => {
      // Verrouille la ligne NightAuditRun elle-même (pas seulement la
      // BusinessDay via BusinessDateService.lockCurrentBusinessDay
      // ci-dessous) : sabotage/preuve — sans ce verrou, deux clôtures
      // concurrentes du MÊME run passeraient toutes deux le contrôle de
      // statut ci-dessus (lu hors transaction) avant qu'aucune n'ait
      // committé, dupliquant potentiellement la transition CLOSED->OPEN.
      const rows = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM NightAuditRun WHERE id = ${runId} FOR UPDATE
      `;
      const currentStatus = rows[0]?.status;
      if (currentStatus === NightAuditRunStatus.COMPLETED) {
        // Clôturé entre-temps par une requête concurrente — idempotent,
        // rien à refaire.
        return;
      }
      if (currentStatus !== NightAuditRunStatus.CLOSING) {
        throw new ConflictException(
          `Le run n'est plus en phase CLOSING (statut actuel : ${currentStatus}).`,
        );
      }

      const step = await this.beginStep(
        tx,
        runId,
        NightAuditStepType.CLOSING,
        idempotencyKey,
      );

      const { closed, opened } =
        await this.businessDateService.openNextBusinessDay(tx, userId);

      if (step.status !== NightAuditStepStatus.COMPLETED) {
        await this.completeStep(tx, step.id);
      }

      await tx.nightAuditRun.update({
        where: { id: runId },
        data: {
          status: NightAuditRunStatus.COMPLETED,
          completedAt: new Date(),
          activeBusinessDayKey: null,
        },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.BUSINESS_DAY_CLOSED,
        targetEntity: AuditEntity.BusinessDay,
        targetId: closed.id,
        motif: dto.motif,
      });
      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.BUSINESS_DAY_OPENED,
        targetEntity: AuditEntity.BusinessDay,
        targetId: opened.id,
        motif: `Ouverture automatique de la Business Date ${formatBusinessDateKey(opened.date)} suite à la clôture du Night Audit (run ${runId}).`,
      });
    });

    return this.getRunOrThrow(runId);
  }
}
