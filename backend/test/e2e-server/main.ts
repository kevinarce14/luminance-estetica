/**
 * Servidor NestJS para la suite Playwright del frontend (web/e2e), equivalente a
 * tests/e2e_server.py del backend FastAPI:
 *
 *   TEST_DATABASE_URL=postgresql://… npm run e2e:server -- --port 8800 --frontend-url http://localhost:5180
 *
 * - Base SIEMPRE la de TEST_DATABASE_URL (descartable): borra el schema, aplica las
 *   migraciones y carga los datos iniciales en cada arranque.
 * - Email, Google y MercadoPago simulados; sin credenciales reales.
 * - Rutas /__e2e__/* para los tests. Se niega a arrancar con NODE_ENV=production.
 */
// El orden importa: e2e-env fija las variables antes de importar la app.
import { e2eConfig } from './e2e-env';
import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '../../src/generated/prisma/client';
import { startE2eServer } from './server';

const BACKEND_ROOT = resolve(__dirname, '..', '..');

/** Cada corrida empieza desde cero: se borra el schema y se reaplican las migraciones. */
async function recreateDatabase(databaseUrl: string): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    await prisma.$executeRawUnsafe(
      'DROP SCHEMA IF EXISTS "luminance-estetica" CASCADE',
    );
    // Prisma guarda el historial en el schema por defecto (public), no en el de la app:
    // sin borrarlo, `migrate deploy` creería que las migraciones ya están aplicadas.
    await prisma.$executeRawUnsafe(
      'DROP TABLE IF EXISTS public."_prisma_migrations"',
    );
  } finally {
    await prisma.$disconnect();
  }
  execSync('npx prisma migrate deploy', {
    cwd: BACKEND_ROOT,
    env: process.env,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

async function main(): Promise<void> {
  await recreateDatabase(e2eConfig.databaseUrl);
  await startE2eServer(e2eConfig.port);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
