# app/models/user.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    """
    Modelo de Usuario - Representa tanto clientes como administradores.
    
    Campos:
        - email: Email único para login
        - full_name: Nombre completo del usuario
        - phone: Teléfono de contacto (opcional)
        - hashed_password: Contraseña hasheada con bcrypt
        - is_active: Si el usuario está activo (puede hacer login)
        - is_admin: Si es administrador (acceso al panel admin)
        - created_at: Fecha de registro
        - updated_at: Última actualización del perfil
    
    Relaciones:
        - appointments: Todos los turnos del usuario
        - payments: Todos los pagos del usuario
    """
    __tablename__ = "users"
    
    # ===== CAMPOS BÁSICOS =====
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    
    # ===== AUTENTICACIÓN =====
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    
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
    
    # ===== RELACIONES =====
    appointments = relationship(
        "Appointment",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    
    payments = relationship(
        "Payment",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<User {self.email}>"
    
    @property
    def is_authenticated(self):
        """Helper para verificar si el usuario está autenticado"""
        return self.is_active