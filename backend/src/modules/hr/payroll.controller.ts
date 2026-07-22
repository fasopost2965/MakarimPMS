import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PayrollService } from './payroll.service';
import { CalculerPaieDto } from './dto/calculer-paie.dto';

@ApiTags('hr-payroll')
@ApiBearerAuth()
@Controller('rh/payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @RequirePermission('rh', 'write')
  @ApiOperation({
    summary: "Calcule (brouillon) le bulletin de paie CNSS/AMO d'un employé",
  })
  @Post('calculate')
  calculer(@Body() dto: CalculerPaieDto) {
    return this.payrollService.calculer(dto);
  }

  @RequirePermission('rh', 'write')
  @ApiOperation({
    summary: 'Valide un bulletin de paie (le scelle en pièce comptable)',
  })
  @Patch(':id/valider')
  valider(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payrollService.valider(id, user.sub);
  }

  @RequirePermission('rh', 'read')
  @ApiOperation({ summary: 'Liste les bulletins de paie validés' })
  @Get('slips')
  slips(@Query('employeeId') employeeId?: string) {
    return this.payrollService.findSlipsValides(
      employeeId ? Number(employeeId) : undefined,
    );
  }
}
