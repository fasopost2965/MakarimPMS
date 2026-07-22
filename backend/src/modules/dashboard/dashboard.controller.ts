import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @RequirePermission('dashboard', 'read')
  @ApiOperation({
    summary:
      "Indicateurs de synthèse de la journée (taux d'occupation, arrivées, départs...)",
  })
  @Get('dashboard/resume')
  resume() {
    return this.dashboardService.resume();
  }
}
