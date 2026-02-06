# app/models/availability.py
from sqlalchemy import Column, Integer, Time, Boolean, Date, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class Availability(Base):
    """
    Modelo de Disponibilidad - Define los horarios de atención del estudio.
    
    Hay dos tipos de disponibilidad:
    
    1. **Disponibilidad Regular** (por día de la semana):
       - Define horarios fijos para cada día de la semana
       - Ejemplo: Martes a Sábado de 9:00 a 20:00
       - day_of_week: 0=Lunes, 1=Martes, ..., 6=Domingo
       - specific_date: NULL
    
    2. **Disponibilidad Específica** (excepciones/bloqueos):
       - Define horarios para fechas específicas
       - Ejemplo: 24 de diciembre cerrado, 31 de diciembre hasta las 14:00
       - day_of_week: NULL
       - specific_date: fecha específica
    
    Campos:
        - day_of_week: Día de la semana (0-6) para horarios regulares
        - specific_date: Fecha específica para excepciones
        - start_time: Hora de inicio
        - end_time: Hora de fin
        - is_available: Si está disponible o bloqueado
    
    Ejemplos de uso:
        # Horario regular de Martes
        day_of_week=1, start_time=09:00, end_time=20:00, is_available=True
        
        # Bloquear el 25 de diciembre (Navidad)
        specific_date=2024-12-25, is_available=False
        
        # Horario especial para 31 de diciembre
        specific_date=2024-12-31, start_time=09:00, end_time=14:00, is_available=True
    """
    __tablename__ = "availability"
    
    # ===== CAMPOS BÁSICOS =====
    id = Column(Integer, primary_key=True, index=True)
    
    # ===== DÍA DE LA SEMANA (para horarios regulares) =====
    day_of_week = Column(Integer, nullable=True, index=True)
    # 0 = Lunes
    # 1 = Martes
    # 2 = Miércoles
    # 3 = Jueves
    # 4 = Viernes
    # 5 = Sábado
    # 6 = Domingo
    # NULL = No es horario regular (ver specific_date)
    
    # ===== FECHA ESPECÍFICA (para excepciones) =====
    specific_date = Column(Date, nullable=True, index=True)
    # Ejemplo: 2024-12-25 para Navidad
    # NULL = No es excepción (ver day_of_week)
    
    # ===== HORARIOS =====
    start_time = Column(Time, nullable=True)
    # Hora de inicio. Ejemplo: 09:00
    # NULL = Todo el día bloqueado (si is_available=False)
    
    end_time = Column(Time, nullable=True)
    # Hora de fin. Ejemplo: 20:00
    # NULL = Todo el día bloqueado (si is_available=False)
    
    # ===== DISPONIBILIDAD =====
    is_available = Column(Boolean, default=True, nullable=False)
    # True = Disponible para reservar
    # False = Bloqueado (feriado, vacaciones, etc.)
    
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
    
    def __repr__(self):
        if self.specific_date:
            return f"<Availability {self.specific_date} - {'Available' if self.is_available else 'Blocked'}>"
        else:
            day_names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
            day_name = day_names[self.day_of_week] if self.day_of_week is not None else "Unknown"
            return f"<Availability {day_name} {self.start_time}-{self.end_time}>"
    
    @property
    def is_regular_schedule(self):
        """Retorna True si es un horario regular (no una excepción)"""
        return self.day_of_week is not None and self.specific_date is None
    
    @property
    def is_exception(self):
        """Retorna True si es una excepción (fecha específica)"""
        return self.specific_date is not None
    
    @property
    def time_range_formatted(self):
        """Retorna el rango de horario formateado"""
        if not self.is_available:
            return "CERRADO"
        
        if self.start_time and self.end_time:
            return f"{self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')}"
        
        return "No definido"