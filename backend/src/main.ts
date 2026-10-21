import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { EnvironmentVariables } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API escuchando en http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
