import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ParametersService {
  constructor(private readonly prisma: PrismaService) {}

  async getHotelConfig() {
    let config = await this.prisma.hotelConfig.findUnique({
      where: { id: 1 },
    });
    if (!config) {
      // In-memory fallback if somehow missing
      config = await this.prisma.hotelConfig.create({
        data: {
          id: 1,
          raisonSociale: 'Hôtel Makarim SARL',
          ice: '000000000000000',
          identifiantFiscal: '00000000',
          rc: '00000',
          adresse: 'Tétouan, Maroc',
          categorieEtoiles: 3,
        },
      });
    }
    return config;
  }

  async updateHotelConfig(data: {
    raisonSociale?: string;
    ice?: string;
    identifiantFiscal?: string;
    rc?: string;
    adresse?: string;
    categorieEtoiles?: number;
  }) {
    await this.getHotelConfig(); // ensure exists
    return this.prisma.hotelConfig.update({
      where: { id: 1 },
      data,
    });
  }

  async getTaxRates() {
    return this.prisma.taxRateConfig.findMany();
  }

  async updateTaxRate(id: number, data: { taux: number }) {
    if (data.taux < 0 || data.taux > 100) {
      throw new BadRequestException(
        'Le taux de taxe doit être compris entre 0 et 100%',
      );
    }
    const rate = await this.prisma.taxRateConfig.findUnique({
      where: { id },
    });
    if (!rate) {
      throw new NotFoundException(`Taux de taxe ID ${id} introuvable`);
    }
    return this.prisma.taxRateConfig.update({
      where: { id },
      data: { taux: Number(data.taux) },
    });
  }

  async getSeasonRates() {
    return this.prisma.seasonRate.findMany();
  }

  async createSeasonRate(data: {
    libelle: string;
    dateDebut: string;
    dateFin: string;
    prixNuit: number;
    roomTypeId: number;
  }) {
    const debut = new Date(data.dateDebut);
    const fin = new Date(data.dateFin);

    if (debut >= fin) {
      throw new BadRequestException(
        'La date de début doit être strictement antérieure à la date de fin',
      );
    }

    if (data.prixNuit <= 0) {
      throw new BadRequestException('Le prix par nuit doit être supérieur à 0');
    }

    // Check overlaps for the same Room Type
    const existing = await this.prisma.seasonRate.findMany({
      where: { roomTypeId: Number(data.roomTypeId) },
    });

    for (const r of existing) {
      const rDebut = new Date(r.dateDebut);
      const rFin = new Date(r.dateFin);
      if (
        (debut >= rDebut && debut <= rFin) ||
        (fin >= rDebut && fin <= rFin) ||
        (debut <= rDebut && fin >= rFin)
      ) {
        throw new BadRequestException(
          `Conflit de calendrier : Un tarif saisonnier existant ("${r.libelle}") chevauche cette période pour ce type de chambre.`,
        );
      }
    }

    return this.prisma.seasonRate.create({
      data: {
        libelle: data.libelle,
        dateDebut: debut,
        dateFin: fin,
        prixNuit: Number(data.prixNuit),
        roomTypeId: Number(data.roomTypeId),
      },
    });
  }

  async updateSeasonRate(
    id: number,
    data: {
      libelle?: string;
      dateDebut?: string;
      dateFin?: string;
      prixNuit?: number;
      roomTypeId?: number;
    },
  ) {
    const rate = await this.prisma.seasonRate.findUnique({
      where: { id },
    });
    if (!rate) {
      throw new NotFoundException(`Tarif saisonnier ID ${id} introuvable`);
    }

    const merged = { ...rate, ...data };
    const debut = new Date(merged.dateDebut);
    const fin = new Date(merged.dateFin);

    if (debut >= fin) {
      throw new BadRequestException(
        'La date de début doit être strictly antérieure à la date de fin',
      );
    }

    if (Number(merged.prixNuit) <= 0) {
      throw new BadRequestException('Le prix par nuit doit être supérieur à 0');
    }

    // Check overlaps for the same Room Type
    const existing = await this.prisma.seasonRate.findMany({
      where: {
        roomTypeId: Number(merged.roomTypeId),
      },
    });

    for (const r of existing) {
      if (r.id === id) continue;
      const rDebut = new Date(r.dateDebut);
      const rFin = new Date(r.dateFin);
      if (
        (debut >= rDebut && debut <= rFin) ||
        (fin >= rDebut && fin <= rFin) ||
        (debut <= rDebut && fin >= rFin)
      ) {
        throw new BadRequestException(
          `Conflit de calendrier : Un autre tarif saisonnier existant ("${r.libelle}") chevauche cette période pour ce type de chambre.`,
        );
      }
    }

    return this.prisma.seasonRate.update({
      where: { id },
      data: {
        libelle: data.libelle,
        dateDebut: data.dateDebut ? new Date(data.dateDebut) : undefined,
        dateFin: data.dateFin ? new Date(data.dateFin) : undefined,
        prixNuit: data.prixNuit ? Number(data.prixNuit) : undefined,
        roomTypeId: data.roomTypeId ? Number(data.roomTypeId) : undefined,
      },
    });
  }

  async deleteSeasonRate(id: number) {
    const rate = await this.prisma.seasonRate.findUnique({
      where: { id },
    });
    if (!rate) {
      throw new NotFoundException(`Tarif saisonnier ID ${id} introuvable`);
    }
    return this.prisma.seasonRate.delete({
      where: { id },
    });
  }
}
