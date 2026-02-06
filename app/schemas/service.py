# app/schemas/service.py
from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional


class ServiceBase(BaseModel):
    """Schema base de Servicio con campos comunes"""
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    duration_minutes: int = Field(..., gt=0, le=480)  # Mínimo 1 min, máximo 8 horas
    price: float = Field(..., gt=0)
    category: str = Field(..., min_length=2, max_length=100)
    
    @validator('category')
    def validate_category(cls, v):
        """Valida que la categoría sea una de las permitidas"""
        allowed_categories = [
            'pestañas',
            'cejas',
            'laser',
            'facial',
            'corporal',
            'pies',
            'otros'
        ]
        if v.lower() not in allowed_categories:
            raise ValueError(
                f'Categoría no válida. Debe ser una de: {", ".join(allowed_categories)}'
            )
        return v.lower()


class ServiceCreate(ServiceBase):
    """
    Schema para crear un servicio.
    
    Requiere todos los campos del ServiceBase.
    Solo accesible por administradores.
    """
    image_url: Optional[str] = Field(None, max_length=500)
    is_active: bool = True


class ServiceUpdate(BaseModel):
    """
    Schema para actualizar un servicio.
    Todos los campos son opcionales.
    """
    name: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, gt=0, le=480)
    price: Optional[float] = Field(None, gt=0)
    category: Optional[str] = Field(None, min_length=2, max_length=100)
    image_url: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None
    
    @validator('category')
    def validate_category(cls, v):
        """Valida que la categoría sea una de las permitidas"""
        if v:
            allowed_categories = [
                'pestañas',
                'cejas',
                'laser',
                'facial',
                'corporal',
                'pies',
                'otros'
            ]
            if v.lower() not in allowed_categories:
                raise ValueError(
                    f'Categoría no válida. Debe ser una de: {", ".join(allowed_categories)}'
                )
            return v.lower()
        return v


class ServiceResponse(ServiceBase):
    """
    Schema de respuesta de Servicio.
    Incluye campos adicionales calculados.
    """
    id: int
    image_url: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ServicePublic(BaseModel):
    """
    Schema público de Servicio (solo servicios activos).
    Para mostrar en la web/app a los clientes.
    """
    id: int
    name: str
    description: Optional[str] = None
    duration_minutes: int
    price: float
    category: str
    image_url: Optional[str] = None
    
    class Config:
        from_attributes = True