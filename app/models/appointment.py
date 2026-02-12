# app/models/appointment.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class AppointmentStatus(str, enum.Enum):
    """
    Estados posibles de un turno.
    
    - PENDING: Turno reservado, esperando confirmación/pago
    - CONFIRMED: Turno confirmado (pagado o confirmado por admin)
    - COMPLETED: Turno completado (el servicio ya se realizó)
    - CANCELLED: Turno cancelado (por cliente o admin)
    """
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Appointment(Base):
    """
    Modelo de Turno/Cita - Representa una reserva de servicio.
    
    Flujo típico:
        1. Cliente reserva → status = PENDING
        2. Cliente paga → status = CONFIRMED
        3. Se realiza el servicio → status = COMPLETED
        4. (Opcional) Se cancela → status = CANCELLED
    
    Campos:
        - user_id: ID del cliente que reservó
        - service_id: ID del servicio reservado
        - appointment_date: Fecha y hora del turno (UTC, sin timezone en BD)
        - status: Estado actual (pending, confirmed, completed, cancelled)
        - notes: Notas adicionales del cliente
        - reminder_sent: Si ya se envió recordatorio automático
        - cancelled_at: Fecha de cancelación (si aplica)
        - cancellation_reason: Motivo de cancelación
    
    Relaciones:
        - user: Cliente que reservó
        - service: Servicio reservado
        - payment: Pago asociado (si aplica)
    """
    __tablename__ = "appointments"
    __table_args__ = {"schema": "luminance-estetica"}
    
    # ===== CAMPOS BÁSICOS =====
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False, index=True)
    
    # ===== FECHA Y HORA =====
    # ✅ CORRECCIÓN: Usar timezone=False (naive datetime)
    # Guardamos fechas en UTC pero sin timezone info en la BD
    appointment_date = Column(
        DateTime(timezone=False),  # ✅ Cambiado de True a False
        nullable=False,
        index=True
    )
    
    # ===== ESTADO =====
    status = Column(
        Enum(AppointmentStatus),
        default=AppointmentStatus.PENDING,
        nullable=False,
        index=True
    )
    
    # ===== NOTAS Y OBSERVACIONES =====
    notes = Column(Text, nullable=True)
    # Ejemplo: "Soy alérgica a X producto", "Primera vez", etc.
    
    # ===== NOTIFICACIONES =====
    reminder_sent = Column(Boolean, default=False, nullable=False)
    # Se marca True cuando se envía el recordatorio automático 24h antes
    
    # ===== CANCELACIÓN =====
    # ✅ CORRECCIÓN: También usar timezone=False para consistencia
    cancelled_at = Column(DateTime(timezone=False), nullable=True)  # ✅ Cambiado
    cancellation_reason = Column(Text, nullable=True)
    # Ejemplo: "Cambio de planes", "Enfermedad", "Cambio de horario", etc.
    
    # ===== TIMESTAMPS =====
    # ✅ CORRECCIÓN: Usar timezone=False
    created_at = Column(
        DateTime(timezone=False),  # ✅ Cambiado
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=False),  # ✅ Cambiado
        onupdate=func.now(),
        nullable=True
    )
    
    # ===== RELACIONES =====
    user = relationship("User", back_populates="appointments")
    service = relationship("Service", back_populates="appointments")
    payment = relationship(
        "Payment",
        back_populates="appointment",
        uselist=False  # One-to-one: un turno tiene máximo un pago
    )
    
    def __repr__(self):
        return f"<Appointment {self.id} - {self.status.value}>"
    
    @property
    def is_active(self):
        """Retorna True si el turno está activo (no cancelado ni completado)"""
        return self.status in [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]
    
    @property
    def can_be_cancelled(self):
        """Retorna True si el turno puede ser cancelado"""
        return self.status in [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]
    
    @property
    def requires_payment(self):
        """Retorna True si el turno requiere pago"""
        # Podrías agregar lógica aquí, ej: algunos servicios requieren seña
        # Por ahora, asumimos que todos los turnos pueden requerir pago
        return self.status == AppointmentStatus.PENDING