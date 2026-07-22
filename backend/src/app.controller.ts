import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @SkipThrottle()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Public : healthcheck Docker (backend/Dockerfile) et pipeline de
  // déploiement (.github/workflows/deploy.yml, vérification post-déploiement
  // avant de considérer le rollout réussi). SkipThrottle : appelé toutes les
  // quelques secondes — la throttler pourrait sinon faire passer le
  // conteneur "unhealthy" à tort.
  @Public()
  @SkipThrottle()
  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }
}
