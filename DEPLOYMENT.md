# 🚀 GUÍA DE DEPLOYMENT - Luminance Estética Backend

Esta guía te lleva paso a paso para poner el backend en producción.

## 📋 Stack Recomendado (Gratis para empezar)

- **Backend API**: Render o Railway (plan gratuito)
- **Base de datos**: Render PostgreSQL o Supabase (gratis)
- **Emails**: SendGrid (100 emails gratis/día)
- **WhatsApp**: Twilio (plan de prueba)
- **Pagos**: MercadoPago (credenciales de prueba gratis)

---

## PARTE 1: Preparar Cuentas y Credenciales

### 1. SendGrid (Emails)

1. Crear cuenta: https://sendgrid.com/free/
2. Verificar email
3. Settings → API Keys → Create API Key
   - Name: `luminance-production`
   - Permissions: **Full Access**
4. **Copiar la API Key** (solo se muestra una vez)
5. Settings → Sender Authentication → Verify a Single Sender
   - From Email: `noreply@luminancestudio.com`
   - From Name: `Luminance Studio`

**Guardar**: `SENDGRID_API_KEY=SG.xxxxxxxxx`

### 2. MercadoPago (Pagos)

1. Crear cuenta: https://www.mercadopago.com.ar/
2. Tu cuenta → Credenciales
3. **Credenciales de prueba** (para testing):
   - Access Token: `TEST-xxxxxxxxx`
   - Public Key: `TEST-xxxxxxxxx`
4. **Credenciales de producción** (cuando estés listo):
   - Access Token: `APP_USR-xxxxxxxxx`
   - Public Key: `APP_USR-xxxxxxxxx`

**Guardar**:
```
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxxxx
MERCADOPAGO_PUBLIC_KEY=TEST-xxxxxxxxx
```

### 3. Twilio (WhatsApp - Opcional)

1. Crear cuenta: https://www.twilio.com/try-twilio
2. Crear proyecto
3. Console → Account Info:
   - Account SID: `ACxxxxxxxxx`
   - Auth Token: `xxxxxxxxx`
4. Messaging → Try WhatsApp
   - WhatsApp Number: `whatsapp:+14155238886`

**Guardar**:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

---

## PARTE 2: GitHub Repository

### 1. Crear repositorio

```bash
cd luminance-estetica-backend
git init
git add .
git commit -m "Initial commit - Luminance Estética Backend"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/luminance-estetica-backend.git
git push -u origin main
```

**IMPORTANTE**: Verifica que `.env` NO se subió (debe estar en .gitignore).

---

## PARTE 3: Deploy del Backend (Render)

### 1. Crear cuenta en Render

Ve a https://render.com y regístrate con tu cuenta de GitHub.

### 2. Crear Base de Datos PostgreSQL

1. Dashboard → "New" → "PostgreSQL"
2. Configuración:
   - **Name**: `luminance-estetica-db`
   - **Database**: `luminance_estetica`
   - **User**: `luminance_user` (auto-generado)
   - **Region**: Oregon (USA) o el más cercano
   - **Plan**: **Free** (para testing)
3. Click "Create Database"
4. Espera 2-3 minutos
5. **Copia la "Internal Database URL"** → Empieza con `postgresql://`

**Ejemplo**:
```
postgresql://luminance_user:xxxxx@dpg-xxxxx.oregon-postgres.render.com/luminance_estetica
```

### 3. Crear Web Service (API)

1. Dashboard → "New" → "Web Service"
2. Connect tu repositorio de GitHub
3. Configuración:
   - **Name**: `luminance-estetica-api`
   - **Region**: **Mismo que la base de datos** (Oregon)
   - **Branch**: `main`
   - **Root Directory**: *(dejar vacío)*
   - **Environment**: **Python 3**
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: **Free** (para testing)

