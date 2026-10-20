# Luminance API — NestJS + Prisma

Nuevo backend de Luminance Estética (Etapa 2 de la migración). Reemplaza progresivamente
a la API FastAPI de `app/` manteniendo el **mismo contrato HTTP** (prefijo `/api`, JSON en
snake_case), para que el frontend `web/` solo tenga que cambiar la URL base.

| | |
|---|---|
| Framework | NestJS 11 (TypeScript estricto) |
| ORM | Prisma 7 (`prisma-client` + adapter `pg`) |
| Base | PostgreSQL 17, schema `luminance-estetica` |
| Validación | `ValidationPipe` global + `class-validator` / `class-transformer` |

## Puesta en marcha

```bash
cd backend
npm install                 # también genera el cliente de Prisma (postinstall)
cp .env.example .env
docker compose up -d        # PostgreSQL en localhost:5433
npm run db:migrate          # aplica prisma/migrations
npm run db:seed             # catálogo de servicios y horario semanal
npm run start:dev           # http://localhost:3000/api
```

## Scripts

| Script | Qué hace |
|---|---|
| `start:dev` / `start:prod` | API en modo watch / compilada (`dist/main`) |
| `build`, `lint` | Compila y verifica (ESLint con reglas type-checked, sin `any`) |
| `test` | Tests unitarios (Jest, Prisma mockeado) |
| `test:e2e` | Tests HTTP contra una base real (requiere migraciones + seed) |
| `db:migrate` | `prisma migrate deploy` |
| `db:migrate:dev` | Crea una migración nueva a partir de cambios en `schema.prisma` |
| `db:seed`, `db:studio` | Datos iniciales / explorador visual de Prisma |

## Estructura

```
src/
├── main.ts                # bootstrap
├── app.setup.ts           # prefijo /api, CORS y ValidationPipe (compartido con los tests e2e)
├── app.module.ts
├── config/                # validación de variables de entorno (falla al arrancar si falta algo)
├── prisma/                # PrismaModule global + PrismaService
├── health/                # GET /api/health (503 si la base no responde)
└── services/              # catálogo público: GET /api/services, /:id, /category/:category
    ├── dto/               # DTOs de entrada validados
    └── interfaces/        # contratos de respuesta
prisma/
├── schema.prisma          # modelos: User, Service, Appointment, Availability, Payment, Coupon
├── migrations/            # 0_init (estructura actual) + 1_column_defaults
└── seed.ts
```

Cada dominio es un módulo Nest (Module + Controller + Service). Los próximos (auth, users,
appointments, availability, payments, admin) siguen el mismo patrón.

## Schema y migraciones

`schema.prisma` mapea **1:1** las tablas que crea hoy FastAPI (verificado con
`prisma migrate diff` contra una base creada por los modelos SQLAlchemy): mismos nombres de
tablas, columnas, tipos, enums, índices y claves foráneas. En el código se usan nombres
camelCase; `@map` los traduce a las columnas snake_case.

- **`0_init`**: la estructura exacta del legado.
- **`1_column_defaults`**: agrega `DEFAULT` en la base para los valores que FastAPI ponía
  desde Python (`is_active`, `status`, `currency`, …). Es aditiva y no modifica datos.

Para adoptar Prisma sobre la base existente (Neon) **sin recrear nada** (en una etapa
posterior, con backup previo):

```bash
npx prisma migrate resolve --applied 0_init   # marca la estructura existente como aplicada
npx prisma migrate deploy                     # aplica solo 1_column_defaults
```
