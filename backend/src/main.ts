import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { IncomingMessage } from 'http';
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
  // Carve-out CORS pour les surfaces publiques (F4 Booking Engine,
  // F6 self check-in, BR-RES-004) : elles n'utilisent ni cookies ni
  // Authorization Bearer (jeton dans l'URL pour self-checkin, aucune
  // authentification pour booking), donc origin réfléchie + credentials
  // false leur est ouvert à toute origine — le reste de l'API (interne,
  // JWT + credentials) reste strictement limité à FRONTEND_URL comme
  // avant. Delegate (pas un objet statique) : seul moyen d'accéder au
  // chemin de la requête pour distinguer les deux cas.
  const PUBLIC_CORS_PREFIXES = ['/api/booking', '/api/self-checkin'];
  const corsDelegate: CorsOptionsDelegate<IncomingMessage> = (
    req,
    callback,
  ) => {
    const isPublicRoute = PUBLIC_CORS_PREFIXES.some((prefix) =>
      req.url?.startsWith(prefix),
    );
    callback(null, {
      origin: isPublicRoute ? true : process.env.FRONTEND_URL,
      credentials: !isPublicRoute,
    });
  };
  app.enableCors(corsDelegate);
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
