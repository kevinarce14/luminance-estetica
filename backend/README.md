# Luminance API — NestJS + Prisma

Nuevo backend de Luminance Estética (Etapa 2 de la migración). Reemplaza progresivamente
a la API FastAPI de `app/` manteniendo el **mismo contrato HTTP** (prefijo `/api`, JSON en
snake_case), para que el frontend `web/` solo tenga que cambiar la URL base.

| | |
|---|---|
| Framework | NestJS 11 (TypeScript estricto) |
| ORM | Prisma 7 (`prisma-client` + adapter `pg`) |
| Base | PostgreSQL 17, schema `luminance-estetica` |
| Validación | `ValidationPipe` global + `class-validator` / `class-transformer` (errores 422, como FastAPI) |
| Auth | JWT HS256 (`@nestjs/jwt` + Passport), bcrypt (`bcryptjs`), Google Identity Services |

## Puesta en marcha

```bash
cd backend
npm install                 # también genera el cliente de Prisma (postinstall)
cp .env.example .env
docker compose up -d        # PostgreSQL en localhost:5433
npm run db:migrate          # aplica prisma/migrations
npm run db:seed             # admin inicial, catálogo de servicios y horario semanal
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
├── mail/                  # MailModule global: emails transaccionales con Mailjet
├── health/                # GET /api/health (503 si la base no responde)
├── common/                # validadores, transformers y pipes compartidos
└── modules/               # dominios: cada uno con Module + Controller + Service, dto/ e interfaces/
    ├── auth/              # registro, login, Google, recuperación de contraseña
    │   ├── strategies/    # JwtStrategy (Passport)
    │   ├── guards/        # JwtAuthGuard, AdminGuard
    │   └── decorators/    # @Authenticated(), @AdminOnly(), @CurrentUser()
    ├── users/             # perfil propio y administración de usuarios; PasswordService (bcrypt)
    └── services/          # catálogo público
prisma/
├── schema.prisma          # modelos: User, Service, Appointment, Availability, Payment, Coupon
├── migrations/            # 0_init (estructura actual) + 1_column_defaults
└── seed.ts
```

## Endpoints

Todas bajo `/api`, con el mismo contrato (rutas, JSON snake_case, mensajes) que FastAPI.

| Método y ruta | Acceso | Descripción |
|---|---|---|
| `POST /auth/register` | público | Alta de cliente → 201 con el usuario |
| `POST /auth/login` | público | Form-urlencoded `username` + `password` (OAuth2) o JSON → `{ access_token, token_type }` |
| `GET /auth/google/config` | público | `{ enabled, client_id }` para mostrar el botón de Google |
| `POST /auth/google` | público | `{ credential }` (id_token de Google) → token; crea la cuenta si no existe |
| `POST /auth/password-reset` (alias `/auth/forgot-password`) | público | Envía el link de recuperación (misma respuesta exista o no el email) |
| `POST /auth/password-reset/confirm` (alias `/auth/reset-password`) | público | `{ token, new_password }`; el token vence en 1 h y sirve una sola vez |
| `GET /users/me` · `PUT /users/me` | autenticado | Perfil propio (nombre y teléfono editables) |
| `GET /users` · `GET /users/:id` | admin | Listado con filtros `is_active`, `is_admin`, `skip`, `limit` |
| `PUT /users/:id/toggle-active` · `PUT /users/:id/make-admin` | admin | Activar/desactivar y promover a admin |
| `GET /services` · `/services/:id` · `/services/category/:category` | público | Catálogo |
| `GET /health` | público | Estado de la API y la base |

### Compatibilidad con el backend FastAPI

Mientras convivan, ambas APIs pueden compartir base y `SECRET_KEY`:

- **JWT**: mismo formato (`sub` = email, HS256, 24 h). Un token emitido por una sirve en la otra.
- **Contraseñas**: bcrypt `$2b$` costo 12; los hashes de passlib se verifican sin cambios.
- **Recuperación**: mismo token (tipo `password_reset` + huella del hash) y mismo link
  `FRONTEND_URL/login.html?token=…`. Al cambiar la contraseña, la huella cambia y el link
  deja de servir.
- **Errores**: `{ statusCode, message, error }`; validaciones con **422** y mensajes en
  español (el frontend ya interpreta este formato).

Sin credenciales de Mailjet los emails no se envían; en desarrollo, el link de
recuperación se muestra en la consola de la API para poder probar el flujo.

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
