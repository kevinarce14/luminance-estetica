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
├── common/                # validadores, transformers, pipes y zona horaria (time/)
└── modules/               # dominios: cada uno con Module + Controller + Service, dto/ e interfaces/
    ├── auth/              # registro, login, Google, recuperación de contraseña
    │   ├── strategies/    # JwtStrategy (Passport)
    │   ├── guards/        # JwtAuthGuard, AdminGuard
    │   └── decorators/    # @Authenticated(), @AdminOnly(), @CurrentUser()
    ├── users/             # perfil propio y administración de usuarios; PasswordService (bcrypt)
    ├── services/          # catálogo público y ABM del admin
    ├── availability/      # horarios semanales, excepciones y grilla de horarios libres
    ├── appointments/      # reservas, cancelación y consultas de turnos
    ├── payments/          # MercadoPago (preferencia + webhook) y pagos manuales
        └── mercadopago/   # cliente REST tipado y validación de la firma de webhooks
    └── admin/             # agenda, pagos, clientes, dashboard y reportes del panel
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
| `GET /services/admin/all` · `POST /services` · `PUT /services/:id` · `PUT /services/:id/toggle-active` · `DELETE /services/:id` (alias `/admin/services`) | admin | ABM del catálogo (no se borra un servicio con turnos) |
| `POST /availability/available-slots` (alias `GET ?service_id=&date=`) | público | Grilla de horarios de un servicio en una fecha |
| `GET /availability/check/:date` | público | Horario efectivo de una fecha |
| `GET` · `POST /availability/regular` · `PUT` · `DELETE /availability/regular/:id` | admin | Horarios semanales |
| `GET` · `POST /availability/exceptions` · `DELETE /availability/exceptions/:id` | admin | Feriados y horarios especiales |
| `POST /appointments` | autenticado | Reserva (queda `pending`) |
| `GET /appointments` · `GET /appointments/:id` | autenticado | Turnos propios con servicio y pago (el admin ve cualquiera) |
| `GET /users/me/appointments?when=upcoming\|past` | autenticado | Turnos propios; `when` separa próximos y pasados |
| `POST /appointments/:id/cancel` (alias `PATCH`) | dueño o admin | Cancelación con motivo (5–500 caracteres) |
| `PUT /appointments/:id` | dueño o admin | Reprogramar o editar notas; el estado solo lo cambia el admin |
| `DELETE /appointments/:id` | admin | Borrado (si no tiene pago registrado) |
| `GET /appointments/public/confirmed` | público | Horarios ocupados desde hoy: solo fecha y duración |
| `POST /payments/create-preference` (alias `/payments/mercadopago/preference`) | dueño del turno | Checkout de MercadoPago → `{ preference_id, init_point, sandbox_init_point }` |
| `POST /payments/webhook` (alias `/payments/mercadopago/webhook`) | MercadoPago | Notificaciones de pago (Webhooks e IPN) |
| `POST /payments/cash-payment` (alias `/payments/cash`) | admin | Pago manual ya cobrado (efectivo o transferencia): confirma el turno |
| `PUT /payments/:id/status` | admin | Aprobar, rechazar, cancelar o reembolsar |
| `GET /payments` · `GET /payments/:id` · `GET /payments/all/payments` | autenticado / admin | Consultas de pagos |
| `GET /admin/dashboard` | admin | Turnos de hoy/semana/mes, pendientes, cobrado vs. estimado, servicios más reservados |
| `GET /admin/appointments` (`/upcoming`, `/today`) | admin | Agenda: `date`, `date_from`, `date_to`, `status`, `search`, `user_id`, `order`, `skip`, `limit` |
| `GET /admin/payments` | admin | Pagos con cliente y turno: `status`, `method`, `search` |
| `GET /admin/clients` | admin | Clientes con turnos, completados, cancelados, último turno y total pagado |
| `GET /admin/reports/yearly?year=` · `/admin/reports/monthly?year=&month=` | admin | Ingresos y turnos por mes, servicios y medios de pago |
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

### Panel admin

Las **lecturas** del panel están en `/admin/*`; las **acciones** reutilizan los endpoints de
cada dominio con sus reglas (transiciones, superposición de horarios, emails): confirmar,
completar o cancelar con `PUT /appointments/:id` y `POST /appointments/:id/cancel`, cobrar con
`POST /payments/cash-payment`, aprobar o rechazar con `PUT /payments/:id/status`,
activar/desactivar cuentas con `PUT /users/:id/toggle-active` y la disponibilidad con
`/availability/regular` y `/availability/exceptions`.

El buscador acepta nombre, email, servicio, notas, `#ID` y teléfono (también solo dígitos:
`44447788` encuentra `11 4444-7788`). Los reportes agrupan por mes en la zona del studio:
ingresos por fecha de aprobación del pago y turnos por fecha del turno.

### Reglas de reserva

Configurables con `TIMEZONE`, `MIN_APPOINTMENT_DURATION`, `MIN_BOOKING_ADVANCE_HOURS` y
`MAX_BOOKING_ADVANCE_DAYS` (por defecto Buenos Aires, bloques cada 30 min, 2 h y 30 días).

- Los horarios de atención están en la hora del studio; la base guarda los turnos en UTC.
  La grilla devuelve horas locales sin offset (`2026-10-22T09:00:00`) y los turnos, UTC (`…Z`).
- Un día usa su **excepción** si existe (cerrado u horario especial); si no, la franja semanal.
- Solo un turno **confirmado** ocupa el horario, durante la duración de **su** servicio,
  y bloquea a todos los servicios (el studio atiende de a uno).
- Los bloques que no se pueden reservar (antes de ahora + 2 h, después de 30 días, ocupados)
  se devuelven con `is_available: false`: una lista vacía significa día cerrado.
- Al reservar se valida además que el turno entre en el horario de atención de ese día.

### Pagos con MercadoPago

1. El cliente elige Mercado Pago en `/pago`: la API crea la preferencia con el **precio del
   servicio guardado en la base** (el monto que envía el navegador no se usa) y
   `external_reference` = ID del turno. Un turno tiene un solo pago: reintentar reutiliza
   el registro.
2. MercadoPago redirige a `FRONTEND_URL/pago/exitoso`, `/pago/fallido` o `/pago` y notifica a
   `BACKEND_URL/api/payments/webhook` (solo si `BACKEND_URL` es HTTPS; en local no puede llegar).
3. El webhook valida la firma `x-signature` (si hay `MERCADOPAGO_WEBHOOK_SECRET`), consulta el
   estado real en la API de MercadoPago y aplica la transición. Es idempotente y tolera
   notificaciones desordenadas: un pago aprobado no vuelve atrás (salvo reembolso).
4. Aprobado → turno **confirmado** y email al cliente. Si el monto es menor al precio, si el
   turno estaba cancelado o si el horario ya lo ocupa otro turno confirmado, el cobro queda
   registrado con un `error_message` para que el admin lo resuelva.

Rechazar un pago desde el panel deja el turno **pendiente de pago** (el cliente puede reintentar),
como indica el panel admin. Para pruebas locales se usa un Access Token `TEST-…` y las
tarjetas de prueba de MercadoPago; los tests e2e usan un MercadoPago simulado por HTTP.

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
