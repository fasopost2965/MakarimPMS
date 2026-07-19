import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyContactDto } from './dto/create-company-contact.dto';

const SEARCH_LIMIT = 20;
const COMPANY_INCLUDE = { contacts: true } as const;

// Annuaire des comptes entreprise (cahier des charges §5.7 / "Comptes
// entreprise" City Ledger). Volontairement un simple CRUD — aucune logique
// de solde/compte courant ici, cf. commentaire sur le modèle Company dans
// schema.prisma : le rattachement réel de séjours/factures à une société
// reste un module futur.
@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q?: string) {
    if (!q) {
      return this.prisma.company.findMany({
        orderBy: { createdAt: 'desc' },
        take: SEARCH_LIMIT,
        include: COMPANY_INCLUDE,
      });
    }
    return this.prisma.company.findMany({
      where: {
        OR: [{ raisonSociale: { contains: q } }, { ice: { contains: q } }],
      },
      orderBy: { createdAt: 'desc' },
      take: SEARCH_LIMIT,
      include: COMPANY_INCLUDE,
    });
  }

  async create(dto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: {
        raisonSociale: dto.raisonSociale,
        ice: dto.ice,
        conditionsPaiement: dto.conditionsPaiement,
        plafondCredit:
          dto.plafondCredit !== undefined
            ? new Prisma.Decimal(dto.plafondCredit)
            : undefined,
      },
      include: COMPANY_INCLUDE,
    });
  }

  async findOne(id: number) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: COMPANY_INCLUDE,
    });
    if (!company) {
      throw new NotFoundException(`Entreprise ${id} introuvable.`);
    }
    return company;
  }

  async update(id: number, dto: UpdateCompanyDto) {
    await this.findOne(id);
    return this.prisma.company.update({
      where: { id },
      data: {
        raisonSociale: dto.raisonSociale,
        ice: dto.ice,
        conditionsPaiement: dto.conditionsPaiement,
        plafondCredit:
          dto.plafondCredit !== undefined
            ? new Prisma.Decimal(dto.plafondCredit)
            : undefined,
      },
      include: COMPANY_INCLUDE,
    });
  }

  async addContact(companyId: number, dto: CreateCompanyContactDto) {
    await this.findOne(companyId);
    return this.prisma.companyContact.create({
      data: { ...dto, companyId },
    });
  }

  async removeContact(companyId: number, contactId: number) {
    const contact = await this.prisma.companyContact.findUnique({
      where: { id: contactId },
    });
    if (!contact || contact.companyId !== companyId) {
      throw new NotFoundException(
        `Contact ${contactId} introuvable pour l'entreprise ${companyId}.`,
      );
    }
    await this.prisma.companyContact.delete({ where: { id: contactId } });
  }
}
