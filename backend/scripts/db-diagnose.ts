/**
 * Diagnóstico SOLO LECTURA de una base antes de adoptar las migraciones de Prisma
 * (paso 2 de docs/DEPLOY.md).
 *
 *   DATABASE_URL='postgresql://…(URL directa de Neon)…' npm run db:diagnose
 *
 * - Fuerza `default_transaction_read_only=on` en la conexión: Postgres rechaza cualquier
 *   escritura, incluso de Prisma (se comprueba con un intento de escritura).
 * - Releva la base (schemas compartidos, historial, tipos de fechas, filas por tabla).
 * - Corre `prisma migrate status` y `prisma migrate diff` y clasifica cada cambio del diff:
 *   solo se acepta lo que cubren 1_column_defaults (SET DEFAULT) y
 *   2_appointments_timestamptz (fechas de appointments a timestamptz).
 * - Termina con un veredicto. Exit code 0 = listo para el baseline o ya al día; 1 = no seguir.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '../src/generated/prisma/client';

const APP_SCHEMA = 'luminance-estetica';
const APP_TABLES = [
  'users',
  'services',
  'appointments',
  'payments',
  'availability',
  'coupons',
];
const APPOINTMENT_DATES = [
  'appointment_date',
  'cancelled_at',
  'created_at',
  'updated_at',
];
const BACKEND_ROOT = resolve(__dirname, '..');

/** Agrega `-c default_transaction_read_only=on` a las opciones de la conexión. */
function readOnlyUrl(url: string): string {
  const parsed = new URL(url);
  const options = parsed.searchParams.get('options');
  const readOnly = '-c default_transaction_read_only=on';
  parsed.searchParams.set(
    'options',
    options ? `${options} ${readOnly}` : readOnly,
  );
  return parsed.toString();
}

/** Para mostrar sin credenciales. */
function describeUrl(url: string): string {
  const parsed = new URL(url);
  const pooled = parsed.hostname.includes('-pooler');
  return `${parsed.hostname}/${parsed.pathname.slice(1)}${pooled ? '  ⚠️  URL POOLED: usar la directa (sin -pooler)' : ''}`;
}

