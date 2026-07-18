import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DashboardService } from './dashboard.service';

@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @RequirePermission('dashboard', 'read')
  @Get('dashboard/resume')
  resume() {
    return this.dashboardService.resume();
  }
}
