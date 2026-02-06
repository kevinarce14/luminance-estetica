# app/models/__init__.py
"""
Modelos de la base de datos.
Importar todos los modelos aquí para que Alembic los detecte.
"""

from app.models.user import User
from app.models.service import Service
from app.models.appointment import Appointment
from app.models.payment import Payment
from app.models.availability import Availability
from app.models.coupon import Coupon

__all__ = [
    "User",
    "Service",
    "Appointment",
    "Payment",
    "Availability",
    "Coupon",
]