import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntity, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCancellationPolicyDto } from './dto/create-cancellation-policy.dto';
import { UpdateCancellationPolicyDto } from './dto/update-cancellation-policy.dto';

// BR-RES-006 — configuration du barème de pénalité d'annulation/no-show,
// propriété du module reservations (voir commentaire schema.prisma sur
// CancellationPolicy). Même discipline d'audit que
// ParametersService.createSeasonRate/updateTaxRate : motif écrit obligatoire,
// écriture dans la même transaction que la mutation.
@Injectable()
export class CancellationPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.cancellationPolicy.findMany({ orderBy: { nom: 'asc' } });
  }

  async findOne(id: number) {
    const policy = await this.prisma.cancellationPolicy.findUnique({
      where: { id },
    });
    if (!policy) {
      throw new NotFoundException(`Politique d'annulation ${id} introuvable.`);
    }
    return policy;
  }

  async create(dto: CreateCancellationPolicyDto, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.cancellationPolicy.create({
        data: {
          nom: dto.nom,
          type: dto.type,
          delaiFrancHeures: dto.delaiFrancHeures,
          pourcentagePenaliteAnnulation: new Prisma.Decimal(
            dto.pourcentagePenaliteAnnulation,
          ),
          pourcentagePenaliteNoShow: new Prisma.Decimal(
            dto.pourcentagePenaliteNoShow,
          ),
        },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CREATE_CANCELLATION_POLICY,
        targetEntity: AuditEntity.CancellationPolicy,
        targetId: created.id,
        newValue: {
          nom: dto.nom,
          type: dto.type,
          delaiFrancHeures: dto.delaiFrancHeures,
          pourcentagePenaliteAnnulation: dto.pourcentagePenaliteAnnulation,
          pourcentagePenaliteNoShow: dto.pourcentagePenaliteNoShow,
        },
        motif: dto.motif,
      });

      return created;
    });
  }

  async update(id: number, dto: UpdateCancellationPolicyDto, userId?: number) {
    const existing = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cancellationPolicy.update({
        where: { id },
        data: {
          type: dto.type,
          delaiFrancHeures: dto.delaiFrancHeures,
          pourcentagePenaliteAnnulation:
            dto.pourcentagePenaliteAnnulation !== undefined
              ? new Prisma.Decimal(dto.pourcentagePenaliteAnnulation)
              : undefined,
          pourcentagePenaliteNoShow:
            dto.pourcentagePenaliteNoShow !== undefined
              ? new Prisma.Decimal(dto.pourcentagePenaliteNoShow)
              : undefined,
          actif: dto.actif,
        },
      });

      const oldValue: Record<string, string | number | boolean> = {};
      const newValue: Record<string, string | number | boolean> = {};
      if (dto.type !== undefined) {
        oldValue.type = existing.type;
        newValue.type = dto.type;
      }
      if (dto.delaiFrancHeures !== undefined) {
        oldValue.delaiFrancHeures = existing.delaiFrancHeures;
        newValue.delaiFrancHeures = dto.delaiFrancHeures;
      }
      if (dto.pourcentagePenaliteAnnulation !== undefined) {
        oldValue.pourcentagePenaliteAnnulation =
          existing.pourcentagePenaliteAnnulation.toString();
        newValue.pourcentagePenaliteAnnulation =
          dto.pourcentagePenaliteAnnulation;
      }
      if (dto.pourcentagePenaliteNoShow !== undefined) {
        oldValue.pourcentagePenaliteNoShow =
          existing.pourcentagePenaliteNoShow.toString();
        newValue.pourcentagePenaliteNoShow = dto.pourcentagePenaliteNoShow;
      }
      if (dto.actif !== undefined) {
        oldValue.actif = existing.actif;
        newValue.actif = dto.actif;
      }

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.UPDATE_CANCELLATION_POLICY,
        targetEntity: AuditEntity.CancellationPolicy,
        targetId: id,
        oldValue,
        newValue,
        motif: dto.motif,
      });

      return updated;
    });
  }
}
