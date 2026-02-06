# 🚀 INICIO RÁPIDO - Luminance Estética Backend

## 📦 Lo que acabas de recibir

Un backend profesional en FastAPI para el sistema de gestión de **Luminance Studio by Cande** con:

- ✅ Sistema de turnos/citas
- ✅ Integración con MercadoPago
- ✅ Emails automáticos (SendGrid/Resend)
- ✅ Notificaciones WhatsApp (Twilio)
- ✅ Panel de administración
- ✅ Autenticación JWT
- ✅ Base de datos PostgreSQL

## 🎯 3 Archivos Clave para Empezar

1. **`README.md`** → Documentación completa del proyecto
2. **`PROJECT_GUIDE.md`** → Guía de desarrollo y archivos faltantes
3. **`DEPLOYMENT.md`** → Deploy paso a paso a producción

## ⚡ Instalación Ultra-Rápida (5 minutos)

```bash
# 1. Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Mac/Linux
# o
venv\Scripts\activate  # Windows

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 4. Crear base de datos PostgreSQL
createdb luminance_estetica

# 5. Iniciar servidor
uvicorn app.main:app --reload
```

Abre: http://localhost:8000/docs

## 📁 Estructura del Proyecto

```
luminance-estetica-backend/
├── README.md                    ⭐ LEE ESTO PRIMERO
├── PROJECT_GUIDE.md             ⭐ GUÍA DE DESARROLLO
├── DEPLOYMENT.md                ⭐ GUÍA DE DEPLOY
├── .env.example                 → Copiar a .env
├── requirements.txt             → Dependencias Python
├── app/
│   ├── main.py                  ✅ App principal (ya creado)
│   ├── core/
│   │   ├── config.py            ✅ Configuración (ya creado)
│   │   ├── security.py          ✅ JWT y auth (ya creado)
│   │   └── database.py          ✅ PostgreSQL (ya creado)
│   ├── models/                  ⚠️  Crear modelos aquí
│   ├── schemas/                 ⚠️  Crear schemas aquí
│   ├── api/v1/                  ⚠️  Crear endpoints aquí
│   └── services/                ⚠️  Crear servicios aquí
```

## 🔨 Lo que falta hacer

El proyecto tiene la **estructura completa** y los **archivos core**, pero faltan:

### 1. Modelos (Base de Datos)
- `app/models/user.py`
- `app/models/appointment.py`
- `app/models/service.py`
- `app/models/payment.py`
- `app/models/availability.py`

### 2. Schemas (Validación)
- `app/schemas/user.py`
- `app/schemas/appointment.py`
- `app/schemas/service.py`
- `app/schemas/auth.py`

### 3. Endpoints (API)
- `app/api/v1/auth.py`
- `app/api/v1/appointments.py`
- `app/api/v1/services.py`
- `app/api/v1/payments.py`

### 4. Servicios (Lógica)
- `app/services/email_service.py` *(copiar de Mentum Media)*
- `app/services/payment_service.py`

**Ver `PROJECT_GUIDE.md` para ejemplos de código completos de cada archivo.**

## 🎓 Si es tu primer proyecto con FastAPI

1. Lee `README.md` para entender qué hace el proyecto
2. Mira `app/core/` para ver cómo está configurado
3. Lee `PROJECT_GUIDE.md` sección "Orden de desarrollo"
4. Empieza creando los modelos (más fácil)
5. Luego schemas
6. Luego endpoints simples (GET)
7. Finalmente endpoints complejos (POST con validaciones)

## 📚 Recursos Esenciales

- **FastAPI Tutorial**: https://fastapi.tiangolo.com/tutorial/
- **SQLAlchemy ORM**: https://docs.sqlalchemy.org/en/20/
- **Proyecto Similar (Mentum Media)**: Ya lo tienes de referencia

## 🆘 Ayuda Rápida

### Error: ModuleNotFoundError
```bash
pip install -r requirements.txt
```

### Error: Database connection refused
```bash
# Asegúrate de que PostgreSQL está corriendo
# Verifica DATABASE_URL en .env
```

### Error: Can't import 'app'
```bash
# Verifica que estás en la carpeta raíz
# Verifica que existe app/__init__.py (puede estar vacío)
```

## ✅ Checklist de Progreso

- [ ] Leí el `README.md`
- [ ] Instalé las dependencias
- [ ] Configuré el `.env`
- [ ] PostgreSQL corriendo
- [ ] `uvicorn app.main:app --reload` funciona
- [ ] Vi `/docs` en el navegador
- [ ] Creé los modelos
- [ ] Creé los schemas
- [ ] Creé los endpoints básicos
- [ ] Probé con Postman/curl
- [ ] Listo para deploy 🚀

## 🎯 Próximos Pasos

1. **HOY**: Instalar y ver que corre localmente
2. **Esta semana**: Crear modelos y endpoints básicos
3. **Próxima semana**: Integrar MercadoPago y emails
4. **En 2 semanas**: Deploy a producción

---

**¿Por dónde empiezo?**

→ Abre `PROJECT_GUIDE.md` y sigue la sección "Orden de desarrollo recomendado"

**¡Mucha suerte! 🚀**
