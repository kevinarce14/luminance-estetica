/**
 * Entorno del servidor E2E. Se importa PRIMERO en main.ts: fija las variables antes de
 * que se importe AppModule (ConfigModule las lee en ese momento y el .env no las pisa).
 */
import { parseArgs } from 'node:util';

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  fail('El servidor E2E no puede correr con NODE_ENV=production.');
}

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '8800' },
    'frontend-url': { type: 'string', default: 'http://localhost:5180' },
  },
});

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!databaseUrl) {
  fail(
    'Definí TEST_DATABASE_URL con una base PostgreSQL descartable: el servidor E2E borra y recrea el schema.',
  );
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  SECRET_KEY: 'test-secret-key-no-usar-en-produccion',
  FRONTEND_URL: values['frontend-url'],
  GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
  MAILJET_API_KEY_PUBLIC: '',
  MAILJET_API_KEY_PRIVATE: '',
  MERCADOPAGO_ACCESS_TOKEN: 'TEST-e2e',
  MERCADOPAGO_WEBHOOK_SECRET: '',
  BACKEND_URL: '',
  // Mismo admin que espera web/e2e/support.ts.
  INITIAL_ADMIN_EMAIL: 'admin@example.com',
  INITIAL_ADMIN_PASSWORD: 'Admin1234',
  INITIAL_ADMIN_NAME: 'Cande Admin',
});

export const e2eConfig = {
  port: Number(values.port),
  databaseUrl,
};
