# app/schemas/appointment.py
from pydantic import BaseModel, Field, field_validator, validator
from datetime import datetime, timezone
from typing import Optional

from app.schemas.user import UserPublic
from app.schemas.service import ServicePublic
from app.schemas.payment import PaymentResponse


class AppointmentBase(BaseModel):
    """Schema base de Turno/Cita con campos comunes"""
    service_id: int = Field(..., gt=0)
    appointment_date: datetime
    notes: Optional[str] = Field(None, max_length=1000)
    
    @validator('appointment_date')
    def validate_future_date(cls, v):
        # Obtener ahora con timezone UTC
        now = datetime.now(timezone.utc)
        
        # Si v no tiene timezone, agregar UTC
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        
        # Ahora podemos comparar
        if v < now:
            raise ValueError('La fecha del turno debe ser en el futuro')
        return v


class AppointmentCreate(AppointmentBase):
    """
    Schema para crear un turno.
    
    Requiere:
        - service_id: ID del servicio a reservar
        - appointment_date: Fecha y hora del turno
        - notes: Notas adicionales (opcional)
    
    El user_id se obtiene del token JWT (usuario autenticado).
    """
    pass


class AppointmentUpdate(BaseModel):
    """
    Schema para actualizar un turno.
    Permite modificar fecha, notas o cancelar.
    """
    appointment_date: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[str] = None  # "pending", "confirmed", "completed", "cancelled"
    cancellation_reason: Optional[str] = Field(None, max_length=500)
    
    @field_validator('appointment_date')
    @classmethod
    def validate_future_date(cls, v):
        """Valida que la fecha sea futura, manejando timezones"""
        
        # Obtener ahora con timezone UTC
        now = datetime.now(timezone.utc)
        
        # Si v no tiene timezone, agregar UTC
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        
        # Ahora podemos comparar
        if v < now:
            raise ValueError('La fecha del turno debe ser futura')
        
        return v
    
    @validator('status')
    def validate_status(cls, v):
        """Valida que el estado sea válido"""
        if v:
            allowed_statuses = ['pending', 'confirmed', 'completed', 'cancelled']
            if v.lower() not in allowed_statuses:
                raise ValueError(
                    f'Estado no válido. Debe ser uno de: {", ".join(allowed_statuses)}'
                )
            return v.lower()
        return v


class AppointmentResponse(AppointmentBase):
    """
    Schema de respuesta básico de Turno.
    """
    id: int
    user_id: int
    status: str
    reminder_sent: bool
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
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