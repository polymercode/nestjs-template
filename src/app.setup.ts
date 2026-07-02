import { INestApplication, Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

/**
 * Applies global app configuration (prefix, versioning, pipes, security).
 * Shared between main.ts and e2e tests so both run the same pipeline.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService);
  const corsOrigins = config.get<string[]>('app.corsOrigins', ['*']);

  if (corsOrigins.includes('*') && config.get<string>('app.env') === 'production') {
    new Logger('Bootstrap').warn(
      'CORS_ORIGIN is "*" in production — set it to your real origin(s) instead.',
    );
  }

  app.use(helmet());
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  return app;
}
