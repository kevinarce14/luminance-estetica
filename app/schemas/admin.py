# app/schemas/admin.py
"""
Schemas de respuesta del panel de administración: pagos, clientes y reportes.
"""

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, field_validator

from app.core.time_utils import to_utc
from app.models.appointment import AppointmentStatus
from app.schemas.payment import PaymentResponse
from app.schemas.service import ServicePublic
from app.schemas.user import UserContact


class AppointmentBrief(BaseModel):
    """Resumen del turno asociado a un pago."""
    id: int
    appointment_date: datetime
    status: AppointmentStatus
    service: ServicePublic

    @field_validator('appointment_date')
    @classmethod
    def as_utc(cls, v: datetime) -> datetime:
        return to_utc(v)

    class Config:
        from_attributes = True


class PaymentAdminView(PaymentResponse):
    """Pago con el cliente y el turno, para la vista de pagos del panel."""
    user: UserContact
    appointment: AppointmentBrief

    class Config:
        from_attributes = True


class ClientSummary(UserContact):
    """Cliente con métricas de su historial."""
    is_active: bool
    created_at: datetime
    appointments_count: int = 0
    completed_count: int = 0
    cancelled_count: int = 0
    last_appointment_date: Optional[datetime] = None
    total_paid: float = 0

    @field_validator('last_appointment_date')
    @classmethod
    def as_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        return None if v is None else to_utc(v)


class MonthSummary(BaseModel):
    month: int
    revenue: float
    payments_count: int
    appointments_count: int
    completed_count: int
    cancelled_count: int


class ServiceRanking(BaseModel):
    name: str
    appointments_count: int
    revenue: float


class PaymentMethodSummary(BaseModel):
    method: str
    count: int
    amount: float


class YearlyReport(BaseModel):
    """Reporte anual: ingresos y turnos por mes, servicios más demandados y medios de pago."""
    year: int
    currency: str = "ARS"
    total_revenue: float
    total_payments: int
    average_ticket: float
    total_appointments: int
    appointments_by_status: Dict[str, int]
    new_clients: int
    months: List[MonthSummary]
    top_services: List[ServiceRanking]
    payment_methods: List[PaymentMethodSummary]
