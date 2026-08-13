# 💅 Luminance Estética — Sistema Web de Gestión de Turnos & Pagos

> **Plataforma Web Full Stack** para la reserva automatizada de citas, procesamiento de señas/pagos online y administración integral del centro de estética **Luminance Studio by Cande**.

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-Deployed-46E3B7?style=for-the-badge&logo=render&logoColor=white)

---

## 🎯 ¿De qué trata el proyecto?

El sistema soluciona de forma punta a punta la agenda y recaudación de un estudio de estética, eliminando el manejo manual de mensajes para coordinar turnos. Permite a las clientas reservar su cita de forma autónoma con validación de horarios en tiempo real, pagar la seña a través de MercadoPago y recibir confirmaciones automáticas.

---

## 🌟 Características Principales

### 📅 Cliente & Reserva de Turnos
- **Calendario dinámico:** Selección de fecha y hora con cálculo de disponibilidad en tiempo real.
- **Reserva multi-servicio:** Selección de tratamientos (Pestañas, Cejas, Limpieza facial, etc.).
- **Gestión de Mis Turnos:** Vista para que la clienta consulte, controle o cancele sus reservas.
- **Notificaciones automáticas:** Confirmaciones inmediatas vía Email (SendGrid / Resend) y WhatsApp (Twilio API).

### 💳 Pagos & Pasarela Online
- **Integración con MercadoPago:** Generación automática de preferencia de pago/seña y sincronización mediante **Webhooks** asíncronos.
- **Control de estados:** Registro de transacciones (Aprobado, Pendiente, Fallido).

### ⚙️ Administración & Automatización
- **Admin Dashboard:** Panel privado para consultar turnos del día, cambiar estados y visualizar métricas principales.
- **Gestión de Agenda:** Configuración flexible de días u horarios no laborables y bloqueo de agenda.
- **Tareas Programadas (APScheduler):** Proceso en segundo plano que libera turnos impagos o vencidos automáticamente.

---

## 🏗️ Arquitectura de Deploy (Cloud)

El proyecto está diseñado bajo una arquitectura distribuida sin costo operativo:


```

┌─────────────────────────────────────────────────────────┐
│                                                         │
│  VERCEL (Frontend)              RENDER (Backend + BD)  │
│  ┌──────────────┐               ┌──────────────────┐   │
│  │ HTML5 + JS   │───────────────│  Docker Container│   │
│  │ Vanilla      │   API REST    │  - FastAPI       │   │
│  └──────────────┘               │  - PostgreSQL    │   │
│                                 └──────────────────┘   │
└─────────────────────────────────────────────────────────┘

```

- **Frontend:** Estojado y servido de forma ultra rápida en **Vercel**.
- **Backend API:** Contenedorized con **Docker** e instanciado en **Render**.
- **Base de Datos:** **PostgreSQL 15** relacional alojado en Render.

---

## 🛠️ Stack Tecnológico

### Backend
- **Lenguaje:** Python 3.12
- **Framework Web:** FastAPI (API REST con OpenAPI/Swagger interactivo)
- **Base de Datos & ORM:** PostgreSQL + SQLAlchemy 2.0 (Relacional, `cascade="all, delete-orphan"`)
- **Validación de Datos:** Pydantic v2
- **Seguridad & Auth:** JWT (`python-jose`) + Hashing de contraseñas con `Bcrypt`
- **Tareas Background:** APScheduler

### Frontend
- **Arquitectura:** Single Page Logic / Asíncrono
- **Lenguajes:** HTML5 Semantic, CSS3 (Diseño Responsive) y JavaScript Vanilla (ES6+ Fetch API)

### Servicios Integrados
- **Pagos:** MercadoPago SDK
- **Email Transaccional:** SendGrid / Resend
- **Notificaciones SMS/WhatsApp:** Twilio API

---

## 📁 Estructura del Repositorio

```text
luminance-estetica/
├── frontend/                     # Interfaz de usuario y panel administrativo
│   ├── admin-dashboard.html      # Panel de administración
│   ├── api.js                    # Cliente de conexión API (Fetch)
│   ├── index.html                # Página principal / Landing
│   ├── login.html                # Autenticación de usuarios/admin
│   ├── mis-turnos.html           # Gestión de turnos del cliente
│   ├── turnera.html              # Flujo interactivo de reserva
│   └── ...                       # Pantallas de pago y estilos
├── app/                          # Código fuente del Backend (FastAPI)
│   ├── main.py                   # Punto de entrada de la aplicación
│   ├── core/                     # Configuración central, DB y Seguridad JWT
│   ├── models/                   # Modelos SQLAlchemy (User, Appointment, Service, etc.)
│   ├── schemas/                  # Validaciones y DTOs con Pydantic
│   ├── routes/                   # Endpoints de la API REST
│   └── services/                 # Lógica de negocio (MercadoPago, Emails, Scheduler)
├── Dockerfile                    # Configuración de imagen Docker para Backend
├── render.yaml                   # Configuración de despliegue Infrastructure-as-Code
├── requirements.txt              # Dependencias de Python
└── DEPLOY_GRATUITO_VERCEL_RENDER.md # Guía paso a paso de deploy

```

---

## 💻 Instalación y Ejecución Local

### Prerrequisitos

* Python 3.11+
* PostgreSQL corriendo localmente (o un string de conexión remoto)
* Git

### 1. Clonar el repositorio

```bash
git clone https://github.com/kevinarce14/luminance-estetica.git
cd luminance-estetica

```

### 2. Configurar el Entorno Virtual de Python

```bash
# Crear entorno virtual
python -m venv venv

# Activar en Windows:
venv\Scripts\activate

# Activar en Linux/Mac:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

```

### 3. Configurar Variables de Entorno (`.env`)

Crea un archivo `.env` en la raíz del proyecto basándote en la siguiente estructura:

```env
DATABASE_URL=postgresql://tu_usuario:tu_password@localhost:5432/luminance_db
SECRET_KEY=tu_clave_secreta_jwt
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxx
SENDGRID_API_KEY=SG.xxx
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx

```

### 4. Iniciar el Backend (Servidor API)

```bash
python -m uvicorn app.main:app --reload

```

> La API quedará escuchando en `http://localhost:8000`.
> Puedes ver la **documentación interactiva** en `http://localhost:8000/docs`.

### 5. Iniciar el Frontend

En otra terminal, navega a la carpeta `frontend` y levanta un servidor HTTP simple:

```bash
cd frontend
python -m http.server 5000

```

> Accede a la aplicación desde tu navegador en `http://localhost:5000`.

---

## 📡 Endpoints Destacados de la API

* `POST /api/v1/auth/login` — Autenticación y emisión de JWT.
* `GET /api/v1/appointments/available` — Consulta de horarios disponibles en tiempo real.
* `POST /api/v1/appointments` — Creación de reservas.
* `POST /api/v1/payments/webhook` — Recepción de eventos de pago MercadoPago.
* `GET /api/v1/admin/dashboard` — Métricas generales para el administrador.

---

## 🚀 Despliegue en Producción

Para conocer el procedimiento exacto de cómo desplegar este proyecto a producción sin costos (usando **Docker + Render + Vercel**), consulta nuestra guía paso a paso:

📄 **[Manual Completo de Deploy Gratis (./DEPLOY_GRATUITO_VERCEL_RENDER.md)]

---

## 👤 Autor & Contacto

* **Desarrollador:** Kevin Arce
* **GitHub:** [@kevinarce14](https://github.com/kevinarce14)
* **Proyecto desarrollado para:** Luminance Studio by Cande

```

