# 📘 GUÍA DEL PROYECTO - Luminance Estética Backend

## 🎯 Resumen del Proyecto

Has recibido una estructura profesional para el backend de **Luminance Studio by Cande**, un estudio de estética que necesita:

1. **Sistema de turnos online** con calendario
2. **Procesamiento de pagos** con MercadoPago
3. **Notificaciones automáticas** por email y WhatsApp
4. **Panel de administración** para gestionar clientes y agenda

## 📦 Lo que ya tienes creado

### ✅ Archivos de Configuración
- `README.md` - Documentación completa del proyecto
- `DEPLOYMENT.md` - Guía paso a paso para deployar
- `.env.example` - Template de variables de entorno
- `requirements.txt` - Dependencias de Python
- `requirements-dev.txt` - Dependencias de desarrollo

### ✅ Core del Backend
- `app/core/config.py` - Gestión de configuración
- `app/core/security.py` - JWT, hashing de passwords
- `app/core/database.py` - Conexión a PostgreSQL
- `app/main.py` - Aplicación principal de FastAPI

## 🔨 Lo que falta completar

Para tener un backend funcional al 100%, necesitas crear estos archivos:

### 1. Modelos de Base de Datos (`app/models/`)

Cada modelo representa una tabla en PostgreSQL:

**`app/models/user.py`**
```python
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

**`app/models/appointment.py`**
```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
import enum

class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    appointment_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.PENDING)
    notes = Column(Text, nullable=True)
    reminder_sent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="appointments")
    service = relationship("Service", back_populates="appointments")
    payment = relationship("Payment", back_populates="appointment", uselist=False)
```

**`app/models/service.py`**
**`app/models/payment.py`**
**`app/models/availability.py`**
**`app/models/coupon.py`** *(opcional)*

### 2. Schemas Pydantic (`app/schemas/`)

Define la estructura de requests/responses:

**`app/schemas/user.py`**
```python
from pydantic import BaseModel, EmailStr
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: str | None = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
```

**`app/schemas/appointment.py`**
**`app/schemas/service.py`**
**`app/schemas/payment.py`**
**`app/schemas/auth.py`**

### 3. Endpoints API (`app/api/v1/`)

**`app/api/v1/auth.py`**
- POST `/auth/register` - Registro de usuario
- POST `/auth/login` - Login (retorna JWT)
- POST `/auth/password-reset` - Resetear contraseña

**`app/api/v1/appointments.py`**
- GET `/appointments` - Listar turnos del usuario
- POST `/appointments` - Crear turno
- GET `/appointments/{id}` - Ver turno específico
- PUT `/appointments/{id}` - Modificar turno
- DELETE `/appointments/{id}` - Cancelar turno
- GET `/appointments/available` - Horarios disponibles

**`app/api/v1/services.py`**
- GET `/services` - Listar servicios activos
- GET `/services/{id}` - Ver servicio
- POST `/services` - Crear servicio (admin)
- PUT `/services/{id}` - Editar servicio (admin)

**`app/api/v1/payments.py`**
- POST `/payments/create` - Crear preferencia MercadoPago
- POST `/payments/webhook` - Webhook de MercadoPago
- GET `/payments/{id}` - Ver estado de pago

**`app/api/v1/users.py`**
- GET `/users/me` - Ver perfil actual
- PUT `/users/me` - Editar perfil
- GET `/users/me/appointments` - Mis turnos

**`app/api/v1/availability.py`**
- GET `/availability` - Ver horarios disponibles
- PUT `/availability` - Modificar disponibilidad (admin)

**`app/api/v1/admin.py`**
- GET `/admin/dashboard` - Métricas
- GET `/admin/appointments` - Todos los turnos
- GET `/admin/users` - Todos los clientes
- GET `/admin/reports` - Reportes

### 4. Servicios (`app/services/`)

**`app/services/email_service.py`** *(similar al de Mentum Media)*
- Envío de emails con SendGrid/Resend
- Templates para confirmación, recordatorio, cancelación

**`app/services/payment_service.py`**
```python
import mercadopago

class PaymentService:
    def __init__(self):
        self.sdk = mercadopago.SDK(settings.MERCADOPAGO_ACCESS_TOKEN)
    
    def create_preference(self, appointment_id, amount, title):
        preference_data = {
            "items": [{
                "title": title,
                "quantity": 1,
                "unit_price": float(amount)
            }],
            "back_urls": {
                "success": settings.PAYMENT_SUCCESS_URL,
                "failure": settings.PAYMENT_FAILURE_URL,
                "pending": settings.PAYMENT_PENDING_URL
            },
            "external_reference": str(appointment_id)
        }
        preference = self.sdk.preference().create(preference_data)
        return preference["response"]
