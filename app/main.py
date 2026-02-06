# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db, create_initial_data
from app.api.v1 import auth, appointments, services, payments, users, availability, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle events para la aplicación.
    Se ejecutan al iniciar y cerrar la app.
    """
    # Startup: Inicializar DB y crear datos iniciales
    print("🚀 Iniciando Luminance Estética API...")
    init_db()
    await create_initial_data()
    print("✅ API lista para recibir requests")
    
    yield
    
    # Shutdown
    print("👋 Cerrando Luminance Estética API...")


# Crear instancia de FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API para sistema de gestión de turnos, pagos y clientes de Luminance Studio by Cande",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# ========== CORS MIDDLEWARE ==========
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== HEALTH CHECK ==========
@app.get("/")
def root():
    """Endpoint raíz - Health check básico"""
    return {
        "message": "Luminance Estética API",
        "version": settings.APP_VERSION,
        "status": "active",
        "docs": "/docs"
    }


@app.get(f"{settings.API_V1_PREFIX}/health")
def health_check():
    """Health check detallado"""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


# ========== INCLUIR ROUTERS ==========
app.include_router(
    auth.router,
    prefix=settings.API_V1_PREFIX,
    tags=["Autenticación"]
)

app.include_router(
    appointments.router,
    prefix=settings.API_V1_PREFIX,
    tags=["Turnos/Citas"]
)

app.include_router(
    services.router,
    prefix=settings.API_V1_PREFIX,
    tags=["Servicios"]
)

app.include_router(
    payments.router,
    prefix=settings.API_V1_PREFIX,
    tags=["Pagos"]
)

app.include_router(
    users.router,
    prefix=settings.API_V1_PREFIX,
    tags=["Usuarios"]
)

app.include_router(
    availability.router,
    prefix=settings.API_V1_PREFIX,
    tags=["Disponibilidad"]
)

app.include_router(
    admin.router,
    prefix=settings.API_V1_PREFIX,
    tags=["Administración"]
)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