function prisma(args: string, databaseUrl: string): string {
  try {
    return execSync(`npx prisma ${args}`, {
      cwd: BACKEND_ROOT,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
  }
}

/**
 * Cambios que el diff pide sobre la base. Cada `ALTER COLUMN …` de un ALTER TABLE es un
 * cambio aparte; cualquier otra sentencia (CREATE, DROP, …) se reporta entera.
 */
export function classifyDiff(sql: string): {
  expected: string[];
  blocking: string[];
} {
  const expected: string[] = [];
  const blocking: string[] = [];
  const statements = sql
    .split(';')
    .map((statement) =>
      statement
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);

  for (const statement of statements) {
    const alter = /^ALTER TABLE ("[^"]+"\.)?"([^"]+)" (.+)$/.exec(statement);
    if (!alter) {
      blocking.push(statement);
      continue;
    }
    const table = alter[2];
    for (const clause of alter[3].split(/,\s*(?=ALTER COLUMN)/)) {
      const column = /^ALTER COLUMN "([^"]+)" (.+)$/.exec(clause.trim());
      const change = column?.[2] ?? '';
      const isDefault = /^SET DEFAULT /.test(change);
      const isAppointmentTimestamptz =
        table === 'appointments' &&
        APPOINTMENT_DATES.includes(column?.[1] ?? '') &&
        /^SET DATA TYPE TIMESTAMPTZ\(6\)$/.test(change);
      (isDefault || isAppointmentTimestamptz ? expected : blocking).push(
        `${table}: ${clause.trim()}`,
      );
    }
  }
  return { expected, blocking };
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error(
      '✖ Definí DATABASE_URL con la URL DIRECTA de la base (sin -pooler).',
    );
    process.exit(1);
  }
  const roUrl = readOnlyUrl(url);
  console.log(`\nDiagnóstico solo lectura de ${describeUrl(url)}\n`);

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: roUrl }),
  });
  let historyRows: Array<{ migration_name: string; finished_at: Date | null }> =
    [];
  let historySchema: string | undefined;
  try {
    const [info] = await db.$queryRawUnsafe<
      Array<{ version: string; usuario: string; ro: string }>
    >(
      `SELECT current_setting('server_version') AS version, current_user AS usuario,
              current_setting('default_transaction_read_only') AS ro`,
    );
    console.log(
      `PostgreSQL ${info.version} · usuario ${info.usuario} · solo lectura: ${info.ro}`,
    );
    try {
      await db.$executeRawUnsafe(
        'CREATE TABLE public._db_diagnose_probe (id int)',
      );
      console.error(
        '✖ La conexión permitió escribir: se cancela el diagnóstico.',
      );
      process.exit(1);
    } catch {
      console.log(
        '✔ Una escritura de prueba fue rechazada: nada de este diagnóstico modifica la base.',
      );
    }

    const schemas = await db.$queryRawUnsafe<Array<{ nspname: string }>>(
      `SELECT nspname FROM pg_namespace
        WHERE nspname NOT LIKE 'pg\\_%' AND nspname NOT IN ('information_schema', 'public', $1)
        ORDER BY 1`,
      APP_SCHEMA,
    );
    const [publicTables] = await db.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT count(*) AS total FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'`,
    );
    if (schemas.length > 0 || Number(publicTables.total) > 0) {
      console.log(
        `ℹ Base compartida: otros schemas [${schemas.map((s) => s.nspname).join(', ') || '—'}] y ${publicTables.total} tablas en public. Prisma solo usa "${APP_SCHEMA}".`,
      );
    }

    const history = await db.$queryRawUnsafe<Array<{ table_schema: string }>>(
      `SELECT table_schema FROM information_schema.tables WHERE table_name = '_prisma_migrations'`,
    );
    historySchema = history.find(
      (row) => row.table_schema === APP_SCHEMA,
    )?.table_schema;
    if (history.some((row) => row.table_schema === 'public')) {
      console.log(
        '⚠️  Hay un _prisma_migrations en public (de otro proyecto o de una versión anterior).',
      );
    }
    if (historySchema) {
      historyRows = await db.$queryRawUnsafe(
        `SELECT migration_name, finished_at FROM "${APP_SCHEMA}"."_prisma_migrations" ORDER BY migration_name`,
      );
    }
    console.log(
      historySchema
        ? `Historial de Prisma en "${APP_SCHEMA}": ${historyRows.map((r) => r.migration_name + (r.finished_at ? '' : ' (FALLIDA)')).join(', ') || 'vacío'}`
        : 'Historial de Prisma: no existe todavía (base sin adoptar).',
    );

    const columns = await db.$queryRawUnsafe<
      Array<{ column_name: string; data_type: string }>
    >(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'appointments' AND data_type LIKE 'timestamp%'
        ORDER BY column_name`,
      APP_SCHEMA,
    );
    console.log(
      `Fechas de appointments: ${columns.map((c) => `${c.column_name}=${c.data_type.replace('timestamp ', '').replace('without time zone', 'sin zona').replace('with time zone', 'con zona')}`).join(', ')}`,
    );

    const counts: string[] = [];
    for (const table of APP_TABLES) {
      const [row] = await db.$queryRawUnsafe<Array<{ total: bigint }>>(
        `SELECT count(*) AS total FROM "${APP_SCHEMA}"."${table}"`,
      );
      counts.push(`${table} ${row.total}`);
    }
    console.log(`Filas: ${counts.join(' · ')}`);
  } finally {
    await db.$disconnect();
  }

  console.log('\n— prisma migrate status');
  console.log(
    prisma('migrate status', roUrl)
      .split('\n')
      .filter(
        (line) =>
          line.trim() &&
          !/Loaded Prisma|Prisma schema loaded|Datasource/.test(line),
      )
      .map((line) => `  ${line}`)
      .join('\n'),
  );

  console.log('\n— prisma migrate diff (base → schema.prisma)');
  const diff = prisma(
    'migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script',
    roUrl,
  ).replace(/^Loaded Prisma config.*$/m, '');
  if (/Error|P\d{4}/.test(diff) && !/ALTER|CREATE|DROP/.test(diff)) {
    console.error(diff);
    console.error(
      '✖ No se pudo calcular el diff (¿la base está suspendida? reintentar).',
    );
    process.exit(1);
  }
  const { expected, blocking } = classifyDiff(
    diff.replace(/^-- empty migration$/m, ''),
  );
  expected.forEach((change) => console.log(`  ✔ esperado  ${change}`));
  blocking.forEach((change) => console.log(`  ✖ BLOQUEA   ${change}`));
  if (expected.length + blocking.length === 0) {
    console.log('  Sin diferencias: la base coincide con schema.prisma.');
  }

  console.log('\n— Veredicto');
  const baselineDone = historyRows.some(
    (row) => row.migration_name === '0_init',
  );
  if (blocking.length > 0) {
    console.log(
      '✖ NO SEGUIR: la base tiene diferencias que ninguna migración cubre. Hace falta una migración de ajuste antes del baseline.',
    );
    process.exit(1);
  }
  if (baselineDone) {
    console.log(
      expected.length === 0
        ? '✔ Base adoptada y al día: no hay nada que hacer.'
        : '✔ Base adoptada: correr `prisma migrate deploy` para aplicar las migraciones pendientes.',
    );
  } else {
    console.log(
      '✔ LISTA PARA EL BASELINE: la estructura coincide con 0_init y lo demás lo cubren las migraciones.\n' +
        '  Siguiente paso (docs/DEPLOY.md §3–4): prisma migrate resolve --applied 0_init  →  prisma migrate deploy',
    );
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
