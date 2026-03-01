# 🚀 DEPLOY GRATUITO: VERCEL + RENDER + DOCKER
## Luminance Estética - Manual Completo

---

## 🎯 ARQUITECTURA DEL DEPLOY

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  VERCEL (Frontend)              RENDER (Backend + BD)  │
│  ┌──────────────┐               ┌──────────────────┐   │
│  │ HTML + JS    │───────────────│  Docker          │   │
│  │ studio.html  │   API calls   │  - FastAPI       │   │
│  │ turnera.html │               │  - PostgreSQL    │   │
│  └──────────────┘               └──────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
     ↓                                   ↓
https://luminance.vercel.app    https://luminance-api.onrender.com
```

**Ventajas:**
- ✅ **100% GRATIS** (no pide tarjeta al principio)
- ✅ **SSL/HTTPS automático**
- ✅ **Docker maneja las dependencias** (se acabó el requirements.txt problemático)
- ✅ **BD incluida en Render** (no necesitas Neon separado)

---

## 📋 TABLA DE CONTENIDOS

1. [Preparar el proyecto](#1-preparar-el-proyecto)
2. [Deploy del Backend en Render](#2-deploy-del-backend-en-render)
3. [Deploy del Frontend en Vercel](#3-deploy-del-frontend-en-vercel)
4. [Configurar las APIs externas](#4-configurar-las-apis-externas)
5. [Manual para el cliente](#5-manual-para-el-cliente)
6. [Troubleshooting](#6-troubleshooting)

---

## 1️⃣ PREPARAR EL PROYECTO

### PASO 1.1: Crear archivos de Docker para Render

Render necesita estos archivos en la **raíz del proyecto**:

**📄 Dockerfile** (sin extensión, solo "Dockerfile"):
```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Instalar dependencias del sistema para psycopg2
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código
COPY app/ ./app/

EXPOSE 8000

# Comando de inicio
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**📄 render.yaml** (configuración de Render):
```yaml
services:
  - type: web
    name: luminance-backend
    runtime: docker
    plan: free
    env: python
    buildCommand: docker build -t luminance-backend .
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: PYTHON_VERSION
        value: 3.12.0
      - key: DATABASE_URL
        fromDatabase:
          name: luminance-db
          property: connectionString
      - key: SECRET_KEY
        generateValue: true
      - key: ALGORITHM
        value: HS256
      - key: ACCESS_TOKEN_EXPIRE_MINUTES
        value: 10080

databases:
  - name: luminance-db
    plan: free
    databaseName: luminance
    user: luminance_user
```

**📄 .dockerignore**:
```
.env
.git
__pycache__
*.pyc
venv/
.venv/
.vscode/
*.log
frontend/
README.md
```

---

### PASO 1.2: Actualizar CORS en config.py

En `app/core/config.py`, cambiá la línea de CORS_ORIGINS: 

```python
#en realidad estos cambios van en .env
# ANTES:
CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5000,..."

# DESPUÉS (agregá tu dominio de Vercel):
CORS_ORIGINS: str = "https://tu-proyecto.vercel.app,http://localhost:5000,http://localhost:3000"
```

**Nota:** Después del primer deploy en Vercel, vas a tener el dominio real y tenés que volver a cambiarlo.

---

### PASO 1.3: Actualizar la URL del backend en api.js

En `frontend/api.js`, buscar la línea que define `API_BASE_URL`:

```javascript
//en realidad este cambio va en .env
// ANTES:
const API_BASE_URL = 'http://localhost:8000';

// DESPUÉS:
const API_BASE_URL = 'https://tu-proyecto.onrender.com';
```

**Nota:** Lo mismo, después del primer deploy de Render tenés que actualizar con la URL real.

---

### PASO 1.4: Subir a GitHub

```bash
# Inicializar git (si no lo hiciste)
git init

# Agregar todo
git add .
git commit -m "Initial commit con Docker"

# Crear repo en GitHub y subirlo
git remote add origin https://github.com/tu-usuario/luminance-estetica.git
git branch -M main
git push -u origin main
```

**⚠️ IMPORTANTE:** Asegurate de que `.env` esté en `.gitignore` (nunca subir contraseñas a GitHub).

---

## 2️⃣ DEPLOY DEL BACKEND EN RENDER

### PASO 2.1: Crear cuenta en Render

