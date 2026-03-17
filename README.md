# 💅 Luminance Estética - Backend API

Backend profesional para el sistema de gestión de turnos, pagos y administración del estudio de estética **Luminance Studio by Cande**.

## 🎯 Características

### Sistema de Turnos
- ✅ Calendario interactivo con disponibilidad en tiempo real
- ✅ Reserva de citas con múltiples servicios
- ✅ Confirmación automática por email/WhatsApp
- ✅ Recordatorios automáticos 24h antes
- ✅ Cancelación y reprogramación
- ✅ Bloqueo de horarios no disponibles

### Sistema de Pagos
- 💳 Integración con MercadoPago
- 💰 Pagos online y offline
- 📊 Registro de transacciones
- 🎁 Sistema de descuentos y cupones (falta implementar, a pedido del cliente)
- 📈 Reportes de facturación

### Gestión de Clientes
- 👤 Perfiles de clientes
- 📝 Historial de servicios
- 💌 Preferencias de contacto
- ⭐ Sistema de puntos de fidelidad (a implementar a futuro?)

### Administración
- 📊 Dashboard con métricas en tiempo real
- 📅 Gestión de agenda de disponibilidad
- 💼 Gestión de servicios y precios
- 📧 Envío de notificaciones
- 📈 Reportes y analytics

## 🏗️ Estructura del Proyecto

```
luminance-estetica/
├──frontend/
│         ├──admin-dashboard.html
│         ├──api.js
│         ├──index.html
│         ├──login.html
│         ├──mis-turnos.html
│         ├──pago-exitoso.html
│         ├──pago-fallido.html
│         ├──pago.html
│         ├──responsive.css
│         ├──studio.html
│         └──turnera.html
├── app/
│   ├── __init__.py
│   ├── main.py                      # FastAPI app principal
│   │
│   ├── core/                        # Configuración central
│   │   ├── __init__.py
│   │   ├── config.py                # Settings y env vars
│   │   ├── security.py              # JWT, hashing, etc.
│   │   └── database.py              # Conexión PostgreSQL
│   │
│   ├── models/                      # Modelos SQLAlchemy
│   │   ├── __init__.py
│   │   ├── user.py                  # Usuarios (clientes + admin)
│   │   ├── appointment.py           # Citas/Turnos
│   │   ├── service.py               # Servicios del studio
│   │   ├── payment.py               # Pagos y transacciones
│   │   ├── availability.py          # Horarios disponibles
│   │   └── coupon.py                # Cupones de descuento
│   │
│   ├── schemas/                     # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── appointment.py
│   │   ├── service.py
│   │   ├── payment.py
│   │   ├──availabity.py
│   │   ├──coupon.py
│   │   └── auth.py
│   │
│   ├── routes/                         # Endpoints
│   │   ├── __init__.py
│   │   ├── deps.py                  # Dependencias (get_db, get_current_user)
│   │   ├── auth.py              # Login, register, password reset
│   │   ├── appointments.py      # CRUD de turnos
│   │   ├── services.py          # CRUD de servicios
│   │   ├── payments.py          # MercadoPago webhooks
│   │   ├── users.py             # Gestión de clientes
│   │   ├── availability.py      # Horarios disponibles
│   │   └── admin.py             # Endpoints de administración
│   │
│   └── services/                    # Lógica de negocio
│       ├── __init__.py
│       ├── email_service.py         # SendGrid/Resend
│       ├── whatsapp_service.py      # Twilio WhatsApp
│       ├── payment_service.py       # MercadoPago
│       ├── appointment_service.py   # Lógica de reservas
│       ├──scheduler_service.py   # actualizacion automatica estados de los turnos
│       └── notification_service.py  # Recordatorios automáticos
│   
├── .dockerignore
├── .env                    # Template de variables
├── .gitignore
├── .vercelignore (creo que no se usa y se puede eliminar)
├── arquitectura.txt
├── DEPLOY_GRATUITO_VERCEL_RENDER.md
├── Dockerfile
├── requirements.txt
├── runtime.txt                      # Python version para Render
├── render.yaml
└── README.md
```

## 🚀 Stack Tecnológico

- **Framework**: FastAPI 0.104+
- **Database**: PostgreSQL 15
- **ORM**: SQLAlchemy 2.0
- **Email**: SendGrid
- **WhatsApp**: Twilio API
- **Pagos**: MercadoPago SDK
- **Auth**: JWT (python-jose)
- **Validation**: Pydantic v2
- **Migrations**: Alembic
- **Testing**: Pytest

## 📦 Instalación Local

### Prerrequisitos
- Python 3.11+
- PostgreSQL 15+
- Git

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/luminance-estetica-backend.git
cd luminance-estetica-backend
```

### 2. Crear entorno virtual
```bash
python -m venv venv

# Linux/Mac
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 3. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 4. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

### 5. Crear base de datos
```bash
# Crear BD en PostgreSQL
createdb luminance_estetica

# Ejecutar migraciones
alembic upgrade head
```

### 6. Correr el servidor
```bash
uvicorn app.main:app --reload
```

API disponible en: http://localhost:8000
Docs: http://localhost:8000/docs

## 🔑 Variables de Entorno

Ver archivo `.env.example` para la lista completa.

