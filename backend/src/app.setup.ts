import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from './config/env.validation';

/**
 * Configuración global de la app. La usan main.ts y los tests e2e,
 * así los tests corren con exactamente el mismo pipeline que producción.
 */
export function configureApp(app: INestApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Mismo prefijo que FastAPI: el frontend solo cambia la URL base.
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: config
      .get('FRONTEND_URL', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Descarta propiedades sin decoradores y rechaza las desconocidas.
      whitelist: true,
      forbidNonWhitelisted: true,
      // Convierte el payload en instancias del DTO (aplica @Type y @Transform).
      transform: true,
    }),
  );
}