4. **Variables de Entorno**:
   
   Click "Advanced" → "Add Environment Variable" y agrega:

   ```bash
   # DATABASE
   DATABASE_URL=[pega la Internal Database URL de arriba]
   
   # SECURITY
   SECRET_KEY=[genera con: openssl rand -hex 32]
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   
   # EMAIL
   EMAIL_SERVICE=sendgrid
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxx
   FROM_EMAIL=noreply@luminancestudio.com
   FROM_NAME=Luminance Studio by Cande
   STUDIO_EMAIL=info@luminancestudio.com
   ADMIN_EMAIL=cande@luminancestudio.com
   
   # MERCADOPAGO (usar credenciales de TEST primero)
   MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxx
   MERCADOPAGO_PUBLIC_KEY=TEST-xxxxxxxxxxxxxxxxx
   
   # FRONTEND URLs (actualizar después de deployar frontend)
   FRONTEND_URL=*
   PAYMENT_SUCCESS_URL=http://localhost:3000/pago-exitoso
   PAYMENT_FAILURE_URL=http://localhost:3000/pago-fallido
   PAYMENT_PENDING_URL=http://localhost:3000/pago-pendiente
   
   # CORS (actualizar después de deployar frontend)
   CORS_ORIGINS=*
   
   # BUSINESS
   TIMEZONE=America/Argentina/Buenos_Aires
   BUSINESS_HOURS_START=09:00
   BUSINESS_HOURS_END=20:00
   BUSINESS_DAYS=1,2,3,4,5,6
   MIN_APPOINTMENT_DURATION=30
   MIN_BOOKING_ADVANCE_HOURS=2
   MAX_BOOKING_ADVANCE_DAYS=30
   
   # NOTIFICATIONS
   SEND_EMAIL_REMINDERS=true
   SEND_WHATSAPP_REMINDERS=false
   REMINDER_HOURS_BEFORE=24
   
   # ADMIN INICIAL
   INITIAL_ADMIN_EMAIL=cande@luminancestudio.com
   INITIAL_ADMIN_PASSWORD=CambiarEsto123!
   INITIAL_ADMIN_NAME=Cande
   
   # RATE LIMITING
   RATE_LIMIT_PER_MINUTE=100
   RATE_LIMIT_PER_HOUR=1000
   
   # ENVIRONMENT
   ENVIRONMENT=production
   DEBUG=false
   ```

5. Click "Create Web Service"

6. **Espera 10-15 minutos** para el primer deploy

7. **Guarda la URL del backend**:
   ```
   https://luminance-estetica-api.onrender.com
   ```

### 4. Verificar que funciona

1. Visita: `https://luminance-estetica-api.onrender.com/docs`
   - Deberías ver la documentación interactiva de FastAPI

2. Prueba el endpoint de health:
   ```
   GET https://luminance-estetica-api.onrender.com/api/v1/health
   ```
   
   Debería responder:
   ```json
   {
     "status": "healthy",
     "version": "1.0.0"
   }
   ```

3. **Revisa los logs** en Render:
   - Deberías ver: `✅ Admin creado`, `✅ Horarios creados`, etc.

---

## PARTE 4: Deploy del Frontend

### Conectar HTML estático a Netlify/Vercel

#### Opción A: Netlify (Recomendado para HTML estático)

1. Ir a https://netlify.com
2. Drag & drop tu carpeta `frontend/` (con los HTML)
3. Configurar variables de entorno en Site Settings:
   ```
   API_URL=https://luminance-estetica-api.onrender.com
   MERCADOPAGO_PUBLIC_KEY=TEST-xxxxxxxxx
   ```
4. En los archivos HTML, reemplazar:
   ```javascript
   const API_URL = 'http://localhost:8000';
   ```
   Por:
   ```javascript
   const API_URL = 'https://luminance-estetica-api.onrender.com';
   ```

#### Opción B: Vercel

Similar a Netlify, pero con Vercel CLI:
```bash
npm i -g vercel
cd frontend
vercel
```

### URL del frontend
Ejemplo: `https://luminance-studio.netlify.app`

---

## PARTE 5: Configurar Webhooks de MercadoPago

### 1. Configurar URL de notificación

