import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Public : c'est la route utilisée par le healthcheck Docker
  // (docker/Dockerfile), qui ne s'authentifie pas.
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
