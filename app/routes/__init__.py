# app/routes/__init__.py
"""
Endpoints de la API.
Cada archivo representa un conjunto de rutas relacionadas.
"""

from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.services import router as services_router
from app.routes.appointments import router as appointments_router
from app.routes.payments import router as payments_router
from app.routes.availability import router as availability_router
from app.routes.admin import router as admin_router

__all__ = [
    "auth_router",
    "users_router",
    "services_router",
    "appointments_router",
    "payments_router",
    "availability_router",
    "admin_router",
]