1. Ve a tu cuenta de MercadoPago
2. Tu cuenta → Configuración → Notificaciones
3. Agregar URL de webhook:
   ```
   https://luminance-estetica-api.onrender.com/api/v1/payments/webhook
   ```
4. Seleccionar eventos:
   - ✅ Pagos
   - ✅ Devoluciones

### 2. Probar webhook localmente (opcional)

Usa ngrok para testing local:
```bash
ngrok http 8000
# Copia la URL: https://xxxx.ngrok.io
# Configura en MercadoPago: https://xxxx.ngrok.io/api/v1/payments/webhook
```

---

## PARTE 6: Actualizar CORS y URLs

### 1. Actualizar CORS en el backend

1. Ve a Render → Tu Web Service
2. Environment → Edita `CORS_ORIGINS`
3. Cambia de `*` a:
   ```
   CORS_ORIGINS=https://luminance-studio.netlify.app,https://www.luminance-studio.netlify.app
   ```
4. Edita también `FRONTEND_URL` y `PAYMENT_*_URL`:
   ```
   FRONTEND_URL=https://luminance-studio.netlify.app
   PAYMENT_SUCCESS_URL=https://luminance-studio.netlify.app/pago-exitoso
   PAYMENT_FAILURE_URL=https://luminance-studio.netlify.app/pago-fallido
   PAYMENT_PENDING_URL=https://luminance-studio.netlify.app/pago-pendiente
   ```
5. Guarda → El servicio se redesplega automáticamente

---

## PARTE 7: Probar el Sistema Completo

### Test 1: Registro de Usuario
1. Ir al frontend → Crear cuenta
2. Verificar que llega email de bienvenida

### Test 2: Reservar Turno
1. Login con usuario creado
2. Seleccionar servicio y horario
3. Confirmar turno
4. Verificar:
   - ✅ Email de confirmación llega
   - ✅ Turno aparece en el calendario
   - ✅ Admin recibe notificación

### Test 3: Proceso de Pago
1. Reservar turno que requiere pago
2. Click "Pagar ahora"
3. Redirige a MercadoPago
4. Completar pago (usar tarjetas de prueba)
5. Verificar:
   - ✅ Redirige a página de éxito
   - ✅ Email de confirmación de pago
   - ✅ Turno marcado como "pagado"

**Tarjetas de prueba MercadoPago**:
- VISA: `4509 9535 6623 3704`
- CVV: `123`
- Vencimiento: Cualquier fecha futura
- Nombre: `APRO` (aprobada) o `OTHE` (rechazada)

### Test 4: Panel de Admin
1. Login con cuenta admin
2. Ir a `/admin` o `/dashboard`
3. Verificar que se ven:
   - ✅ Próximos turnos
   - ✅ Clientes registrados
   - ✅ Métricas de pagos

---

## 🛠 Troubleshooting

### El backend no arranca

**Síntoma**: Error 500 o "Application Error" en Render

**Solución**:
1. Revisar logs en Render → Logs
2. Errores comunes:
   - `ModuleNotFoundError`: Falta dependencia en requirements.txt
   - `Connection refused`: DATABASE_URL incorrecta
   - `No module named 'app'`: Verifica Start Command

### Los emails no se envían

**Síntoma**: Turno se crea pero no llega email

**Solución**:
1. Verificar SENDGRID_API_KEY en variables
2. Verificar que FROM_EMAIL esté verificado en SendGrid
3. Revisar logs: `❌ Error enviando email`
4. Revisar spam del destinatario

### MercadoPago no redirige

**Síntoma**: Después de pagar, no vuelve al sitio

**Solución**:
1. Verificar `PAYMENT_SUCCESS_URL` esté bien configurada
2. Verificar que incluye `https://` completo
3. Revisar logs de webhook

### CORS Error

**Síntoma**: "Access to fetch has been blocked by CORS policy"

**Solución**:
1. Verificar `CORS_ORIGINS` incluye la URL exacta del frontend
2. NO debe terminar en `/`
3. Debe ser `https://` (no `http://` en producción)
4. Esperar 2-3 min después de cambiar la variable

