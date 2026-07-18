import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

// TODO(core 5.1/5.2) : protéger cette route avec JwtAuthGuard une fois le
// module core (auth/rôles) livré.
@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/resume')
  resume() {
    return this.dashboardService.resume();
  }
}
