import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { assertStrongSecrets } from './common/config/assert-strong-secrets';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  // Doit s'exécuter avant NestFactory.create() : un secret JWT par défaut
  // en production compromettrait toute la chaîne d'authentification dès le
  // premier token émis, donc on refuse de démarrer plutôt que de logger un
  // avertissement ignorable.
  assertStrongSecrets();

  // bufferLogs + useLogger ci-dessous : remplace le logger console par
  // défaut de Nest par nestjs-pino dès le bootstrap (pas seulement après),
  // les logs de démarrage passent aussi par le format structuré.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Documentation OpenAPI — jamais exposée en production (surface
  // d'attaque : structure complète de l'API), voir docs/modules à jour
  // en dev/staging uniquement.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('PMS Hôtel Makarim — API')
      .setDescription(
        "API interne du Property Management System de l'Hôtel Makarim (Tétouan).",
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  app.get(Logger).log(`Application démarrée sur le port ${port}`, 'Bootstrap');
}
void bootstrap();
