# app/schemas/appointment.py
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional

from app.core.time_utils import to_utc, to_utc_optional, utc_now
from app.models.appointment import AppointmentStatus
from app.schemas.user import UserContact, UserPublic
from app.schemas.service import ServicePublic
from app.schemas.payment import PaymentResponse


def _ensure_future(value: datetime) -> datetime:
    """Normaliza a UTC y valida que la fecha sea futura (solo para datos de entrada)."""
    value = to_utc(value)
    if value < utc_now():
        raise ValueError('La fecha del turno debe ser en el futuro')
    return value


class AppointmentBase(BaseModel):
    """
    Schema base de Turno/Cita con campos comunes.

    No valida que la fecha sea futura: esa regla aplica solo al crear o
    reprogramar (AppointmentCreate / AppointmentUpdate). Las respuestas
    deben poder serializar turnos pasados (historial, completados, etc.).
    """
    service_id: int = Field(..., gt=0)
    appointment_date: datetime
    notes: Optional[str] = Field(None, max_length=1000)


class AppointmentCreate(AppointmentBase):
    """
    Schema para crear un turno.

    Requiere:
        - service_id: ID del servicio a reservar
        - appointment_date: Fecha y hora del turno, futura (puede ser naive o aware)
        - notes: Notas adicionales (opcional)

    El user_id se obtiene del token JWT (usuario autenticado).
    """

    @field_validator('appointment_date')
    @classmethod
    def validate_future_date(cls, v: datetime) -> datetime:
        return _ensure_future(v)


class AppointmentUpdate(BaseModel):
    """
    Schema para actualizar un turno.
    Permite reprogramar (fecha futura), modificar notas o, si es admin, cambiar el estado.
    """
    appointment_date: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[AppointmentStatus] = None
    cancellation_reason: Optional[str] = Field(None, max_length=500)

    @field_validator('appointment_date')
    @classmethod
    def validate_future_date(cls, v: Optional[datetime]) -> Optional[datetime]:
        return None if v is None else _ensure_future(v)

    @field_validator('status', mode='before')
    @classmethod
    def normalize_status(cls, v: Optional[str]) -> Optional[str]:
        """Acepta el estado en cualquier capitalización."""
        return v.lower() if isinstance(v, str) else v


class AppointmentResponse(AppointmentBase):
    """
    Schema de respuesta básico de Turno.
    Las fechas se exponen en UTC con offset (en la BD se guardan naive en UTC).
    """
    id: int
    user_id: int
    status: AppointmentStatus
    reminder_sent: bool
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    @field_validator('appointment_date', 'created_at')
    @classmethod
    def as_utc(cls, v: datetime) -> datetime:
        return to_utc(v)

    @field_validator('cancelled_at', 'updated_at')
    @classmethod
    def as_utc_optional(cls, v: Optional[datetime]) -> Optional[datetime]:
        return to_utc_optional(v)

    class Config:
        from_attributes = True


class AppointmentWithDetails(AppointmentResponse):
    """
    Schema de respuesta completo de Turno.
    Incluye información del usuario, servicio y pago.
    """
    user: UserPublic
    service: ServicePublic
    payment: Optional[PaymentResponse] = None

    class Config:
        from_attributes = True


class AppointmentAdminView(AppointmentResponse):
    """
    Turno para el panel de administración: incluye el contacto del cliente
    (email y teléfono) para la agenda y el buscador.
    """
    user: UserContact
    service: ServicePublic
    payment: Optional[PaymentResponse] = None

    class Config:
        from_attributes = True


class PublicBookedSlot(BaseModel):
    """
    Horario ocupado por un turno confirmado (endpoint público de la turnera).
    No expone datos del cliente.
    """
    appointment_date: datetime
    duration_minutes: int

    @field_validator('appointment_date')
    @classmethod
    def as_utc(cls, v: datetime) -> datetime:
        return to_utc(v)


class AppointmentCancel(BaseModel):
    """
    Schema para cancelar un turno.
    """
    cancellation_reason: str = Field(..., min_length=5, max_length=500)

    class Config:
        json_schema_extra = {
            "example": {
                "cancellation_reason": "Surgió un imprevisto y no podré asistir"
            }
        }
