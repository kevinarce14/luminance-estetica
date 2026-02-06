# app/models/payment.py
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class PaymentStatus(str, enum.Enum):
    """
    Estados posibles de un pago.
    
    - PENDING: Pago iniciado pero no completado
    - APPROVED: Pago aprobado y acreditado
    - REJECTED: Pago rechazado (tarjeta sin fondos, etc.)
    - CANCELLED: Pago cancelado por el usuario
    - REFUNDED: Pago devuelto/reembolsado
    """
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentMethod(str, enum.Enum):
    """
    Métodos de pago aceptados.
    
    - MERCADOPAGO: Pago online con MercadoPago
    - CASH: Efectivo en el local
    - TRANSFER: Transferencia bancaria
    - CARD_POS: Tarjeta con POS en el local
    """
    MERCADOPAGO = "mercadopago"
    CASH = "cash"
    TRANSFER = "transfer"
    CARD_POS = "card_pos"


class Payment(Base):
    """
    Modelo de Pago - Representa una transacción de pago.
    
    Flujo con MercadoPago:
        1. Cliente reserva turno
        2. Backend crea preferencia en MercadoPago
        3. Cliente paga en checkout de MercadoPago
        4. Webhook de MercadoPago notifica el pago
        5. Backend actualiza el estado del pago
        6. Backend confirma el turno
    
    Campos:
        - appointment_id: ID del turno pagado
        - user_id: ID del cliente que pagó
        - amount: Monto total pagado
        - currency: Moneda (ARS, USD, etc.)
        - payment_method: Método de pago usado
        - status: Estado actual del pago
        - mercadopago_id: ID del pago en MercadoPago
        - transaction_id: ID de transacción único
        - payment_details: Detalles adicionales del pago (JSON)
    
    Relaciones:
        - appointment: Turno asociado al pago
        - user: Cliente que realizó el pago
    """
    __tablename__ = "payments"
    
    # ===== CAMPOS BÁSICOS =====
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(
        Integer,
        ForeignKey("appointments.id"),
        nullable=False,
        unique=True,  # Un turno tiene máximo un pago
        index=True
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # ===== MONTO =====
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="ARS", nullable=False)
    # ARS = Pesos Argentinos
    # USD = Dólares
    
    # ===== MÉTODO Y ESTADO =====
    payment_method = Column(
        Enum(PaymentMethod),
        default=PaymentMethod.MERCADOPAGO,
        nullable=False
    )
    status = Column(
        Enum(PaymentStatus),
        default=PaymentStatus.PENDING,
        nullable=False,
        index=True
    )
    
    # ===== IDs DE MERCADOPAGO =====
    mercadopago_id = Column(String(255), nullable=True, index=True)
    # ID del pago en MercadoPago (viene del webhook)
    
    mercadopago_preference_id = Column(String(255), nullable=True)
    # ID de la preferencia creada en MercadoPago
    
    transaction_id = Column(String(255), nullable=True, unique=True)
    # ID único de transacción (generado por nosotros o por MercadoPago)
    
    # ===== DETALLES ADICIONALES =====
    payment_details = Column(Text, nullable=True)
    # JSON con detalles del pago (tipo de tarjeta, últimos 4 dígitos, etc.)
    
    error_message = Column(Text, nullable=True)
    # Mensaje de error si el pago falló
    
    # ===== TIMESTAMPS =====
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True
    )
    approved_at = Column(DateTime(timezone=True), nullable=True)
    # Fecha en que se aprobó el pago
    
    # ===== RELACIONES =====
    appointment = relationship("Appointment", back_populates="payment")
    user = relationship("User", back_populates="payments")
    
    def __repr__(self):
        return f"<Payment {self.id} - {self.status.value} - ${self.amount}>"
    
    @property
    def is_successful(self):
        """Retorna True si el pago fue exitoso"""
        return self.status == PaymentStatus.APPROVED
    
    @property
    def amount_formatted(self):
        """Retorna el monto formateado con separador de miles"""
        return f"${self.amount:,.2f} {self.currency}"
    
    @property
    def can_be_refunded(self):
        """Retorna True si el pago puede ser reembolsado"""
        return self.status == PaymentStatus.APPROVED