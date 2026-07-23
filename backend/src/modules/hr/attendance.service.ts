import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, StatutTimeShift } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeesService } from './employees.service';
import { AjusterSegmentDto } from './dto/ajuster-segment.dto';
import { EmployeeClockedInEvent } from './events/employee-clocked-in.event';
import { EmployeeClockedOutEvent } from './events/employee-clocked-out.event';

const ETATS_OUVERTS: StatutTimeShift[] = ['ACTIF', 'EN_PAUSE'];
// ADR-007 §6.3 : shift resté ACTIF/EN_PAUSE plus de 14h consécutives = orphelin.
const SEUIL_ORPHELIN_MS = 14 * 60 * 60 * 1000;

// Machine à états du pointage (ADR-007 §3-5, INV-TSH-001 à 005). Toute
// méthode ici dérive l'employé depuis l'ID utilisateur du JWT (jamais un
// employeeId transmis par le client) et génère ses horodatages
// exclusivement via `new Date()` côté serveur (INV-TSH-001) — aucune route
// de ce service n'accepte de champ date/heure dans son body.
@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeesService: EmployeesService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // "Démarrer mon service" (NON_DEMARRE → ACTIF). INV-TSH-002 : rejette
  // avec 409 si un shift ACTIF/EN_PAUSE existe déjà pour cet employé —
  // vérifié et inséré dans la même transaction pour fermer la fenêtre de
  // course entre la vérification et l'écriture.
  async demarrer(userId: number) {
    const employee = await this.employeesService.findByUserIdOrThrow(userId);
    const now = new Date();

    const timeShift = await this.prisma.$transaction(async (tx) => {
      const existant = await tx.timeShift.findFirst({
        where: {
          employeeId: employee.id,
          statut: { in: ETATS_OUVERTS },
        },
      });
      if (existant) {
        throw new ConflictException(
          'Un service est déjà en cours pour cet employé (pointage multi-session interdit, BR-RH-005).',
        );
      }

      const created = await tx.timeShift.create({
        data: { employeeId: employee.id, statut: 'ACTIF', startedAt: now },
      });
      await tx.timeShiftSegment.create({
        data: { timeShiftId: created.id, type: 'TRAVAIL', debut: now },
      });
      return created;
    });

    await this.eventEmitter.emitAsync(
      'pointage.demarre',
      new EmployeeClockedInEvent(employee.id, timeShift.id, now, userId),
    );
    return timeShift;
  }

  // "Prendre une pause" (ACTIF → EN_PAUSE) : clôture le segment TRAVAIL
  // ouvert, ouvre un segment PAUSE.
  async mettreEnPause(userId: number) {
    const employee = await this.employeesService.findByUserIdOrThrow(userId);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const timeShift = await tx.timeShift.findFirst({
        where: { employeeId: employee.id, statut: 'ACTIF' },
      });
      if (!timeShift) {
        throw new ConflictException(
          'Aucun service actif à mettre en pause pour cet employé.',
        );
      }

      await this.cloreSegmentOuvert(tx, timeShift.id, 'TRAVAIL', now);
      await tx.timeShiftSegment.create({
        data: { timeShiftId: timeShift.id, type: 'PAUSE', debut: now },
      });
      return tx.timeShift.update({
        where: { id: timeShift.id },
        data: { statut: 'EN_PAUSE' },
      });
    });
  }

  // "Reprendre mon service" (EN_PAUSE → ACTIF) : clôture le segment PAUSE
  // ouvert, ouvre un nouveau segment TRAVAIL.
  async reprendre(userId: number) {
    const employee = await this.employeesService.findByUserIdOrThrow(userId);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const timeShift = await tx.timeShift.findFirst({
        where: { employeeId: employee.id, statut: 'EN_PAUSE' },
      });
      if (!timeShift) {
        throw new ConflictException(
          'Aucun service en pause à reprendre pour cet employé.',
        );
      }

      await this.cloreSegmentOuvert(tx, timeShift.id, 'PAUSE', now);
      await tx.timeShiftSegment.create({
        data: { timeShiftId: timeShift.id, type: 'TRAVAIL', debut: now },
      });
      return tx.timeShift.update({
        where: { id: timeShift.id },
        data: { statut: 'ACTIF' },
      });
    });
  }

  // "Clôturer mon service" (ACTIF → TERMINE). INV-TSH-003 : un shift
  // EN_PAUSE doit d'abord être repris — la clôture directe depuis EN_PAUSE
  // est un 400, pas un 409 (ce n'est pas un conflit de concurrence, c'est
  // une transition interdite par la machine à états elle-même).
  async terminer(userId: number) {
    const employee = await this.employeesService.findByUserIdOrThrow(userId);
    const now = new Date();

    const timeShift = await this.prisma.$transaction(async (tx) => {
      const current = await tx.timeShift.findFirst({
        where: {
          employeeId: employee.id,
          statut: { in: ETATS_OUVERTS },
        },
      });
      if (!current) {
        throw new ConflictException('Aucun service en cours à clôturer.');
      }
      if (current.statut === 'EN_PAUSE') {
        throw new BadRequestException(
          'Impossible de clôturer un service en pause : reprenez le service avant de le terminer (INV-TSH-003).',
        );
      }

      await this.cloreSegmentOuvert(tx, current.id, 'TRAVAIL', now);
      return tx.timeShift.update({
        where: { id: current.id },
        data: { statut: 'TERMINE', endedAt: now },
      });
    });

    await this.eventEmitter.emitAsync(
      'pointage.termine',
      new EmployeeClockedOutEvent(employee.id, timeShift.id, now, userId),
    );
    return timeShift;
  }

  // Contrat backend du "Logout Blocking Guard" (ADR-007 §3.5/§8) : cette
  // API n'a pas de route /auth/logout côté serveur à garder — le JWT est
  // stateless (déconnexion = suppression locale du token côté client, voir
  // AuthController). L'interception revient donc au frontend React, qui
  // DOIT appeler cet endpoint avant de détruire la session locale et
  // afficher la modale bloquante (Clôturer / Mettre en pause / Annuler) si
  // `bloqueDeconnexion` est vrai (BR-RH-004).
  async statutCourant(userId: number) {
    const employee = await this.employeesService.findByUserIdOrThrow(userId);
    const timeShift = await this.prisma.timeShift.findFirst({
      where: {
        employeeId: employee.id,
        statut: { in: ETATS_OUVERTS },
      },
    });
    return {
      bloqueDeconnexion: timeShift != null,
      statut: timeShift?.statut ?? 'NON_DEMARRE',
      timeShiftId: timeShift?.id ?? null,
      startedAt: timeShift?.startedAt ?? null,
    };
  }

  findHistorique(employeeId: number) {
    return this.prisma.timeShift.findMany({
      where: { employeeId },
      // Filtre conservé ici (contrairement au `where` top-level ci-dessus,
      // désormais redondant avec le filtrage global CH-006) : une lecture
      // imbriquée via `include` n'est jamais interceptée par l'extension
      // Prisma (limite documentée dans soft-delete.extension.ts).
      include: { segments: { where: { deletedAt: null } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  // Ajustement manuel RH (ADR-007 §6.4, INV-TSH-004) : jamais d'écriture
  // directe hors de ce chemin — ancienne/nouvelle valeur et motif tracés de
  // façon atomique dans AuditLog, dans la même transaction que la
  // modification (ADR-005 Anti-Pattern #4).
  async ajusterSegment(
    segmentId: number,
    dto: AjusterSegmentDto,
    actingUserId: number,
  ) {
    if (!dto.nouveauDebut && !dto.nouvelleFin) {
      throw new BadRequestException(
        'Au moins un des deux champs nouveauDebut/nouvelleFin doit être fourni.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const segment = await tx.timeShiftSegment.findUnique({
        where: { id: segmentId },
      });
      if (!segment || segment.deletedAt) {
        throw new NotFoundException(`Segment ${segmentId} introuvable.`);
      }

      const oldValue = { debut: segment.debut, fin: segment.fin };
      const updated = await tx.timeShiftSegment.update({
        where: { id: segmentId },
        data: {
          debut: dto.nouveauDebut ? new Date(dto.nouveauDebut) : undefined,
          fin: dto.nouvelleFin ? new Date(dto.nouvelleFin) : undefined,
        },
      });

      await this.auditService.writeLog(tx, {
        userId: actingUserId,
        action: 'ADJUST_TIME_SHIFT',
        targetEntity: 'TimeShift',
        targetId: segment.timeShiftId,
        oldValue,
        newValue: { debut: updated.debut, fin: updated.fin },
        motif: dto.motif,
      });

      return updated;
    });
  }

  // Verrou de sécurité anti-oubli (ADR-007 §6.3) : tourne chaque nuit à
  // 04h00, clôture tout TimeShift ACTIF/EN_PAUSE depuis plus de 14h.
  // Simplification assumée : pas de sous-système de notification/boîte de
  // réception RH dans ce sprint — la trace de vérification humaine requise
  // passe par AuditLog (déjà consultable par RH/Admin via GET /api/audit),
  // pas par une alerte applicative dédiée.
  @Cron('0 4 * * *')
  async clorerShiftsOrphelins(): Promise<number> {
    const seuil = new Date(Date.now() - SEUIL_ORPHELIN_MS);
    const orphelins = await this.prisma.timeShift.findMany({
      where: {
        statut: { in: ETATS_OUVERTS },
        startedAt: { lt: seuil },
      },
    });

    for (const timeShift of orphelins) {
      await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        await tx.timeShiftSegment.updateMany({
          where: { timeShiftId: timeShift.id, fin: null },
          data: { fin: now },
        });
        await tx.timeShift.update({
          where: { id: timeShift.id },
          data: { statut: 'TERMINE', endedAt: now },
        });
        await this.auditService.writeLog(tx, {
          action: 'AUTO_CLOSE_TIME_SHIFT',
          targetEntity: 'TimeShift',
          targetId: timeShift.id,
          oldValue: { statut: timeShift.statut },
          newValue: { statut: 'TERMINE', endedAt: now },
          motif:
            "Clôture automatique après 14h d'inactivité (cron 04h00, ADR-007 §6.3) — vérification humaine requise.",
        });
      });
    }

    return orphelins.length;
  }

  private async cloreSegmentOuvert(
    tx: Prisma.TransactionClient,
    timeShiftId: number,
    type: 'TRAVAIL' | 'PAUSE',
    fin: Date,
  ) {
    const ouvert = await tx.timeShiftSegment.findFirst({
      where: { timeShiftId, type, fin: null },
    });
    // Ne devrait jamais manquer si la machine à états est respectée (chaque
    // transition ouvre systématiquement un segment) — filet de sécurité
    // silencieux plutôt qu'une exception qui bloquerait une clôture par
    // ailleurs légitime.
    if (ouvert) {
      await tx.timeShiftSegment.update({
        where: { id: ouvert.id },
        data: { fin },
      });
    }
  }
}
