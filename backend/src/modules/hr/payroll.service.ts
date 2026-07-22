import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CalculerPaieDto } from './dto/calculer-paie.dto';
import { calculerRetenues } from './utils/calculer-retenues.util';

const BRANCHE_CNSS = 'Prestations sociales (CNSS)';
const BRANCHE_AMO = 'AMO';

// Calcul du bulletin de paie marocain (BR-RH-001) : retenues salariales
// CNSS (plafonnée) et AMO (non plafonnée) lues depuis CnssRateConfig,
// jamais de taux codé en dur. Exemple de référence (SPRINT_11.md §4) :
// brut 8500 MAD ➔ retenue CNSS = min(8500, 6000) * 4.48% = 268.80 MAD,
// retenue AMO = 8500 * 2.26% = 192.10 MAD.
@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // Calcule et enregistre un bulletin en brouillon (estValide=false) — une
  // simulation tant qu'un responsable RH ne l'a pas explicitement validée
  // via valider(). Recalculer un mois déjà validé est refusé : un bulletin
  // validé est une pièce comptable opposable, pas un brouillon réécrivable.
  async calculer(dto: CalculerPaieDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee || employee.deletedAt) {
      throw new NotFoundException(`Employé ${dto.employeeId} introuvable.`);
    }

    const existant = await this.prisma.paySlip.findUnique({
      where: {
        employeeId_mois_annee: {
          employeeId: dto.employeeId,
          mois: dto.mois,
          annee: dto.annee,
        },
      },
    });
    if (existant?.estValide) {
      throw new BadRequestException(
        `Le bulletin ${dto.mois}/${dto.annee} de l'employé ${dto.employeeId} est déjà validé — non recalculable.`,
      );
    }

    const referenceDate = new Date(dto.annee, dto.mois - 1, 1);
    const [cnss, amo] = await Promise.all([
      this.tauxActif(BRANCHE_CNSS, referenceDate),
      this.tauxActif(BRANCHE_AMO, referenceDate),
    ]);

    const indemnites = new Prisma.Decimal(dto.indemnites ?? 0);
    const brutImposable = employee.salaireBase.plus(indemnites);

    // Charges patronales (ROADMAP.md "charges patronales") : valeur calculée
    // pour affichage/export uniquement, jamais persistée sur PaySlip (qui ne
    // porte que le net employé) ni déduite du salaire net.
    const { retenueCnss, retenueAmo, salaireNet, chargesPatronales } =
      calculerRetenues(brutImposable, {
        tauxCnssSalarie: cnss.tauxSalarie,
        plafondCnssMensuel: cnss.plafondMensuel,
        tauxCnssEmployeur: cnss.tauxEmployeur,
        tauxAmoSalarie: amo.tauxSalarie,
        tauxAmoEmployeur: amo.tauxEmployeur,
      });

    const paySlip = await this.prisma.paySlip.upsert({
      where: {
        employeeId_mois_annee: {
          employeeId: dto.employeeId,
          mois: dto.mois,
          annee: dto.annee,
        },
      },
      create: {
        employeeId: dto.employeeId,
        mois: dto.mois,
        annee: dto.annee,
        salaireBase: employee.salaireBase,
        indemnites,
        retenueCnss,
        retenueAmo,
        salaireNet,
      },
      update: {
        salaireBase: employee.salaireBase,
        indemnites,
        retenueCnss,
        retenueAmo,
        salaireNet,
      },
    });

    return { ...paySlip, chargesPatronales };
  }

  // Validation RH (RBAC_MATRIX.md §6 "génère le calcul des bulletins de
  // paie CNSS") : scelle le bulletin, trace l'auteur et audite l'action —
  // un bulletin validé devient une pièce comptable, geste sensible au même
  // titre qu'UPDATE_TAX_RATE.
  async valider(id: number, actingUserId: number) {
    return this.prisma.$transaction(async (tx) => {
      const paySlip = await tx.paySlip.findUnique({ where: { id } });
      if (!paySlip || paySlip.deletedAt) {
        throw new NotFoundException(`Bulletin de paie ${id} introuvable.`);
      }
      if (paySlip.estValide) {
        throw new BadRequestException(`Bulletin ${id} déjà validé.`);
      }

      const updated = await tx.paySlip.update({
        where: { id },
        data: { estValide: true, validatedById: actingUserId },
      });

      await this.auditService.writeLog(tx, {
        userId: actingUserId,
        action: 'VALIDATE_PAYSLIP',
        targetEntity: 'PaySlip',
        targetId: id,
        oldValue: { estValide: false },
        newValue: { estValide: true },
        motif: `Validation du bulletin ${paySlip.mois}/${paySlip.annee} (employé ${paySlip.employeeId}).`,
      });

      return updated;
    });
  }

  findSlipsValides(employeeId?: number) {
    return this.prisma.paySlip.findMany({
      where: { estValide: true, deletedAt: null, employeeId },
      orderBy: [{ annee: 'desc' }, { mois: 'desc' }],
    });
  }

  private async tauxActif(branche: string, referenceDate: Date) {
    const taux = await this.prisma.cnssRateConfig.findFirst({
      where: { branche, applicableDepuis: { lte: referenceDate } },
      orderBy: { applicableDepuis: 'desc' },
    });
    if (!taux) {
      throw new NotFoundException(
        `Aucun barème CNSS/AMO configuré pour "${branche}" applicable au ${referenceDate.toISOString().slice(0, 10)}.`,
      );
    }
    return taux;
  }
}