```

**`app/services/whatsapp_service.py`**
**`app/services/appointment_service.py`**
**`app/services/notification_service.py`**

### 5. Dependencias (`app/api/deps.py`)

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    payload = decode_access_token(token)
    email = payload.get("sub")
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido"
        )
    
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    return user

def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos de administrador"
        )
    return current_user
```

### 6. __init__.py Files

Crear archivos vacíos `__init__.py` en cada carpeta para que Python las reconozca como módulos:

```bash
touch app/__init__.py
touch app/core/__init__.py
touch app/models/__init__.py
touch app/schemas/__init__.py
touch app/api/__init__.py
touch app/api/v1/__init__.py
touch app/services/__init__.py
touch app/utils/__init__.py
touch app/middleware/__init__.py
```

### 7. Otros Archivos Necesarios

**`.gitignore`**
```
__pycache__/
*.py[cod]
*$py.class
.env
.env.local
venv/
env/
.vscode/
.idea/
*.sqlite
*.db
alembic/versions/*.py
!alembic/versions/__init__.py
```

**`runtime.txt`** *(para Render)*
```
python-3.11.6
```

**`alembic.ini`** *(para migraciones de BD)*

## 🚀 Cómo empezar a desarrollar

### 1. Setup Local

```bash
# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# o
venv\Scripts\activate  # Windows

# Instalar dependencias
pip install -r requirements.txt

# Copiar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Crear base de datos
createdb luminance_estetica

# Iniciar servidor
uvicorn app.main:app --reload
```

### 2. Orden de desarrollo recomendado

1. **Modelos** → Define la estructura de datos
2. **Schemas** → Define la validación de requests/responses
3. **Services** → Lógica de negocio (emails, pagos)
4. **Dependencies** → get_current_user, get_db
5. **Endpoints** → Rutas de la API
6. **Testing** → Pruebas unitarias

### 3. Probar con Postman/Thunder Client

1. POST `/api/v1/auth/register` - Crear usuario
2. POST `/api/v1/auth/login` - Obtener token
3. GET `/api/v1/services` - Ver servicios
4. POST `/api/v1/appointments` - Crear turno (con token)

## 📚 Recursos Útiles

- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **SQLAlchemy Tutorial**: https://docs.sqlalchemy.org/
- **Pydantic Docs**: https://docs.pydantic.dev/
- **MercadoPago API**: https://www.mercadopago.com.ar/developers/
- **SendGrid API**: https://docs.sendgrid.com/
- **Twilio WhatsApp**: https://www.twilio.com/docs/whatsapp

## 🎯 Prioridades

### MVP (Versión Mínima Viable)

1. ✅ Autenticación (register/login)
2. ✅ CRUD de servicios
3. ✅ CRUD de turnos
4. ✅ Integración MercadoPago básica
5. ✅ Emails de confirmación

### Versión 1.1

6. WhatsApp notifications
7. Recordatorios automáticos
8. Panel de admin
9. Reportes básicos

### Versión 2.0

10. Sistema de cupones
11. Puntos de fidelidad
12. Analytics avanzados
13. App móvil

## 💡 Tips de Desarrollo

1. **Usa `/docs`** - FastAPI genera documentación automática
2. **Testea cada endpoint** antes de pasar al siguiente
3. **Commits frecuentes** - Git commit después de cada feature
4. **Logs útiles** - Usa `print()` o `logging` para debuggear
5. **Prueba con datos reales** - Usa tus propios emails y WhatsApp para probar

## 🆘 ¿Necesitas Ayuda?

Si te atascas:

1. Revisa los archivos que ya están creados (config.py, security.py, database.py)
2. Busca en la documentación oficial de FastAPI
3. Usa los ejemplos del proyecto Mentum Media como referencia
4. Pregunta específicamente sobre la parte que no entiendes

## ✅ Checklist de Progreso

- [ ] Entorno virtual creado
- [ ] Dependencias instaladas
- [ ] .env configurado
- [ ] PostgreSQL corriendo
- [ ] Modelos creados
- [ ] Schemas creados
- [ ] Servicio de email funcionando
- [ ] Auth endpoints (register/login)
- [ ] Services endpoints
- [ ] Appointments endpoints
- [ ] Payments integración básica
- [ ] Probado localmente
- [ ] Deployed a Render
- [ ] Frontend conectado
- [ ] Flujo completo funcionando

---

**¡Éxito con el desarrollo! 🚀**

Tienes una base sólida. Ahora solo hay que completar los archivos faltantes siguiendo los patrones establecidos.
