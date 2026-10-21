import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { MailService } from '../../src/mail/mail.service';
import { GoogleAuthService } from '../../src/modules/auth/google-auth.service';
import { MercadoPagoClient } from '../../src/modules/payments/mercadopago/mercadopago.client';
import { createE2eModule, E2eService } from './e2e.module';
import {
  E2eMailbox,
  FakeGoogleAuthService,
  FakeMercadoPagoClient,
} from './fakes';

/**
 * Levanta la API real con los dobles de email, Google y MercadoPago y las rutas
 * /__e2e__/*. Se importa desde main.ts DESPUÉS de fijar las variables de entorno
 * (ConfigModule las lee al importarse AppModule).
 */
export async function startE2eServer(port: number): Promise<void> {
  const mailbox = new E2eMailbox();
  const mercadoPago = new FakeMercadoPagoClient();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, createE2eModule(mailbox, mercadoPago)],
  })
    .overrideProvider(MailService)
    .useValue(mailbox)
    .overrideProvider(GoogleAuthService)
    .useValue(new FakeGoogleAuthService(process.env.GOOGLE_CLIENT_ID ?? ''))
    .overrideProvider(MercadoPagoClient)
    .useValue(mercadoPago)
    .compile();

  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  configureApp(app, { excludeFromPrefix: ['__e2e__/{*path}'] });
  app.enableShutdownHooks();

  const summary = await app.get(E2eService).seed();
  await app.listen(port, '127.0.0.1');
  Logger.log(
    `API NestJS de E2E en http://127.0.0.1:${port} (admin ${summary.adminEmail})`,
    'E2E',
  );
}
