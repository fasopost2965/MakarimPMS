import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Public : c'est la route utilisée par le healthcheck Docker
  // (docker/Dockerfile), qui ne s'authentifie pas. SkipThrottle : Docker
  // l'appelle toutes les quelques secondes — la throttler pourrait sinon
  // faire passer le conteneur "unhealthy" à tort.
  @Public()
  @SkipThrottle()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
