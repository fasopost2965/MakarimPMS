import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmployeeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException(`Utilisateur ${dto.userId} introuvable.`);
    }

    try {
      return await this.prisma.employee.create({
        data: {
          userId: dto.userId,
          matriculeCnss: dto.matriculeCnss,
          salaireBase: new Prisma.Decimal(dto.salaireBase),
          dateEmbauche: new Date(dto.dateEmbauche),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Un dossier employé existe déjà pour l'utilisateur ${dto.userId}.`,
        );
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.employee.findMany({
      where: { deletedAt: null },
      include: { user: { select: { id: true, nom: true, email: true } } },
      orderBy: { id: 'asc' },
    });
  }

  async findById(id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { user: { select: { id: true, nom: true, email: true } } },
    });
    if (!employee || employee.deletedAt) {
      throw new NotFoundException(`Employé ${id} introuvable.`);
    }
    return employee;
  }

  // Résolution self-service : dérive le dossier employé depuis l'identité
  // décodée du JWT (jamais depuis un employeeId transmis par le client),
  // pour que le pointage reste structurellement impossible à falsifier au
  // nom d'un collègue (cf. AttendanceService).
  async findByUserIdOrThrow(userId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee || !employee.actif || employee.deletedAt) {
      throw new NotFoundException(
        'Aucune fiche employé active associée à ce compte — contactez le service RH.',
      );
    }
    return employee;
  }
}
