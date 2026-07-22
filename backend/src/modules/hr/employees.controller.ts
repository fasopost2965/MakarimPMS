import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@ApiTags('hr-employees')
@ApiBearerAuth()
@Controller('rh/employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @RequirePermission('rh', 'write')
  @ApiOperation({
    summary: 'Crée un dossier employé relié à un compte existant',
  })
  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @RequirePermission('rh', 'read')
  @ApiOperation({ summary: 'Liste les dossiers employés' })
  @Get()
  findAll() {
    return this.employeesService.findAll();
  }

  @RequirePermission('rh', 'read')
  @ApiOperation({ summary: "Détail d'un dossier employé" })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findById(id);
  }
}
