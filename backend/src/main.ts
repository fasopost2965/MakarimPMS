import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const expressApp = app.getHttpAdapter().getInstance();

  if (process.env.NODE_ENV !== 'production') {
    console.log('[AI Studio] Initializing Vite dev middleware...');
    // @ts-ignore
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: join(__dirname, '../../frontend'),
    });
    expressApp.use((req: any, res: any, next: any) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      vite.middlewares(req, res, next);
    });
  } else {
    console.log('[AI Studio] Serving static frontend files...');
    const frontendDist = join(__dirname, '../../frontend/dist');
    app.useStaticAssets(frontendDist);
    expressApp.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(join(frontendDist, 'index.html'));
    });
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
  console.log(
    `[AI Studio] Server listening on http://0.0.0.0:${process.env.PORT ?? 3000}`,
  );
}
void bootstrap();
