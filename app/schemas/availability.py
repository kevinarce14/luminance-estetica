# app/schemas/availability.py
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import date, time, datetime
from typing import Optional, List


class AvailabilityBase(BaseModel):
    """Schema base de Disponibilidad con campos comunes"""
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    specific_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_available: bool = True


class AvailabilityCreate(AvailabilityBase):
    """
    Schema para crear disponibilidad.
    Incluye validaciones estrictas.
    """
    
    @model_validator(mode='after')
    def validate_day_or_date(self):
        """Valida que se especifique day_of_week O specific_date, no ambos"""
        day_of_week = self.day_of_week
        specific_date = self.specific_date
        
        # Debe tener uno de los dos
        if day_of_week is None and specific_date is None:
            raise ValueError('Debe especificar day_of_week o specific_date')
        
        # No puede tener ambos
        if day_of_week is not None and specific_date is not None:
            raise ValueError('No puede especificar day_of_week y specific_date simultáneamente')
        
        return self
    
    @field_validator('end_time')
    @classmethod
    def validate_time_range(cls, v, info):
        """Valida que end_time sea posterior a start_time"""
        start_time = info.data.get('start_time')
        if start_time and v and v <= start_time:
            raise ValueError('end_time debe ser posterior a start_time')
        return v


class AvailabilityUpdate(BaseModel):
    """Schema para actualizar disponibilidad"""
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_available: Optional[bool] = None
    
    @field_validator('end_time')
    @classmethod
    def validate_time_range(cls, v, info):
        """Valida que end_time sea posterior a start_time"""
        start_time = info.data.get('start_time')
        if start_time and v and v <= start_time:
            raise ValueError('end_time debe ser posterior a start_time')
        return v


class AvailabilityResponse(AvailabilityBase):
    """
    Schema de respuesta de Disponibilidad.
    SIN validaciones estrictas para permitir serialización.
    """
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TimeSlot(BaseModel):
    """Schema de un slot de tiempo disponible"""
    start_time: datetime
    end_time: datetime
    is_available: bool


class AvailableSlotsRequest(BaseModel):
    """Schema para solicitar slots disponibles"""
    service_id: int = Field(..., gt=0)
    date: date


class AvailableSlotsResponse(BaseModel):
    """Schema de respuesta con slots disponibles"""
    date: date
    service_id: int
    service_name: str
    duration_minutes: int
    available_slots: List[TimeSlot]