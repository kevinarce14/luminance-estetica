# app/schemas/payment.py
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Literal, Optional, Any

from app.models.payment import PaymentStatus


class PaymentBase(BaseModel):
    """Schema base de Pago con campos comunes"""
    amount: float = Field(..., gt=0)
    currency: str = Field(default="ARS", max_length=10)


class PaymentCreate(PaymentBase):
    """
    Schema para crear/iniciar un pago.
    
    Requiere:
        - appointment_id: ID del turno a pagar
        - amount: Monto a pagar
        - currency: Moneda (por defecto ARS)
    """
    appointment_id: int = Field(..., gt=0)
    payment_method: str = Field(default="mercadopago")
    
    class Config:
        json_schema_extra = {
            "example": {
                "appointment_id": 1,
                "amount": 15000.00,
                "currency": "ARS",
                "payment_method": "mercadopago"
            }
        }


class PaymentResponse(PaymentBase):
    """
    Schema de respuesta de Pago.
    """
    id: int
    appointment_id: int
    user_id: int
    payment_method: str
    status: str
    mercadopago_id: Optional[str] = None
    mercadopago_preference_id: Optional[str] = None
    transaction_id: Optional[str] = None
    payment_details: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class MercadoPagoPreference(BaseModel):
    """
    Schema de respuesta al crear una preferencia de MercadoPago.
    Contiene la URL de checkout y el ID de preferencia.
    """
    preference_id: str
    init_point: str  # URL de checkout web
    sandbox_init_point: Optional[str] = None  # URL de checkout sandbox (testing)
    
    class Config:
        json_schema_extra = {
            "example": {
                "preference_id": "123456789-abcd-1234-5678-123456789abc",
                "init_point": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789",
                "sandbox_init_point": "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789"
            }
        }


class MercadoPagoWebhook(BaseModel):
    """
    Schema para el webhook de MercadoPago.
    MercadoPago envía este payload cuando cambia el estado de un pago.
    
    Documentación: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
    """
    id: Optional[int] = None  # ID de la notificación
    live_mode: bool = True  # Si es producción (True) o testing (False)
    type: str  # Tipo de notificación: "payment", "plan", "subscription", etc.
    date_created: Optional[str] = None  # Fecha de creación
    application_id: Optional[int] = None  # ID de la aplicación
    user_id: Optional[int] = None  # ID del usuario de MercadoPago
    version: Optional[int] = None  # Versión de la API
    api_version: Optional[str] = None  # Versión de la API
    action: Optional[str] = None  # Acción: "payment.created", "payment.updated", etc.
    data: Optional[dict[str, Any]] = None  # Datos del pago
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": 12345678,
                "live_mode": True,
                "type": "payment",
                "date_created": "2024-02-06T10:30:00Z",
                "action": "payment.updated",
                "data": {
                    "id": "1234567890"
                }
            }
        }


class PaymentStatusUpdate(BaseModel):
    """
    Schema para actualizar el estado de un pago manualmente (admin).
    Transiciones válidas: pending → approved | rejected | cancelled; approved → refunded.
    """
    status: PaymentStatus
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator('status', mode='before')
    @classmethod
    def normalize_status(cls, v):
        return v.lower() if isinstance(v, str) else v
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "approved",
                "notes": "Pago confirmado por transferencia bancaria"
            }
        }


class ManualPaymentRequest(BaseModel):
    """
    Registrar un pago manual aprobado por el admin (efectivo en el estudio o transferencia).
    Confirma el turno asociado.
    """
    appointment_id: int = Field(..., gt=0)
    payment_method: Literal["cash", "transfer"] = "cash"
    reference: Optional[str] = Field(None, max_length=255, description="Nro. de operación / comprobante")
    notes: Optional[str] = Field(None, max_length=500)