### Esenciales:
```env
DATABASE_URL=postgresql://user:pass@localhost/luminance_estetica
SECRET_KEY=tu-secret-key-super-segura
SENDGRID_API_KEY=SG.xxx
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxx
TWILIO_ACCOUNT_SID=ACxxx
```

## 📡 API Endpoints

### Autenticación
```
POST   /api/v1/auth/register          # Registro de cliente
POST   /api/v1/auth/login              # Login
POST   /api/v1/auth/password-reset     # Resetear contraseña
```

### Turnos/Citas
```
GET    /api/v1/appointments            # Listar turnos
POST   /api/v1/appointments            # Crear turno
GET    /api/v1/appointments/{id}       # Ver turno
PUT    /api/v1/appointments/{id}       # Modificar turno
DELETE /api/v1/appointments/{id}       # Cancelar turno
GET    /api/v1/appointments/available  # Horarios disponibles
```

### Servicios
```
GET    /api/v1/services                # Listar servicios
GET    /api/v1/services/{id}           # Ver servicio
POST   /api/v1/services                # Crear servicio (admin)
PUT    /api/v1/services/{id}           # Editar servicio (admin)
```

### Pagos
```
POST   /api/v1/payments/create         # Crear preferencia MP
POST   /api/v1/payments/webhook        # Webhook MercadoPago
GET    /api/v1/payments/{id}           # Ver pago
```

### Admin
```
GET    /api/v1/admin/dashboard         # Métricas del dashboard
GET    /api/v1/admin/clients           # Listar clientes
GET    /api/v1/admin/reports           # Reportes
```

Documentación interactiva completa: `/docs`

## 🚀 Deployment

### Opción 1: Render (Recomendado)

1. Conectar repositorio de GitHub
2. Crear PostgreSQL database
3. Crear Web Service
4. Configurar variables de entorno
5. Deploy automático

Ver `DEPLOYMENT.md` para guía detallada.

### Opción 2: Railway

```bash
railway login
railway init
railway up
```

### Opción 3: Fly.io

```bash
fly launch
fly deploy
```

## 🧪 Testing

```bash
# Instalar dependencias de desarrollo
pip install -r requirements-dev.txt

# Correr tests
pytest

# Con coverage
pytest --cov=app tests/

# Test específico
pytest tests/test_appointments.py
```

## 📊 Base de Datos

### Modelos Principales

**User** (Clientes y Administradores)
- id, email, phone, full_name
- hashed_password, is_active, is_admin
- created_at, updated_at

**Appointment** (Turnos)
- id, user_id, service_id
- appointment_date, start_time, end_time
- status (pending, confirmed, completed, cancelled)
- notes, reminder_sent

**Service** (Servicios del Studio)
- id, name, description
- duration_minutes, price
- category (pestañas, cejas, corporal, etc.)
- is_active

**Payment** (Pagos)
- id, appointment_id, user_id
- amount, currency (ARS)
- payment_method, status
- mercadopago_id, transaction_id

**Availability** (Disponibilidad)
- id, day_of_week
- start_time, end_time
- is_available

## 🔐 Seguridad

- ✅ JWT para autenticación
- ✅ Bcrypt para hash de contraseñas
- ✅ Rate limiting (100 req/min)
- ✅ CORS configurado
- ✅ Validación de inputs con Pydantic
- ✅ SQL injection protection (SQLAlchemy)
- ✅ Variables sensibles en .env

## 📧 Notificaciones

### Email (SendGrid)
- Confirmación de turno
- Recordatorio 24h antes
- Cancelación de turno
- Bienvenida al registrarse

### WhatsApp (Twilio)
- Confirmación inmediata
- Recordatorio 1h antes (opcional)

## 💳 MercadoPago

### Flujo de pago:
1. Cliente reserva turno
2. Backend crea preferencia en MP
3. Cliente paga en checkout de MP
4. Webhook confirma pago
5. Turno se marca como confirmado
6. Email de confirmación

## 🛠️ Comandos Útiles

```bash
# Crear migración
alembic revision -m "descripcion"

# Aplicar migraciones
alembic upgrade head

# Rollback
alembic downgrade -1

# Poblar BD con datos de prueba
python scripts/seed_database.py

# Formatear código
black app/
isort app/

# Linting
flake8 app/
mypy app/
```

## 📝 Licencia

Proyecto privado - Todos los derechos reservados © 2024 Luminance Studio by Cande

## 👤 Contacto

- **Cliente**: Cande - Luminance Studio
- **Desarrollador**: [Tu Nombre]
- **Email**: [tu-email]
- **GitHub**: [tu-github]

## 🗺️ Roadmap

### v1.0 (MVP) ✅
- [x] Autenticación básica
- [x] Sistema de turnos
- [x] Integración MercadoPago
- [x] Emails automáticos
- [x] Panel de admin básico

### v1.1 (Próximo)
- [ ] WhatsApp notifications
- [ ] Sistema de cupones
- [ ] Puntos de fidelidad
- [ ] Recordatorios automáticos
- [ ] Multi-staff scheduling

### v2.0 (Futuro)
- [ ] App móvil
- [ ] Video consultas
- [ ] Programa de referidos
- [ ] Analytics avanzados
- [ ] Integración con Instagram

---

**Hecho con 💅 para Luminance Studio by Cande**
