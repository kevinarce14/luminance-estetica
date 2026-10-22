# 💅 Luminance Estética — Sistema de turnos y pagos online

> Plataforma **fullstack en producción** para el centro de estética **Luminance Studio by Cande**:
> las clientas reservan y pagan sus turnos online, y el estudio administra agenda, cobros,
> clientes, servicios y horarios desde un panel con reportes.

[![CI](https://github.com/kevinarce14/luminance-estetica/actions/workflows/ci.yml/badge.svg)](https://github.com/kevinarce14/luminance-estetica/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React_19-20232A?style=flat&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS_11-E0234E?style=flat&logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?style=flat&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_17-4169E1?style=flat&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat&logo=playwright&logoColor=white)

| | |
|---|---|
| 🌐 **Sitio** | **https://luminance-estetica.vercel.app** |
| ⚙️ **API** | https://luminance-api-nest.onrender.com/api/health |
| ✅ **Tests** | **179** automatizados en cada push (Vitest · NestJS · Playwright) |

> ⏳ **Plan gratuito:** la API corre en el plan free de Render, que suspende el servicio tras unos
> minutos sin uso. **La primera petición puede tardar entre 30 y 60 segundos** mientras el servidor
> despierta; después responde con normalidad.

---

## ✨ Funcionalidades

**Clientas**
- **Turnera interactiva**: calendario, servicios del catálogo y horarios libres calculados en la
  zona horaria del estudio (anticipación mínima de 2 h, hasta 30 días).
- **Pago online con MercadoPago** (checkout + confirmación automática por webhook) o en efectivo
  coordinado por WhatsApp.
- **Mis Turnos**: próximos e historial, estado del pago y cancelación con motivo.
- Registro, login con email o **Google**, recuperación de contraseña por email y sesión persistente.

**Administración**
- **Agenda** con filtros por día, estado y buscador (nombre, email, teléfono, servicio o `#ID`);
  confirmar, completar, cancelar y cobrar en efectivo.
- **Pagos**: aprobar o rechazar, registrar transferencias con comprobante.
- **Clientes**: historial, métricas (turnos, último turno, total pagado) y activación de cuentas.
- **Servicios** (ABM) y **disponibilidad**: horario semanal y fechas bloqueadas o especiales.
- **Dashboard y reportes**: turnos del día/semana/mes, cobrado vs. por cobrar, servicios más
  pedidos, medios de pago e ingresos por mes con gráficos propios.

## 🧰 Stack

| Capa | Tecnologías |
|---|---|
| **Frontend** (`web/`) | React 19 · TypeScript estricto · Vite · React Router · Context API · CSS propio |
| **Backend** (`backend/`) | NestJS 11 · TypeScript estricto · Prisma 7 (adapter `pg`) · class-validator · Passport JWT |
| **Base de datos** | PostgreSQL 17 en Neon (producción) · Docker Compose (desarrollo) |
| **Integraciones** | MercadoPago (Checkout + Webhooks firmados) · Google Identity Services · Mailjet |
| **Testing** | Vitest · Jest + Supertest (NestJS) · Playwright (E2E con navegador real) |
| **CI/CD e infraestructura** | GitHub Actions · Docker multistage · Render (API) · Vercel (frontend) |
| **Flujo de trabajo** | Git con **GitFlow** (`main`, `develop`, `feature/*`, `fix/*`) gestionado en **GitKraken** · commits convencionales en español · tags de versión |

## 🏗️ Arquitectura

```mermaid
flowchart LR
    U[Navegador] -->|SPA| V[Vercel<br/>React 19 + Vite]
    V -->|HTTPS /api · JWT| R[Render<br/>API NestJS en Docker]
    R -->|Prisma| N[(Neon<br/>PostgreSQL 17)]
    R -->|preferencia de pago| MP[MercadoPago]
    MP -->|webhook firmado| R
    U -->|id_token| G[Google Identity]
    R -->|verifica id_token| G
    R -->|emails transaccionales| M[Mailjet]
```

**Backend modular** (un módulo de Nest por dominio: `auth`, `users`, `services`, `availability`,
`appointments`, `payments`, `admin`), con DTOs validados, guards de JWT y de rol admin, y
configuración validada al arrancar. El detalle de endpoints y reglas está en
[backend/README.md](backend/README.md).

## 📐 Arquitectura y Diseño del Sistema

Documentación de diseño en [`docs/architecture/`](docs/architecture/README.md), con diagramas en
Mermaid que GitHub muestra como gráficos y que se versionan junto con el código:

| Diagrama | Qué muestra |
|---|---|
| 🗃️ [Entidad-Relación](docs/architecture/der.md) | Modelo de Prisma (`User`, `Service`, `Appointment`, `Payment`, `Availability`), relaciones y estados de turnos y pagos |
| ☁️ [Despliegue](docs/architecture/deployment.md) | Vercel (React), Render (Docker/NestJS), Neon (PostgreSQL), GitHub Actions, MercadoPago, Google y Mailjet |
| 🔄 [Secuencia de reserva y pago](docs/architecture/sequence-booking-payment.md) | Desde elegir un horario hasta la confirmación del turno por el webhook de MercadoPago |
| 👥 [Casos de uso](docs/architecture/use-cases.md) | Qué puede hacer el visitante, la clienta y la administradora, con los servicios externos |

## 🔀 Metodología de trabajo

El proyecto se desarrolló con **GitFlow**, gestionando ramas, merges y releases desde **GitKraken**:
cada funcionalidad o corrección se trabajó en su propia rama (`feature/*`, `fix/*`) a partir de
`develop`, con commits convencionales en español (`feat:`, `fix:`, `chore:`…) y el CI en verde
antes de integrar. `main` refleja producción y cada versión estable queda marcada con un tag.

```mermaid
gitGraph
    commit id: "v1.0.1" tag: "v1.0.1"
    branch develop
    checkout develop
    branch feature/backend-nest-auth
    checkout feature/backend-nest-auth
    commit id: "feat: auth JWT"
    checkout develop
    merge feature/backend-nest-auth
    branch feature/backend-nest-payments
    checkout feature/backend-nest-payments
    commit id: "feat: MercadoPago"
    checkout develop
    merge feature/backend-nest-payments
    checkout main
    merge develop tag: "v2.0.0-nestjs"
    checkout develop
    branch feature/neon-timestamptz-baseline
    checkout feature/neon-timestamptz-baseline
    commit id: "fix: baseline Neon"
    checkout develop
    merge feature/neon-timestamptz-baseline
    checkout main
    merge develop
```

## 🔍 Decisiones técnicas destacadas

- **Migración sin cortar el servicio.** El proyecto empezó con HTML/JS + FastAPI. Primero se migró el
  frontend a React manteniendo el backend; después se reescribió la API en NestJS **con el mismo
  contrato HTTP**, de modo que el frontend cambió solo la URL base. Ambas APIs convivieron sobre la
  misma base, con JWT y hashes de contraseña compatibles, y la misma suite de Playwright validó
  los dos backends antes del corte.
- **Adopción de Prisma sobre una base de producción compartida.** Un diagnóstico de solo lectura
  ([`npm run db:diagnose`](backend/scripts/db-diagnose.ts)) detectó diferencias reales entre
  producción y el esquema esperado antes de tocar nada. La migración se hizo con baseline, backups
  restaurados y verificados, el historial aislado en el schema de la app y checksums que confirmaron
  que no cambió ningún dato. Procedimiento completo en [backend/docs/DEPLOY.md](backend/docs/DEPLOY.md).
- **Pagos robustos.** Se cobra el precio guardado en la base (no el que envía el navegador). El
  webhook valida la firma HMAC de MercadoPago, consulta el estado real del pago, es idempotente y
  tolera notificaciones repetidas o desordenadas. Montos menores, turnos cancelados u horarios ya
  ocupados quedan registrados para revisión en lugar de confirmarse a ciegas.
- **Fechas sin ambigüedad.** La base guarda instantes UTC (`timestamptz`); la grilla de horarios y
  los reportes se calculan en la hora de Buenos Aires con `Intl`, sin dependencias.
- **Imagen Docker liviana y segura.** Build multistage sobre Node 24 Alpine: la imagen de la API no
  incluye el CLI de Prisma, tests ni scripts, corre sin root y tiene healthcheck. Las migraciones
  corren desde un target aparte.

## ✅ Calidad y CI/CD

Cada push y pull request a `main` y `develop` ejecuta en GitHub Actions:

| Suite | Herramienta | Tests |
|---|---|---|
| Unitarios del frontend | Vitest | 19 |
| Unitarios del backend | Jest | 70 |
| E2E de la API contra PostgreSQL real | Jest + Supertest | 73 |
| E2E con navegador real (frontend + API + base) | Playwright | 17 |
| **Total** | | **179** |

Además: lint y build de ambos proyectos, migraciones sobre una base limpia, chequeo de que
`schema.prisma` no se desvíe de las migraciones y build de las imágenes Docker. Los servicios
externos (MercadoPago, Google, email) se simulan en los tests: nada sale a internet.

## 🚀 Ejecución local

**Requisitos:** Node.js 24 y Docker.

```bash
git clone https://github.com/kevinarce14/luminance-estetica.git
cd luminance-estetica

# 1. API + base de datos
cd backend
cp .env.example .env            # valores de desarrollo listos para usar
docker compose up -d            # PostgreSQL 17 en localhost:5433
npm install                     # también genera el cliente de Prisma
npm run db:migrate              # aplica las migraciones
npm run db:seed                 # admin inicial, servicios y horario semanal
npm run start:dev               # API en http://localhost:3000/api

# 2. Frontend (en otra terminal)
cd web
npm install
npm run dev                     # http://localhost:5173 (el proxy de Vite apunta a la API local)
```

Usuario administrador del seed: `admin@luminancestudio.com` / `ChangeThisPassword123!`
(configurable con `INITIAL_ADMIN_*` en `backend/.env`). Sin credenciales de MercadoPago, Google o
Mailjet esas integraciones quedan deshabilitadas; en desarrollo el link de recuperación de
contraseña se muestra en la consola de la API.

### Tests

```bash
cd backend && npm test && npm run test:e2e        # unitarios + E2E de la API (usa la base de Docker)
cd web && npm test                                # unitarios del frontend
cd web && npx playwright install chromium
TEST_DATABASE_URL=postgresql://luminance:luminance@localhost:5433/luminance_e2e npm run test:e2e
```

La suite de Playwright usa una base **descartable** (se borra y recrea en cada corrida).

## ☁️ Despliegue

| Componente | Plataforma | Cómo se despliega |
|---|---|---|
| Frontend | **Vercel** (`web/` como raíz) | Build de Vite en cada push a `main`; `vercel.json` resuelve las rutas de la SPA |
| API | **Render** (Docker, `backend/`) | Imagen multistage del [Dockerfile](backend/Dockerfile); healthcheck en `/api/health` |
| Base de datos | **Neon** (PostgreSQL 17) | Migraciones con `prisma migrate deploy` desde la imagen `migrate` |
| Pagos | **MercadoPago** | Webhook a `/api/payments/webhook` con firma `x-signature` |

- El frontend en producción usa la API de Render por defecto (`web/src/config/api.ts`);
  `VITE_API_BASE_URL` permite apuntar a otra.
- Variables de entorno, migraciones y rollback: [backend/docs/DEPLOY.md](backend/docs/DEPLOY.md).
- **Plan gratuito**: tanto Render como Neon suspenden los servicios sin tráfico, por eso la primera
  petición después de un rato puede tardar hasta un minuto.

## 📁 Estructura

```
luminance-estetica/
├── web/                    # Frontend React 19 + TypeScript (Vite)
│   ├── src/
│   │   ├── pages/          # Home, Studio, Turnera, Pago, Mis Turnos, Auth y panel admin
│   │   ├── components/     # UI reutilizable, turnera, panel y gráficos
│   │   ├── context/        # Sesión (AuthContext)
│   │   ├── services/       # Cliente HTTP tipado por recurso
│   │   └── types/          # Contratos de la API
│   └── e2e/                # Suite Playwright
├── docs/architecture/      # Diagramas: ER, despliegue, secuencia y casos de uso
├── backend/                # API NestJS + Prisma
│   ├── src/modules/        # auth, users, services, availability, appointments, payments, admin
│   ├── prisma/             # schema, migraciones y seed
│   ├── test/               # E2E de la API y servidor para Playwright
│   ├── docs/DEPLOY.md      # Deploy y migración de producción
│   └── Dockerfile
└── .github/workflows/      # CI
```

## 🗺️ Evolución del proyecto

| Versión | Hito |
|---|---|
| `1.0.0` | Primera versión: HTML/CSS/JS + FastAPI + PostgreSQL |
| `v1.0.0-fastapi-react` · `v1.0.1` | Frontend migrado a React 19 + TypeScript, con paridad completa |
| `v2.0.0-nestjs` | API reescrita en NestJS + Prisma, Docker y CI con E2E sobre ambos backends |
| actual | Producción 100 % NestJS y repositorio sin código legado (disponible en el historial y los tags) |

## 👤 Autor

**Kevin Arce** — Desarrollador Fullstack
GitHub: [@kevinarce14](https://github.com/kevinarce14)

Proyecto desarrollado para **Luminance Studio by Cande**.
