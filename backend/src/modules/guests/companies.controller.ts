import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyContactDto } from './dto/create-company-contact.dto';

// Company reste une responsabilité du module guests (docs/modules/guests.md
// §2) — pas de clé de permission `companies` dédiée, protégé par
// guests:read/guests:write comme le reste du CRM (arbitrage 2026-07-19).
@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @RequirePermission('guests', 'read')
  @ApiOperation({ summary: 'Recherche des entreprises par nom' })
  @Get()
  search(@Query('q') q?: string) {
    return this.companiesService.search(q);
  }

  @RequirePermission('guests', 'write')
  @ApiOperation({ summary: 'Crée une fiche entreprise' })
  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @RequirePermission('guests', 'read')
  @ApiOperation({ summary: "Détail d'une entreprise" })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.findOne(id);
  }

  @RequirePermission('guests', 'write')
  @ApiOperation({ summary: 'Met à jour une fiche entreprise' })
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @RequirePermission('guests', 'write')
  @ApiOperation({ summary: 'Ajoute un contact à une entreprise' })
  @Post(':id/contacts')
  addContact(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCompanyContactDto,
  ) {
    return this.companiesService.addContact(id, dto);
  }

  @RequirePermission('guests', 'write')
  @ApiOperation({ summary: "Retire un contact d'une entreprise" })
  @Delete(':id/contacts/:contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeContact(
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number,
  ) {
    return this.companiesService.removeContact(id, contactId);
  }
}
