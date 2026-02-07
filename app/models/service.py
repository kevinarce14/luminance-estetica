# app/models/service.py
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Service(Base):
    """
    Modelo de Servicio - Representa los tratamientos/servicios del estudio.
    
    Ejemplos:
        - Lifting de Pestañas
        - Laminado de Cejas
        - Depilación Láser
        - Radiofrecuencia Facial
        - etc.
    
    Campos:
        - name: Nombre del servicio
        - description: Descripción detallada
        - duration_minutes: Duración en minutos
        - price: Precio en pesos argentinos (ARS)
        - category: Categoría (pestañas, cejas, laser, facial, corporal, pies)
        - is_active: Si está disponible para reservar
        - image_url: URL de imagen del servicio (opcional)
    
    Relaciones:
        - appointments: Todos los turnos que reservaron este servicio
    """
    __tablename__ = "services"
    __table_args__ = {"schema": "luminance-estetica"}
    
    # ===== CAMPOS BÁSICOS =====
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # ===== DETALLES DEL SERVICIO =====
    duration_minutes = Column(Integer, nullable=False)  # Ej: 60
    price = Column(Float, nullable=False)  # Ej: 15000.00
    
    # ===== CATEGORIZACIÓN =====
    category = Column(String(100), nullable=False, index=True)
    # Categorías posibles:
    # - "pestañas" (lifting, extensiones)
    # - "cejas" (laminado, henna, diseño)
    # - "laser" (depilación láser)
    # - "facial" (radiofrecuencia, limpieza)
    # - "corporal" (velashape, aparatología)
    # - "pies" (pedicuría)
    
    # ===== DISPONIBILIDAD =====
    is_active = Column(Boolean, default=True, nullable=False)
    
    # ===== IMAGEN (OPCIONAL) =====
    image_url = Column(String(500), nullable=True)
    
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
        back_populates="service"
    )
    
    def __repr__(self):
        return f"<Service {self.name} - ${self.price}>"
    
    @property
    def price_formatted(self):
        """Retorna el precio formateado con separador de miles"""
        return f"${self.price:,.0f}"
    
    @property
    def duration_formatted(self):
        """Retorna la duración en formato legible"""
        hours = self.duration_minutes // 60
        minutes = self.duration_minutes % 60
        
        if hours > 0 and minutes > 0:
            return f"{hours}h {minutes}min"
        elif hours > 0:
            return f"{hours}h"
        else:
            return f"{minutes}min"