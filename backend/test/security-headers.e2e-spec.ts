import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './../src/app.module';

describe('Security Headers & Swagger (e2e)', () => {
  let app: INestApplication;

  const setupApp = async (nodeEnv: string) => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = nodeEnv;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Replicate main.ts logic for CSP
    app.use(
      helmet({
        contentSecurityPolicy:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                directives: {
                  defaultSrc: ["'self'"],
                  baseUri: ["'self'"],
                  objectSrc: ["'none'"],
                  frameAncestors: ["'self'"],
                  scriptSrc: ["'self'", "'unsafe-inline'"],
                  styleSrc: ["'self'", "'unsafe-inline'"],
                  imgSrc: ["'self'", 'data:'],
                },
              },
      }),
    );

    // Replicate main.ts logic for Swagger
    if (process.env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder().setTitle('API').build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);
    }

    await app.init();
    process.env.NODE_ENV = originalEnv;
    return app;
  };

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('Production: strict CSP, no Swagger', async () => {
    const prodApp = await setupApp('production');

    const res = await request(prodApp.getHttpServer()).get('/');
    expect(res.headers['content-security-policy']).toBeDefined();
    // In strict CSP, 'unsafe-inline' is absent from script-src (but helmet default includes it in style-src)
    expect(res.headers['content-security-policy']).not.toMatch(/script-src[^;]*'unsafe-inline'/);

    // Swagger should not be mounted
    await request(prodApp.getHttpServer()).get('/api/docs').expect(404);
  });

  it('Development: permissive CSP for Swagger, Swagger present', async () => {
    const devApp = await setupApp('development');

    const res = await request(devApp.getHttpServer()).get('/');
    expect(res.headers['content-security-policy']).toBeDefined();
    // Should contain our explicit overrides
    expect(res.headers['content-security-policy']).toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(res.headers['content-security-policy']).toContain(
      "style-src 'self' 'unsafe-inline'",
    );
    expect(res.headers['content-security-policy']).toContain(
      "img-src 'self' data:",
    );

    // Swagger should be mounted
    const swaggerRes = await request(devApp.getHttpServer()).get('/api/docs/');
    expect(swaggerRes.status).toBe(200);
  });
});