---

## 💰 Costos Estimados

### Plan Gratuito (Testing/Demo)
- Render Backend: **$0/mes** (sleep después de 15min inactivo)
- Render Database: **$0/mes** (90 días, luego se borra)
- Netlify Frontend: **$0/mes** (ilimitado)
- SendGrid: **$0/mes** (100 emails/día)
- MercadoPago: **$0** (credenciales de prueba)
- Twilio WhatsApp: **$0** (crédito de prueba)

**Total**: **$0/mes** (ideal para desarrollo y testing)

### Plan Producción (Recomendado)
- Render Backend: **$7/mes** (siempre activo)
- Render Database: **$7/mes** (persistente con backups)
- Netlify Frontend: **$0/mes** (gratis)
- SendGrid: **$0-15/mes** (hasta 40k emails gratis, luego $15)
- MercadoPago: **Comisión por venta** (~4.5% + IVA)
- Twilio WhatsApp: **$0.005/mensaje** (~$10/mes con 2000 mensajes)

**Total aprox**: **$14-40/mes** dependiendo del uso

---

## 🔄 Actualizar Código en Producción

```bash
# Hacer cambios locales
git add .
git commit -m "feat: nueva funcionalidad"
git push

# Render redesplega automáticamente (5-8 min)
# Netlify redesplega automáticamente (1-2 min)
```

---

## ✅ Checklist Final

Antes de considerar el proyecto en producción:

### Backend
- [ ] Base de datos creada y conectada
- [ ] Web service deployado en Render
- [ ] Todas las variables de entorno configuradas
- [ ] `/docs` funciona correctamente
- [ ] Admin inicial puede hacer login
- [ ] Logs muestran `✅ Admin creado`, `✅ Servicios creados`

### Emails
- [ ] SendGrid API key configurada
- [ ] FROM_EMAIL verificado en SendGrid
- [ ] Email de prueba llega correctamente
- [ ] Emails NO van a spam

### Frontend
- [ ] HTML deployado en Netlify/Vercel
- [ ] API_URL apunta al backend correcto
- [ ] MERCADOPAGO_PUBLIC_KEY configurada
- [ ] CORS funciona (sin errores en consola)

### Pagos
- [ ] Credenciales de MercadoPago configuradas (TEST primero)
- [ ] Webhook URL configurada en MercadoPago
- [ ] Flujo de pago funciona end-to-end
- [ ] Redirecciones post-pago funcionan

### Funcionalidad
- [ ] Registro de usuarios funciona
- [ ] Login funciona
- [ ] Listar servicios funciona
- [ ] Reservar turno funciona
- [ ] Ver turnos del usuario funciona
- [ ] Cancelar turno funciona
- [ ] Proceso de pago completo funciona

### Seguridad
- [ ] `.env` NO está en GitHub
- [ ] SECRET_KEY es única y segura
- [ ] CORS limitado a dominio específico (no `*`)
- [ ] Contraseña de admin cambiada de la default

---

## 📞 Siguiente Nivel

Una vez que todo funciona en producción:

1. **Dominio Personalizado**:
   - Comprar dominio (ej: `luminancestudio.com`)
   - Configurar en Netlify/Vercel
   - Actualizar CORS y URLs

2. **Cambiar a Credenciales de Producción**:
   - MercadoPago: Cambiar de TEST a APP_USR
   - Twilio: Plan de pago

3. **Monitoreo**:
   - Configurar Sentry para error tracking
   - Configurar Google Analytics

4. **Mejoras**:
   - Agregar recordatorios automáticos
   - Sistema de cupones
   - Programa de fidelidad
   - Dashboard de métricas

---

**¿Problemas durante el deployment?**

1. Revisar los logs primero (Render → Logs)
2. Verificar variables de entorno
3. Probar endpoints manualmente en `/docs`
4. Revisar esta guía de troubleshooting

**¡Mucha suerte con el deployment! 🚀**