1. Andá a [https://render.com](https://render.com)
2. Click en **"Get Started for Free"**
3. Registrate con GitHub (más fácil)

---

### PASO 2.2: Crear el servicio web

1. En el dashboard de Render, click **"New +"** → **"Web Service"**

2. Conectá tu repositorio de GitHub:
   - Click **"Connect GitHub"**
   - Autorizar Render
   - Seleccionar `luminance-estetica`

3. Configuración del servicio:
   ```
   Name:           luminance-backend
   Region:         Frankfurt (EU Central) o Oregon (US West)
   Branch:         main
   Runtime:        Docker
   Instance Type:  Free
   ```

4. **NO** hacer click en "Create Web Service" todavía.

---

### PASO 2.3: Crear la base de datos PostgreSQL

Antes de crear el servicio, necesitás la BD:

1. En el mismo dashboard, **en otra pestaña**, click **"New +"** → **"PostgreSQL"**

2. Configuración:
   ```
   Name:           luminance-db
   Database:       luminance
   User:           luminance_user
   Region:         (el mismo que elegiste para el backend)
   Instance Type:  Free
   ```

3. Click **"Create Database"**

4. Esperar ~2 minutos a que se cree.

5. Una vez creada, click en la BD → pestaña **"Info"** → copiar la **"Internal Database URL"**
   ```
   Ejemplo:
   postgresql://luminance_user:XXX@dpg-XXX/luminance
   ```

---

### PASO 2.4: Configurar variables de entorno del backend

Volver a la pestaña donde estabas creando el Web Service:

1. Expandir **"Environment Variables"**

2. Agregar estas variables una por una (click **"Add Environment Variable"**):

```
DATABASE_URL = postgresql://luminance_user:XXX@dpg-XXX/luminance
(pegar la URL que copiaste del paso anterior)

SECRET_KEY = 
(generar con: python -c "import secrets; print(secrets.token_hex(32))")

ALGORITHM = HS256

ACCESS_TOKEN_EXPIRE_MINUTES = 10080

CORS_ORIGINS = https://tu-proyecto.vercel.app
(esto lo vas a actualizar después del paso 3)

MERCADOPAGO_ACCESS_TOKEN = APP_USR-tu-token-aqui

RESEND_API_KEY = re_tu-api-key-aqui

TWILIO_ACCOUNT_SID = ACtu-sid
(opcional, dejá en blanco si no lo usás)

TWILIO_AUTH_TOKEN = tu-token
(opcional)

ENVIRONMENT = production
```

---

### PASO 2.5: Crear el servicio

1. Ahora sí, click **"Create Web Service"**

2. Render va a:
   - Clonar tu repo
   - Construir la imagen de Docker (~5-10 minutos la primera vez)
   - Levantar el servicio

3. Ver los logs en tiempo real (aparecen en la página)

4. Cuando veas **"Application startup complete"**, está listo ✅

5. Copiar la URL del servicio (arriba de la página):
   ```
   https://luminance-backend.onrender.com
   ```

---

### PASO 2.6: Probar que funciona

Abrí en el navegador:
```
https://tu-backend.onrender.com/docs
```

Deberías ver la documentación interactiva de FastAPI. Si ves esto, el backend funciona ✅

---

## 3️⃣ DEPLOY DEL FRONTEND EN VERCEL

### PASO 3.1: Crear cuenta en Vercel

1. Andá a [https://vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Elegí **"Continue with GitHub"**

---

### PASO 3.2: Importar el proyecto

1. En el dashboard, click **"Add New..."** → **"Project"**

2. Click **"Import"** al lado de tu repo `luminance-estetica`

3. Configuración:
   ```
   Framework Preset:  Other
   Root Directory:    frontend
   Build Command:     (dejar vacío)
   Output Directory:  (dejar vacío)
   Install Command:   (dejar vacío)
   ```

4. Click **"Deploy"**

5. Esperar ~1 minuto.

6. Cuando termine, te da la URL:
   ```
   https://luminance-estetica.vercel.app
   ```

---

### PASO 3.3: Actualizar la URL del backend en api.js

Ahora que tenés la URL real de Render, actualizá `frontend/api.js`:

```javascript
// Cambiar esta línea:
const API_BASE_URL = 'https://luminance-backend.onrender.com';
```

Después hacer commit y push:
```bash
git add frontend/api.js
git commit -m "Update backend URL"
git push
```

Vercel redeploya automáticamente en ~30 segundos.

---

### PASO 3.4: Actualizar CORS en el backend

Ahora que tenés la URL de Vercel, actualizá la variable de entorno en Render:

1. Ir a Render → tu servicio backend → **"Environment"**
2. Editar `CORS_ORIGINS`:
   ```
   https://luminance-estetica.vercel.app,http://localhost:5000
   ```
3. Click **"Save Changes"**
4. Render redeploya automáticamente

---

## 4️⃣ CONFIGURAR LAS APIS EXTERNAS

### 🔐 4.1 - MercadoPago

**¿Para qué?** Procesar pagos de los turnos.

**Pasos:**

1. Crear cuenta en [https://www.mercadopago.com.ar](https://www.mercadopago.com.ar)

2. Ir a **"Tu negocio"** → **"Configuración"** → **"Credenciales"**

3. Activar **"Modo producción"** (cuando estés listo para cobrar de verdad)
   - Para pruebas, usar **"Modo de prueba"**

4. Copiar el **"Access Token"** (empieza con `APP_USR-`)

5. En Render → tu backend → **"Environment"** → editar `MERCADOPAGO_ACCESS_TOKEN`

6. **Webhook URL:** En MercadoPago, configurar:
   ```
   https://luminance-backend.onrender.com/api/payments/webhook
   ```

---

### 📧 4.2 - Configuracion servicio Email (Yo usé sendgrid y me fue bien)

**¿Para qué?** Enviar emails de confirmación de turnos.

### Opción A: SendGrid (Recomendado - 100 emails gratis/día)

1. **Crear cuenta**: https://sendgrid.com/free/
2. **Verificar email**: Confirma tu email en la bandeja de entrada
3. **Crear API Key**:
   - Settings → API Keys → Create API Key
   - Name: `Luminance-production`
   - Permissions: **Full Access**
   - Click "Create & View"
   - **COPIA LA API KEY** (solo se muestra una vez)
   
4. **Verificar dominio de remitente** (Sender Verification):
   - Settings → Sender Authentication
   - Verify a Single Sender
   - Email: `noreply@mentummedia.com` (o tu dominio)
   - From Name: `Mentum Media`
   - Completa el formulario y verifica el email

**Guarda**: `SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxx`

### Opción B: Resend (Alternativa - 3,000 emails gratis/mes)

1. **Crear cuenta**: https://resend.com/signup
2. **Crear API Key**:
   - API Keys → Create API Key
   - Name: `Luminance-production`
   - Permission: **Sending access**
   - Click "Add"
   - **COPIA LA API KEY**

3. **Verificar dominio**:
   - Domains → Add Domain
   - Ingresa tu dominio o usa `onrender.com` temporalmente
   - Sigue las instrucciones de DNS

**Guarda**: `RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx`

---

### 📱 4.3 - Twilio (WhatsApp) - OPCIONAL

**¿Para qué?** Enviar recordatorios de turnos por WhatsApp.

**Pasos:**

1. Crear cuenta en [https://www.twilio.com](https://www.twilio.com)

2. Ir a **"Console"**

3. Copiar:
   - **Account SID** (empieza con `AC`)
   - **Auth Token**

4. En Render → tu backend → **"Environment"**:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`

5. En Twilio → **"Messaging"** → **"WhatsApp sandbox"** → Seguir instrucciones

**Nota:** Si no lo vas a usar, dejá estas variables vacías.

---

## 5️⃣ MANUAL PARA EL CLIENTE

### 📖 Cómo obtener las claves API

Este manual es para vos (el desarrollador) para explicarle al cliente cómo conseguir sus propias claves cuando se las pida.

---

#### 🔐 SECRET_KEY (JWT)

**¿Qué es?** Una clave secreta para firmar los tokens de sesión.

**Cómo obtenerla:**
```bash
# Abrir terminal y ejecutar:
python -c "import secrets; print(secrets.token_hex(32))"

# Te va a dar algo como:
# 8f7a3d9c2e1b6f4a5c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b

# Copiar y pegar en la variable SECRET_KEY
```

---

#### 💳 MERCADOPAGO_ACCESS_TOKEN

**¿Qué es?** Para procesar pagos con tarjeta.

**Cómo obtenerla:**

1. Entrá a [https://www.mercadopago.com.ar](https://www.mercadopago.com.ar)
2. Creá una cuenta (es gratis)
3. Andá a **"Tu negocio"** (arriba a la derecha)
4. Click en **"Configuración"**
5. En el menú izquierdo, **"Credenciales"**
6. Vas a ver dos modos:
   - **Pruebas:** Para probar sin mover plata real
   - **Producción:** Para cobrar de verdad
7. Activá el modo que necesites
8. Copiá el **"Access Token"** (empieza con `APP_USR-`)
9. Pegalo en la variable `MERCADOPAGO_ACCESS_TOKEN`

**⚠️ Importante para producción:**
- Completá los datos de tu negocio en MercadoPago
- Verificá tu identidad (te piden DNI)
- Configurá la URL del webhook en MercadoPago:
  ```
  https://tu-backend.onrender.com/api/payments/webhook
  ```

---

#### 📧 RESEND_API_KEY

**¿Qué es?** Para enviar emails de confirmación automáticos.

**Cómo obtenerla:**

1. Entrá a [https://resend.com](https://resend.com)
2. Click en **"Start Building"** → Registrate con Google/GitHub
3. Una vez adentro, andá a **"API Keys"** (menú izquierdo)
4. Click **"Create API Key"**
5. Nombre: `Produccion` (o el que quieras)
6. Permisos: Dejá todo por defecto
7. Click **"Create"**
8. **Copiá la key** (empieza con `re_` y solo la ves UNA VEZ)
9. Pegala en `RESEND_API_KEY`

**📨 Para emails más profesionales (opcional):**
1. En Resend → **"Domains"** → **"Add Domain"**
2. Agregar tu dominio (ej: `luminancestudio.com.ar`)
3. Te van a dar registros DNS para agregar en tu proveedor de dominio
4. Una vez verificado, los emails van a salir de `noreply@luminancestudio.com.ar`

**💰 Planes:**
- **Gratis:** 3.000 emails/mes (alcanza para empezar)
- **Pago:** USD 20/mes = 50.000 emails

---

#### 📱 TWILIO (WhatsApp) - OPCIONAL

**¿Qué es?** Para enviar recordatorios de turnos por WhatsApp.

**Cómo obtenerla:**

1. Entrá a [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Completá el formulario (nombre, email, contraseña)
3. Verificá tu email y teléfono
4. En la consola vas a ver:
   - **Account SID** (empieza con `AC`)
   - **Auth Token** (click en el ojito para verlo)
5. Copiá ambos y pegalos en:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`

**🔧 Configurar WhatsApp:**
1. En Twilio → **"Messaging"** → **"Try it out"** → **"Send a WhatsApp message"**
2. Seguí las instrucciones para conectar tu número de WhatsApp
3. En modo sandbox (gratis) podés enviar hasta 1000 mensajes/día

**⚠️ Para usar tu propio número de WhatsApp Business:**
- Necesitás aprobar una WhatsApp Business API (tarda ~1 semana)
- Cuesta USD 25/mes de Twilio + costos por mensaje

**Alternativa más barata:** No uses Twilio, simplemente enviá recordatorios manuales por WhatsApp común.

---

## 6️⃣ TROUBLESHOOTING

### ❌ Error: "Application failed to respond"

**Causa:** El backend no arrancó correctamente.

**Solución:**
1. Ir a Render → tu servicio → **"Logs"**
2. Buscar errores en rojo
3. Problemas comunes:
   - Variable de entorno mal configurada
   - DATABASE_URL incorrecta
   - Error en el código Python

---

### ❌ Error: CORS policy blocked

**Causa:** El frontend no está en la lista de CORS_ORIGINS.

**Solución:**
1. Render → backend → **"Environment"** → editar `CORS_ORIGINS`
2. Agregar: `https://tu-dominio.vercel.app`
3. Guardar → esperar redeploy

---

### ❌ Backend se duerme (tarda mucho en responder)

**Causa:** Render free tier duerme después de 15 minutos de inactividad.

**Solución:**
- Primera carga después de dormir tarda ~30-60 segundos (normal)
- Para evitarlo: Usar un servicio de "ping" gratuito:
  - [https://cron-job.org](https://cron-job.org)
  - Configurar un ping cada 10 minutos a tu backend

---

### ❌ La base de datos se borró

**Causa:** Render free tier borra la BD después de 90 días de inactividad.

**Prevención:**
- Hacer backups regularmente
- Comando desde tu PC:
  ```bash
  pg_dump DATABASE_URL > backup.sql
  ```

---

### ❌ Error al hacer build en Render

**Causa:** Dockerfile mal configurado o dependencia faltante.

**Solución:**
1. Verificar que `requirements.txt` esté completo
2. Verificar que la estructura de carpetas sea correcta:
   ```
   proyecto/
   ├── Dockerfile
   ├── requirements.txt
   └── app/
       └── main.py
   ```

---

## 📊 RESUMEN: ¿Dónde está cada cosa?

```
Frontend HTML/JS         →  Vercel
Backend FastAPI          →  Render (con Docker)
Base de datos PostgreSQL →  Render (incluida)
Pagos                    →  MercadoPago API
Emails                   →  SendGrid API
WhatsApp (opcional)      →  Twilio API
```

---

## ✅ CHECKLIST FINAL

Antes de decir que está listo, verificá:

- [ ] Frontend carga en Vercel
- [ ] Backend responde en `/docs`
- [ ] Login funciona
- [ ] Crear turno funciona
- [ ] Pago con MercadoPago funciona
- [ ] Email de confirmación llega
- [ ] Admin dashboard funciona
- [ ] Variables de entorno están bien configuradas
- [ ] CORS permite la comunicación frontend ↔ backend
- [ ] `.env` NO está en GitHub

---

## 🎉 ¡LISTO!

Tu proyecto está deployado 100% gratis con:
- ✅ SSL/HTTPS automático
- ✅ Docker manejando las dependencias
- ✅ Base de datos incluida
- ✅ Redeploy automático con cada push a GitHub
