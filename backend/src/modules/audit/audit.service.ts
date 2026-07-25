import { Injectable } from '@nestjs/common';
import { AuditAction, AuditEntity, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogEntry {
  userId?: number;
  action: AuditAction;
  targetEntity: AuditEntity;
  targetId: number;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  motif: string;
}

export interface AuditLogFilters {
  entite?: AuditEntity;
  userId?: number;
  action?: AuditAction;
  du?: string;
  au?: string;
}

// Registre d'audit transverse (ADR-005 §3.2, INV-AUD-001 : append-only).
// Volontairement minimal — writeLog() et findMany() sont les deux SEULES
// méthodes exposées, jamais d'update/delete, jamais le client Prisma brut
// exposé aux appelants. Voir CLAUDE.md : toute opération sensible doit
// appeler writeLog() dans la même transaction que la modification métier.
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // tx est obligatoire (pas de fallback vers this.prisma) : l'écriture
  // d'audit doit réussir/échouer atomiquement avec l'opération auditée
  // (ADR-005 Anti-Pattern #4) — sinon un log peut silencieusement manquer.
  async writeLog(tx: Prisma.TransactionClient, entry: AuditLogEntry) {
    await tx.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        targetEntity: entry.targetEntity,
        targetId: entry.targetId,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        motif: entry.motif,
      },
    });
  }

  async findMany(filters: AuditLogFilters) {
    return this.prisma.auditLog.findMany({
      where: {
        targetEntity: filters.entite,
        userId: filters.userId,
        action: filters.action,
        createdAt: {
          gte: filters.du ? new Date(filters.du) : undefined,
          lt: filters.au
            ? new Date(new Date(filters.au).getTime() + 86_400_000)
            : undefined,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
