# app/main.py
"""
Aplicación principal de FastAPI para Luminance Estética.

Sistema de gestión de turnos, pagos y clientes para estudio de estética.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_db, create_initial_data

# Importar todos los routers desde la carpeta routes
from app.routes import auth
from app.routes import users
from app.routes import services
from app.routes import appointments
from app.routes import payments
from app.routes import availability
from app.routes import admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle events para la aplicación.
    Se ejecutan al iniciar y cerrar la app.
    """
    # ========== STARTUP ==========
    print("=" * 60)
    print("🚀 Iniciando Luminance Estética API...")
    print("=" * 60)
    
    # Inicializar base de datos
    print("📊 Inicializando base de datos...")
    init_db()
    
    # Crear datos iniciales (admin, horarios, servicios)
    print("🔧 Creando datos iniciales...")
    await create_initial_data()
    
    print("=" * 60)
    print("✅ API lista para recibir requests")
    print(f"📖 Documentación disponible en: http://localhost:8000/docs")
    print(f"🔗 API URL: {settings.API_V1_PREFIX}")
    print("=" * 60)
    
    yield
    
    # ========== SHUTDOWN ==========
    print("\n" + "=" * 60)
    print("👋 Cerrando Luminance Estética API...")
    print("=" * 60)


# ========== CREAR APLICACIÓN ==========
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
    ## 💅 Luminance Estética API
    
    Sistema completo de gestión para estudio de estética.
    
    ### Características principales:
    
    * **Autenticación**: Registro, login, password reset con JWT
    * **Gestión de Turnos**: Reserva, cancelación, reprogramación
    * **Verificación de Disponibilidad**: Horarios en tiempo real
    * **Pagos con MercadoPago**: Checkout online integrado
    * **Notificaciones**: Emails y WhatsApp automáticos
    * **Panel de Administración**: Métricas, reportes, gestión
    
    ### Stack Tecnológico:
    
    * FastAPI + SQLAlchemy + PostgreSQL
    * SendGrid/Resend (emails)
    * Twilio (WhatsApp)
    * MercadoPago (pagos)
    
    ---
    
    **Desarrollado para:** Luminance Studio by Cande  
    **Ubicación:** Don Torcuato, Buenos Aires, Argentina
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
)


# ========== CORS MIDDLEWARE ==========
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== HEALTH CHECK ENDPOINTS ==========
@app.get("/")
def root():
    """
    Endpoint raíz - Health check básico.
    
    Retorna información básica de la API.
    """
    return {
        "message": "Luminance Estética API",
        "version": settings.APP_VERSION,
        "status": "active",
        "docs": "/docs",
        "api_prefix": settings.API_V1_PREFIX,
        "environment": settings.ENVIRONMENT,
    }


@app.get(f"{settings.API_V1_PREFIX}/health")
def health_check():
    """
    Health check detallado para monitoring.
    
    Útil para verificar que la API está funcionando correctamente.
    """
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
        "services": {
            "database": "connected",
            "email": settings.EMAIL_SERVICE,
            "payments": "mercadopago",
        }
    }


@app.get(f"{settings.API_V1_PREFIX}/info")
def api_info():
    """
    Información detallada de la API.
    
    Muestra configuración y servicios disponibles.
    """
    return {
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "timezone": settings.TIMEZONE,
        "business_hours": {
            "start": settings.BUSINESS_HOURS_START,
            "end": settings.BUSINESS_HOURS_END,
            "days": settings.business_days_list,
        },
        "booking_rules": {
            "min_advance_hours": settings.MIN_BOOKING_ADVANCE_HOURS,
            "max_advance_days": settings.MAX_BOOKING_ADVANCE_DAYS,
            "min_appointment_duration": settings.MIN_APPOINTMENT_DURATION,
        },
        "services": {
            "email": {
                "provider": settings.EMAIL_SERVICE,
                "reminders_enabled": settings.SEND_EMAIL_REMINDERS,
            },
            "whatsapp": {
                "enabled": bool(settings.TWILIO_ACCOUNT_SID),
                "reminders_enabled": settings.SEND_WHATSAPP_REMINDERS,
            },
            "payments": {
                "provider": "mercadopago",
                "currency": "ARS",
            }
        },
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "openapi": f"{settings.API_V1_PREFIX}/openapi.json",
        }
    }


# ========== INCLUIR ROUTERS ==========

# Autenticación
app.include_router(
    auth.router,
    prefix=settings.API_V1_PREFIX,
    tags=["🔐 Autenticación"]
)

# Usuarios
app.include_router(
    users.router,
    prefix=settings.API_V1_PREFIX,
    tags=["👥 Usuarios"]
)

# Servicios del studio
app.include_router(
    services.router,
    prefix=settings.API_V1_PREFIX,
    tags=["💅 Servicios"]
)

# Turnos/Citas
app.include_router(
    appointments.router,
    prefix=settings.API_V1_PREFIX,
    tags=["📅 Turnos/Citas"]
)

# Pagos
app.include_router(
    payments.router,
    prefix=settings.API_V1_PREFIX,
    tags=["💳 Pagos"]
)

# Disponibilidad
app.include_router(
    availability.router,
    prefix=settings.API_V1_PREFIX,
    tags=["🕐 Disponibilidad"]
)

# Administración
app.include_router(
    admin.router,
    prefix=settings.API_V1_PREFIX,
    tags=["⚙️ Administración"]
)


# ========== ERROR HANDLERS ==========

@app.exception_handler(404)
async def not_found_handler(request, exc):
    """Handler para errores 404"""
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not Found",
            "message": "El endpoint solicitado no existe",
            "path": str(request.url),
            "suggestion": "Visita /docs para ver todos los endpoints disponibles"
        }
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """Handler para errores 500"""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "Ocurrió un error interno en el servidor",
            "suggestion": "Por favor contacta al administrador si el problema persiste"
        }
    )


# ========== MAIN (para desarrollo local) ==========
if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "=" * 60)
    print("🚀 Iniciando servidor de desarrollo...")
    print("=" * 60)
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )