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
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyContactDto } from './dto/create-company-contact.dto';

// Company reste une responsabilité du module guests (docs/modules/guests.md
// §2) — pas de clé de permission `companies` dédiée, protégé par
// guests:read/guests:write comme le reste du CRM (arbitrage 2026-07-19).
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @RequirePermission('guests', 'read')
  @Get()
  search(@Query('q') q?: string) {
    return this.companiesService.search(q);
  }

  @RequirePermission('guests', 'write')
  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @RequirePermission('guests', 'read')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.findOne(id);
  }

  @RequirePermission('guests', 'write')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @RequirePermission('guests', 'write')
  @Post(':id/contacts')
  addContact(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCompanyContactDto,
  ) {
    return this.companiesService.addContact(id, dto);
  }

  @RequirePermission('guests', 'write')
  @Delete(':id/contacts/:contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeContact(
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number,
  ) {
    return this.companiesService.removeContact(id, contactId);
  }
}
