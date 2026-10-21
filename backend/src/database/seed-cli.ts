/**
 * Carga los datos iniciales (admin de INITIAL_ADMIN_*, servicios y horario semanal).
 * Es idempotente: en una base con datos no duplica nada.
 *
 *   npm run db:seed        → desarrollo (ts-node, vía prisma/seed.ts)
 *   npm run db:seed:prod   → compilado (dist/), por ejemplo dentro del contenedor
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { initialAdminFromEnv, seedInitialData } from './initial-data';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Definí DATABASE_URL (ver .env.example)');
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    const summary = await seedInitialData(
      prisma,
      initialAdminFromEnv(process.env),
    );
    console.log(
      `Seed listo: admin ${summary.adminCreated ? 'creado' : 'existente'} (${summary.adminEmail}), ${summary.createdServices} servicios y ${summary.createdDays} días de horario creados.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
