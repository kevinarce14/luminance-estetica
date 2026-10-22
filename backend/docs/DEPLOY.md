# Deploy de la API NestJS y migración de la base de Neon

Guía para poner en producción `backend/` **sobre la base actual de Neon** (la que hoy usa
FastAPI), sin recrear tablas ni perder datos.

Se validó con dos réplicas con datos de prueba (usuarios con hashes de passlib, turnos y
pagos): una base creada por el código actual de FastAPI y una **réplica de Neon** tal como
la mostró su diagnóstico real (fechas de `appointments` en `timestamptz` y base compartida con
otros proyectos). Los comandos y resultados de esta guía son los de esas pruebas.

## Lo que hay que saber de la base de Neon

Relevado con el diagnóstico solo lectura (paso 2) el 21/10/2026:

- **`neondb` es compartida** con otros proyectos (schemas `devk`, `pasteleria`,
  `mentum_schema`, `neon_auth` y ~15 tablas en `public`). Luminance vive solo en
  `luminance-estetica`, y Prisma también guarda ahí su historial (`_prisma_migrations`):
  `prisma.config.ts` fuerza ese schema en el CLI, así **nada de Luminance toca `public`** ni
  los schemas de otros proyectos.
- Las fechas de `appointments` son `timestamptz` (las creó una versión anterior de FastAPI).
  `schema.prisma` las declara así y `2_appointments_timestamptz` no hace nada en Neon (solo
  convierte las bases donde todavía son `timestamp` sin zona).
- Línea de base de datos: 6 users · 9 services · 71 appointments · 32 payments ·
  6 availability · 0 coupons. Después de migrar tienen que seguir iguales.

## Resumen

| Paso | Qué hace | Riesgo |
|---|---|---|
| 1. Backup | `pg_dump` de Luminance + branch de Neon | ninguno |
| 2. Diagnóstico | `npm run db:diagnose`: confirma que la base coincide con `0_init` | ninguno (conexión de solo lectura) |
| 3. Baseline | marca `0_init` como aplicada **sin ejecutarla** | ninguno (crea `"luminance-estetica"._prisma_migrations`) |
| 4. Deploy | aplica `1_column_defaults` (solo `SET DEFAULT`) y `2_appointments_timestamptz` (en Neon no hace nada) | mínimo: no modifica datos |
| 5. Verificación | historial al día y sin diferencias | ninguno |
| 6. API | imagen Docker en Render | FastAPI sigue funcionando (rollback inmediato) |

## Antes de empezar

- **Dos URLs de Neon** (panel de Neon → *Connection Details*):
  - **Directa** (host sin `-pooler`): para backup, diagnóstico y migraciones. Las migraciones
    no deben pasar por el pooler (PgBouncer en modo transacción).
  - **Pooled** (host con `-pooler`): para la API en producción.
  - Ambas con `?sslmode=require`. No hace falta agregar `schema=`: `prisma.config.ts` lo fuerza.
  - En la URL **directa** agregar `&connect_timeout=30`. Neon suspende la base tras unos
    minutos sin uso y tarda unos segundos en despertarla; el CLI de Prisma espera 5 s por
    defecto y falla con `P1001: Can't reach database server` (pasó en el diagnóstico y en el
    primer intento del baseline real). Con 30 s alcanza. Un `P1001` no escribe nada en la base:
    se puede reintentar sin riesgo.
- Construir las imágenes (o usar `npm run …` / `npx prisma …` desde `backend/` con las
  dependencias instaladas):

  ```bash
  docker build -t luminance-api backend/
  docker build -t luminance-migrate --target migrate backend/
  ```

> ⚠️ **Nunca** correr `prisma migrate deploy` antes del paso 3: sobre una base con tablas,
> `0_init` intentaría crearlas, fallaría y dejaría una migración marcada como fallida.
> **Nunca** correr `prisma migrate reset`, `migrate dev` ni `db push` contra Neon: son
> comandos de desarrollo que pueden borrar datos, y la base es compartida con otros proyectos.

```bash
export NEON_DIRECT_URL='postgresql://USUARIO:CLAVE@ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30'
MIGRATE="docker run --rm -e DATABASE_URL=$NEON_DIRECT_URL luminance-migrate"
```

## 1. Backup

