# Deploy de la API NestJS y migración de la base de Neon

Guía para poner en producción `backend/` **sobre la base actual de Neon** (la que hoy usa
FastAPI), sin recrear tablas ni perder datos. El procedimiento se validó contra una copia
creada con los modelos de FastAPI y con datos reales de prueba (usuarios con hashes de
passlib, turnos y pagos): el resultado y los comandos de esta guía son los de esa prueba.

## Resumen

| Paso | Qué hace | Riesgo |
|---|---|---|
| 1. Backup | `pg_dump` de la base | ninguno |
| 2. Diagnóstico | confirma que la base coincide con `0_init` | ninguno (solo lectura) |
| 3. Baseline | marca `0_init` como aplicada **sin ejecutarla** | ninguno (crea `public._prisma_migrations`) |
| 4. Deploy | aplica `1_column_defaults`: solo `ALTER COLUMN … SET DEFAULT` | mínimo: no modifica datos |
| 5. Verificación | historial al día y sin diferencias | ninguno |
| 6. API | imagen Docker en Render | FastAPI sigue funcionando (rollback inmediato) |

## Antes de empezar

- **Dos URLs de Neon** (panel de Neon → *Connection Details*):
  - **Directa** (host sin `-pooler`): para backup y migraciones. Las migraciones no deben
    pasar por el pooler (PgBouncer en modo transacción).
  - **Pooled** (host con `-pooler`): para la API en producción.
  - Ambas con `?sslmode=require`.
- Construir las imágenes (o usar `npx prisma …` desde `backend/` con las dependencias instaladas):

  ```bash
  docker build -t luminance-api backend/
  docker build -t luminance-migrate --target migrate backend/
  ```

> ⚠️ **Nunca** correr `prisma migrate deploy` (ni `migrate dev`/`reset`) antes del paso 3:
> sobre una base con tablas, `0_init` intentaría crearlas, fallaría y dejaría una migración
> marcada como fallida. `migrate reset` **borra todos los datos**.

```bash
export NEON_DIRECT_URL='postgresql://USUARIO:CLAVE@ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require'
MIGRATE="docker run --rm -e DATABASE_URL=$NEON_DIRECT_URL luminance-migrate"
```

## 1. Backup

```bash
docker run --rm -v "$PWD:/backup" postgres:17-alpine \
  pg_dump "$NEON_DIRECT_URL" --format=custom --file=/backup/neon-$(date +%Y%m%d-%H%M).dump
```

Neon también permite crear un *branch* de la base como punto de restauración instantáneo:
conviene hacerlo además del dump. Restaurar el dump, si hiciera falta:
`pg_restore --clean --if-exists --no-owner -d "$NEON_DIRECT_URL" neon-AAAAMMDD-HHMM.dump`.

## 2. Diagnóstico (solo lectura)

```bash
$MIGRATE npx prisma migrate status
# → "Following migrations have not yet been applied: 0_init, 1_column_defaults"

$MIGRATE npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

El `diff` muestra qué le falta a la base para coincidir con `schema.prisma`. **Tiene que ser
exactamente el contenido de `prisma/migrations/1_column_defaults/migration.sql`** (los
`SET DEFAULT` de `status`, `is_active`, `currency`, …). En la prueba fue idéntico, byte a byte.

**Si aparece cualquier otra cosa** (`CREATE`, `DROP`, `ALTER … TYPE`, índices con otro
nombre), la base de Neon no coincide con la que crea el código actual de FastAPI (por ejemplo,
tablas creadas por una versión vieja). En ese caso **no seguir**: hay que generar una
migración de ajuste para esas diferencias antes del baseline.

## 3. Baseline: adoptar la estructura existente

```bash
$MIGRATE npx prisma migrate resolve --applied 0_init
# → "Migration 0_init marked as applied."
```

No ejecuta SQL sobre las tablas: crea `public._prisma_migrations` (Prisma guarda el historial
en el schema por defecto, no en `luminance-estetica`) y registra `0_init` como aplicada.

## 4. Deploy de las migraciones pendientes

```bash
$MIGRATE
# → Applying migration `1_column_defaults` · All migrations have been successfully applied.
```

`1_column_defaults` solo agrega valores por defecto en la base para columnas que FastAPI
completaba desde Python. Los datos no cambian y FastAPI sigue funcionando igual.

## 5. Verificación

```bash
$MIGRATE npx prisma migrate status
# → "Database schema is up to date!"
$MIGRATE npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
# → "No difference detected." (exit code 0)
```

## 6. API en Render (Docker)

1. **New → Web Service**, repositorio del proyecto, *Language*: **Docker**,
   *Root Directory*: `backend`, *Dockerfile Path*: `./Dockerfile` (target por defecto: la API).
2. *Health Check Path*: `/api/health`.
3. Variables de entorno:

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | URL **pooled** de Neon (`…-pooler…?sslmode=require`) |
   | `SECRET_KEY` | **la misma que FastAPI**: las sesiones abiertas siguen siendo válidas |
   | `FRONTEND_URL` | `https://luminance-estetica.vercel.app` (varios orígenes separados por coma) |
   | `BACKEND_URL` | URL pública de la API (MercadoPago notifica a `BACKEND_URL/api/payments/webhook`) |
   | `GOOGLE_CLIENT_ID` | el mismo que FastAPI |
   | `MERCADOPAGO_ACCESS_TOKEN` | `APP_USR-…` de producción |
   | `MERCADOPAGO_WEBHOOK_SECRET` | clave secreta de Webhooks del panel de MercadoPago |
   | `MAILJET_API_KEY_PUBLIC` / `MAILJET_API_KEY_PRIVATE`, `FROM_EMAIL`, `FROM_NAME` | los de FastAPI |

   `PORT` lo asigna Render; `TIMEZONE` y las reglas de reserva tienen los valores del legado
   por defecto.
4. **Migraciones en cada deploy**: la imagen de la API no incluye el CLI de Prisma (para que
   sea liviana). Antes de cada deploy que traiga migraciones nuevas, correr el paso 4 con la
   imagen `migrate` (desde la máquina de desarrollo o un job de CI) contra la URL directa.
5. **Admin inicial**: en Neon ya existe. En una base nueva:
   `docker run --rm -e DATABASE_URL=… -e INITIAL_ADMIN_EMAIL=… -e INITIAL_ADMIN_PASSWORD=… luminance-api npm run db:seed:prod`.

## 7. Cambiar el frontend y retirar FastAPI

1. En Vercel, `VITE_API_BASE_URL` = URL de la API NestJS → redeploy del frontend.
2. En el panel de MercadoPago, apuntar la URL de Webhooks a la nueva API.
3. Probar: login, turnera → pago, panel admin.
4. **Rollback**: volver `VITE_API_BASE_URL` a FastAPI. Las dos APIs comparten base, formato
   de JWT y hashes de contraseña (verificado: usuarios creados por NestJS inician sesión en
   FastAPI y un token emitido por NestJS es aceptado por FastAPI).
5. Con todo estable, dar de baja el servicio de FastAPI en Render.

## Probar la imagen en local

```bash
cd backend && docker compose up -d   # PostgreSQL en :5433 (red luminance_default)
docker run --rm --network luminance_default \
  -e DATABASE_URL=postgresql://luminance:luminance@postgres:5432/luminance luminance-migrate
docker run --rm --network luminance_default -p 3000:3000 \
  -e DATABASE_URL=postgresql://luminance:luminance@postgres:5432/luminance \
  -e SECRET_KEY=dev -e FRONTEND_URL=http://localhost:5173 luminance-api
curl http://localhost:3000/api/health
```
