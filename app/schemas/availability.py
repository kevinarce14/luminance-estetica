# app/schemas/availability.py
from pydantic import BaseModel, Field, validator
from datetime import date, time, datetime
from typing import Optional, List


class AvailabilityBase(BaseModel):
    """Schema base de Disponibilidad con campos comunes"""
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    # 0 = Lunes, 1 = Martes, ..., 6 = Domingo
    
    specific_date: Optional[date] = None
    # Para excepciones/bloqueos en fechas específicas
    
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_available: bool = True
    
    @validator('day_of_week', 'specific_date')
    def validate_day_or_date(cls, v, values):
        """Valida que se especifique day_of_week O specific_date, no ambos"""
        day_of_week = values.get('day_of_week')
        specific_date = values.get('specific_date')
        
        # Debe tener uno de los dos
        if day_of_week is None and specific_date is None:
            raise ValueError('Debe especificar day_of_week o specific_date')
        
        # No puede tener ambos
        if day_of_week is not None and specific_date is not None:
            raise ValueError('No puede especificar day_of_week y specific_date simultáneamente')
        
        return v
    
    @validator('end_time')
    def validate_time_range(cls, v, values):
        """Valida que end_time sea posterior a start_time"""
        start_time = values.get('start_time')
        if start_time and v and v <= start_time:
            raise ValueError('end_time debe ser posterior a start_time')
        return v


class AvailabilityCreate(AvailabilityBase):
    """
    Schema para crear disponibilidad.
    
    Dos tipos:
    1. Horario regular: day_of_week + start_time + end_time
       Ejemplo: Martes de 9:00 a 20:00
    
    2. Excepción/Bloqueo: specific_date + is_available
       Ejemplo: 25 de diciembre bloqueado
    """
    pass


class AvailabilityUpdate(BaseModel):
    """
    Schema para actualizar disponibilidad.
    Todos los campos son opcionales.
    """
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_available: Optional[bool] = None
    
    @validator('end_time')
    def validate_time_range(cls, v, values):
        """Valida que end_time sea posterior a start_time"""
        start_time = values.get('start_time')
        if start_time and v and v <= start_time:
            raise ValueError('end_time debe ser posterior a start_time')
        return v


class AvailabilityResponse(AvailabilityBase):
    """
    Schema de respuesta de Disponibilidad.
    """
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TimeSlot(BaseModel):
    """
    Schema de un slot de tiempo disponible.
    Usado para mostrar horarios disponibles en el calendario.
    """
    start_time: datetime
    end_time: datetime
    is_available: bool
    
    class Config:
        json_schema_extra = {
            "example": {
                "start_time": "2024-02-06T10:00:00",
                "end_time": "2024-02-06T11:00:00",
                "is_available": True
            }
        }


class AvailableSlotsRequest(BaseModel):
    """
    Schema para solicitar slots disponibles.
    
    Requiere:
        - service_id: ID del servicio (para calcular duración)
        - date: Fecha para la cual consultar disponibilidad
    """
    service_id: int = Field(..., gt=0)
    date: date
    
    class Config:
        json_schema_extra = {
            "example": {
                "service_id": 1,
                "date": "2024-02-10"
            }
        }


class AvailableSlotsResponse(BaseModel):
    """
    Schema de respuesta con slots disponibles.
    """
    date: date
    service_id: int
    service_name: str
    duration_minutes: int
    available_slots: List[TimeSlot]
    
    class Config:
        json_schema_extra = {
            "example": {
                "date": "2024-02-10",
                "service_id": 1,
                "service_name": "Lifting de Pestañas",
                "duration_minutes": 60,
                "available_slots": [
                    {
                        "start_time": "2024-02-10T09:00:00",
                        "end_time": "2024-02-10T10:00:00",
                        "is_available": True
                    },
                    {
                        "start_time": "2024-02-10T10:00:00",
                        "end_time": "2024-02-10T11:00:00",
                        "is_available": True
                    }
                ]
            }
        }