```bash
docker run --rm -v "$PWD:/backup" postgres:17-alpine   pg_dump "$NEON_DIRECT_URL" --schema='"luminance-estetica"' --format=custom   --file=/backup/luminance-$(date +%Y%m%d-%H%M).dump
```

Se respalda solo el schema de Luminance (los demás proyectos no se tocan en ningún paso).
Además, crear un **branch** en Neon (panel → *Branches* → *Create branch*): es un punto de
restauración instantáneo de toda la base. Restaurar el dump, si hiciera falta:
`pg_restore --clean --if-exists --no-owner -d "$NEON_DIRECT_URL" luminance-AAAAMMDD-HHMM.dump`.

## 2. Diagnóstico (solo lectura)

```bash
$MIGRATE npm run db:diagnose          # o, desde backend/: DATABASE_URL=$NEON_DIRECT_URL npm run db:diagnose
```

El script ([scripts/db-diagnose.ts](../scripts/db-diagnose.ts)):

1. Conecta con `default_transaction_read_only=on` y **comprueba que una escritura de prueba
   sea rechazada** (si no, se detiene).
2. Releva schemas compartidos, historial de Prisma, tipos de las fechas y filas por tabla.
3. Corre `prisma migrate status` y `prisma migrate diff` y clasifica cada cambio del diff:
   solo se aceptan los `SET DEFAULT` de `1_column_defaults` y la conversión a `timestamptz`
   de `2_appointments_timestamptz`; cualquier otra cosa **bloquea**.

Salida esperada en Neon (las 12 líneas `SET DEFAULT`, ninguna conversión de tipo):

```text
ℹ Base compartida: otros schemas [devk, mentum_schema, neon_auth, pasteleria] y … tablas en public.
Historial de Prisma: no existe todavía (base sin adoptar).
Fechas de appointments: appointment_date=con zona, cancelled_at=con zona, …
  ✔ esperado  appointments: ALTER COLUMN "status" SET DEFAULT 'PENDING'
  …
✔ LISTA PARA EL BASELINE
```

**Si aparece alguna línea `✖ BLOQUEA`** o el veredicto es `NO SEGUIR`, la base tiene una
diferencia que ninguna migración cubre: **no seguir** y generar una migración de ajuste antes
del baseline. (Así se detectó que las fechas de Neon eran `timestamptz`.) Un `P1001` significa
que Neon estaba suspendida y no alcanzó a despertar: revisar que la URL tenga
`connect_timeout=30` y reintentar.

## 3. Baseline: adoptar la estructura existente

```bash
$MIGRATE npx prisma migrate resolve --applied 0_init
# → "Migration 0_init marked as applied."
```

No ejecuta SQL sobre las tablas: crea `"luminance-estetica"._prisma_migrations` y registra
`0_init` como aplicada.

## 4. Deploy de las migraciones pendientes

```bash
$MIGRATE
# → Applying migration `1_column_defaults`
# → Applying migration `2_appointments_timestamptz`
# → All migrations have been successfully applied.
```

- `1_column_defaults` agrega valores por defecto para columnas que FastAPI completaba desde
  Python. No modifica datos.
- `2_appointments_timestamptz` solo convierte columnas que sigan siendo `timestamp` sin zona:
  en Neon ya son `timestamptz`, así que no ejecuta ningún `ALTER`.

FastAPI sigue funcionando igual sobre la base migrada (verificado en la réplica).

## 5. Verificación

```bash
$MIGRATE npm run db:diagnose
# → Historial de Prisma en "luminance-estetica": 0_init, 1_column_defaults, 2_appointments_timestamptz
# → Sin diferencias: la base coincide con schema.prisma.
# → ✔ Base adoptada y al día
```

Comparar las filas por tabla con la línea de base de arriba. En la réplica de Neon: datos
intactos (mismo instante en cada turno), `public` y los demás schemas sin cambios, y ninguna
tabla de Prisma fuera de `luminance-estetica`.

## 6. API en Render (Docker)

1. **New → Web Service**, repositorio del proyecto, *Language*: **Docker**,
   *Root Directory*: `backend`, *Dockerfile Path*: `./Dockerfile` (target por defecto: la API).
2. *Health Check Path*: `/api/health`.
3. Variables de entorno:

   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | URL **pooled** de Neon con `?sslmode=verify-full` (el driver `pg` ya valida el certificado con `require` y avisa en cada arranque; `verify-full` lo deja explícito). Para el CLI de Prisma (migraciones) seguir usando `require`. |
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
