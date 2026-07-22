import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AuditEntity, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateHotelConfigDto } from './dto/update-hotel-config.dto';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';
import { CreateSeasonRateDto } from './dto/create-season-rate.dto';
import { UpdateSeasonRateDto } from './dto/update-season-rate.dto';
import { DeleteSeasonRateDto } from './dto/delete-season-rate.dto';

// Référentiel central de configuration (docs/modules/parameters.md) : taux
// de TVA/taxe de séjour, identité de l'hôtel, grille tarifaire saisonnière,
// futurs taux CNSS. Module feuille — aucune dépendance sortante hors audit.
// billing/reservations/hr consomment ce service en façade, jamais Prisma
// direct sur ces tables (CLAUDE.md — frontières de module).
@Injectable()
export class ParametersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // --- Identité de l'hôtel ---------------------------------------------

  // Singleton (INV-PAR-001) : jamais de deuxième ligne créée, mais son id
  // n'est PAS garanti égal à 1 — l'auto-incrément MySQL ne se réinitialise
  // jamais après un deleteMany() (voir prisma/seed.ts, qui vide/recrée cette
  // table à chaque exécution). Toujours résoudre l'id via findFirst(),
  // jamais une constante codée en dur.
  async getHotelConfig() {
    const config = await this.prisma.hotelConfig.findFirst();
    if (!config) {
      throw new NotFoundException(
        "Configuration de l'hôtel introuvable — vérifier le seed initial.",
      );
    }
    return config;
  }

  async updateHotelConfig(dto: UpdateHotelConfigDto, userId?: number) {
    const existing = await this.getHotelConfig();
    const { motif, ...fields } = dto;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.hotelConfig.update({
        where: { id: existing.id },
        data: fields,
      });

      const oldValue: Record<string, string | number | null> = {};
      const newValue: Record<string, string | number | null> = {};
      for (const key of Object.keys(fields) as Array<keyof typeof fields>) {
        if (fields[key] !== undefined) {
          oldValue[key] = existing[key];
          newValue[key] = fields[key];
        }
      }

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.UPDATE_HOTEL_CONFIG,
        targetEntity: AuditEntity.HotelConfig,
        targetId: existing.id,
        oldValue: oldValue,
        newValue: newValue,
        motif,
      });

      return updated;
    });
  }

  // --- Taux de TVA / taxe de séjour --------------------------------------

  async findTaxRates() {
    return this.prisma.taxRateConfig.findMany({ orderBy: { type: 'asc' } });
  }

  // Façade pour billing (docs/modules/billing.md — generateInvoice) :
  // jamais de lecture Prisma directe de TaxRateConfig hors de ce module.
  // `actif: false` exclut une taxe suspendue de la marge TVA appliquée par
  // calculateInvoiceTotal, sans effacer son historique/traçabilité.
  async getTaxRateMap(tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    const rates = await client.taxRateConfig.findMany({
      where: { actif: true },
    });
    return new Map(rates.map((rate) => [rate.type, rate.taux]));
  }

  // Façade pour billing (generateInvoice) : les taxes à matérialiser en
  // FolioLine à la facturation (taxe de séjour et toute taxe créée depuis
  // /parameters/tax-rates) — distinct de getTaxRateMap ci-dessus, qui ne
  // sert qu'à la marge TVA appliquée en pourcentage sur HEBERGEMENT/EXTRA.
  async getApplicableTaxes(tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.taxRateConfig.findMany({
      where: { actif: true, applicableParDefaut: true },
    });
  }

  async createTaxRate(dto: CreateTaxRateDto, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.taxRateConfig.create({
        data: {
          type: dto.type,
          mode: dto.mode,
          taux: new Prisma.Decimal(dto.taux),
          actif: dto.actif ?? true,
          collectePourTresor: dto.collectePourTresor ?? false,
          applicableParDefaut: dto.applicableParDefaut ?? true,
        },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CREATE_TAX_RATE,
        targetEntity: AuditEntity.TaxRateConfig,
        targetId: created.id,
        newValue: {
          type: dto.type,
          mode: dto.mode,
          taux: dto.taux,
          actif: created.actif,
          collectePourTresor: created.collectePourTresor,
          applicableParDefaut: created.applicableParDefaut,
        },
        motif: dto.motif,
      });

      return created;
    });
  }

  async updateTaxRate(id: number, dto: UpdateTaxRateDto, userId?: number) {
    const existing = await this.prisma.taxRateConfig.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Taux de taxe ${id} introuvable.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.taxRateConfig.update({
        where: { id },
        data: {
          taux: new Prisma.Decimal(dto.taux),
          mode: dto.mode,
          actif: dto.actif,
          collectePourTresor: dto.collectePourTresor,
          applicableParDefaut: dto.applicableParDefaut,
        },
      });

      const oldValue: Record<string, string | number | boolean> = {
        taux: existing.taux.toString(),
      };
      const newValue: Record<string, string | number | boolean> = {
        taux: dto.taux,
      };
      if (dto.mode !== undefined) {
        oldValue.mode = existing.mode;
        newValue.mode = dto.mode;
      }
      if (dto.actif !== undefined) {
        oldValue.actif = existing.actif;
        newValue.actif = dto.actif;
      }
      if (dto.collectePourTresor !== undefined) {
        oldValue.collectePourTresor = existing.collectePourTresor;
        newValue.collectePourTresor = dto.collectePourTresor;
      }
      if (dto.applicableParDefaut !== undefined) {
        oldValue.applicableParDefaut = existing.applicableParDefaut;
        newValue.applicableParDefaut = dto.applicableParDefaut;
      }

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.UPDATE_TAX_RATE,
        targetEntity: AuditEntity.TaxRateConfig,
        targetId: id,
        oldValue,
        newValue,
        motif: dto.motif,
      });

      return updated;
    });
  }

  // --- Grille tarifaire saisonnière ---------------------------------------

  // Jamais de chevauchement de périodes pour un même type de chambre, sinon
  // le calcul de prix (reservations) deviendrait ambigu (deux tarifs
  // candidats pour une même nuit) — INV-PAR-002.
  private async assertNoOverlap(
    tx: Prisma.TransactionClient,
    roomTypeId: number,
    dateDebut: Date,
    dateFin: Date,
    excludeId?: number,
  ) {
    const overlapping = await tx.seasonRate.findFirst({
      where: {
        roomTypeId,
        id: excludeId ? { not: excludeId } : undefined,
        dateDebut: { lte: dateFin },
        dateFin: { gte: dateDebut },
      },
    });
    if (overlapping) {
      throw new ConflictException(
        `Cette période chevauche un tarif saisonnier existant ("${overlapping.libelle}") pour ce type de chambre.`,
      );
    }
  }

  async findSeasonRates(roomTypeId?: number) {
    return this.prisma.seasonRate.findMany({
      where: roomTypeId ? { roomTypeId } : undefined,
      orderBy: { dateDebut: 'asc' },
    });
  }

  // Façade pour reservations (calculatePrixTotal) — jamais de lecture Prisma
  // directe de SeasonRate hors de ce module.
  async getSeasonRatesForRoomType(
    roomTypeId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    return client.seasonRate.findMany({ where: { roomTypeId } });
  }

  async createSeasonRate(dto: CreateSeasonRateDto, userId?: number) {
    const dateDebut = new Date(dto.dateDebut);
    const dateFin = new Date(dto.dateFin);
    if (dateFin <= dateDebut) {
      throw new ConflictException('dateFin doit être postérieure à dateDebut.');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoOverlap(tx, dto.roomTypeId, dateDebut, dateFin);

      const created = await tx.seasonRate.create({
        data: {
          roomTypeId: dto.roomTypeId,
          libelle: dto.libelle,
          dateDebut,
          dateFin,
          prixNuit: new Prisma.Decimal(dto.prixNuit),
        },
      });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.CREATE_SEASON_RATE,
        targetEntity: AuditEntity.SeasonRate,
        targetId: created.id,
        newValue: {
          roomTypeId: dto.roomTypeId,
          libelle: dto.libelle,
          dateDebut: dto.dateDebut,
          dateFin: dto.dateFin,
          prixNuit: dto.prixNuit,
        },
        motif: dto.motif,
      });

      return created;
    });
  }

  async updateSeasonRate(
    id: number,
    dto: UpdateSeasonRateDto,
    userId?: number,
  ) {
    const existing = await this.prisma.seasonRate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Tarif saisonnier ${id} introuvable.`);
    }

    const dateDebut = dto.dateDebut
      ? new Date(dto.dateDebut)
      : existing.dateDebut;
    const dateFin = dto.dateFin ? new Date(dto.dateFin) : existing.dateFin;
    if (dateFin <= dateDebut) {
      throw new ConflictException('dateFin doit être postérieure à dateDebut.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.dateDebut || dto.dateFin) {
        await this.assertNoOverlap(
          tx,
          existing.roomTypeId,
          dateDebut,
          dateFin,
          id,
        );
      }

      const updated = await tx.seasonRate.update({
        where: { id },
        data: {
          libelle: dto.libelle,
          dateDebut,
          dateFin,
          prixNuit: dto.prixNuit ? new Prisma.Decimal(dto.prixNuit) : undefined,
        },
      });

      const oldValue: Record<string, string | number> = {};
      const newValue: Record<string, string | number> = {};
      if (dto.libelle !== undefined) {
        oldValue.libelle = existing.libelle;
        newValue.libelle = dto.libelle;
      }
      if (dto.dateDebut !== undefined) {
        oldValue.dateDebut = existing.dateDebut.toISOString();
        newValue.dateDebut = dto.dateDebut;
      }
      if (dto.dateFin !== undefined) {
        oldValue.dateFin = existing.dateFin.toISOString();
        newValue.dateFin = dto.dateFin;
      }
      if (dto.prixNuit !== undefined) {
        oldValue.prixNuit = existing.prixNuit.toString();
        newValue.prixNuit = dto.prixNuit;
      }

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.UPDATE_SEASON_RATE,
        targetEntity: AuditEntity.SeasonRate,
        targetId: id,
        oldValue: oldValue,
        newValue: newValue,
        motif: dto.motif,
      });

      return updated;
    });
  }

  // Suppression physique autorisée : SeasonRate est une donnée de
  // configuration tarifaire, pas un enregistrement financier (contrairement
  // à Payment/Invoice), donc hors du périmètre soft-delete du projet.
  async removeSeasonRate(
    id: number,
    dto: DeleteSeasonRateDto,
    userId?: number,
  ) {
    const existing = await this.prisma.seasonRate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Tarif saisonnier ${id} introuvable.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.seasonRate.delete({ where: { id } });

      await this.auditService.writeLog(tx, {
        userId,
        action: AuditAction.DELETE_SEASON_RATE,
        targetEntity: AuditEntity.SeasonRate,
        targetId: id,
        oldValue: {
          roomTypeId: existing.roomTypeId,
          libelle: existing.libelle,
          dateDebut: existing.dateDebut.toISOString(),
          dateFin: existing.dateFin.toISOString(),
          prixNuit: existing.prixNuit.toString(),
        },
        motif: dto.motif,
      });
    });
  }
}
