import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/** Schema PostgreSQL de la app (el mismo de `schemas` en schema.prisma). */
const APP_SCHEMA = 'luminance-estetica';

/**
 * URL que usa el CLI de Prisma (migrate, diff, studio): siempre con `schema` = el de la app.
 * Prisma guarda su historial (_prisma_migrations) en ese schema; sin esto lo crearía en
 * `public`, que en Neon es compartido con otros proyectos. La app en ejecución no usa este
 * archivo: sus consultas ya van calificadas con "luminance-estetica".
 */
function cliDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) {
    return url;
  }
  const parsed = new URL(url);
  parsed.searchParams.set('schema', APP_SCHEMA);
  return parsed.toString();
}

// Prisma 7 ya no lee la URL desde schema.prisma: la toma de acá (DATABASE_URL del .env).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: cliDatabaseUrl(process.env.DATABASE_URL),
  },
});
