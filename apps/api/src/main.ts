import 'dotenv/config';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const httpAdapter = app.getHttpAdapter().getInstance();

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  if (typeof httpAdapter.disable === 'function') {
    httpAdapter.disable('x-powered-by');
  }

  if (configService.trustProxy && typeof httpAdapter.set === 'function') {
    httpAdapter.set('trust proxy', 1);
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || configService.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );

    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }

    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SchoolOS API')
    .setDescription('Multi-tenant SchoolOS admin API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, document);

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap().catch((err) => {
  console.error('Error during bootstrap', err);
});