# app/schemas/coupon.py
from pydantic import BaseModel, Field, validator
from datetime import date, datetime
from typing import Optional


class CouponBase(BaseModel):
    """Schema base de Cupón con campos comunes"""
    code: str = Field(..., min_length=3, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    discount_type: str  # "percentage" o "fixed_amount"
    discount_value: float = Field(..., gt=0)
    min_purchase_amount: float = Field(default=0, ge=0)
    
    @validator('code')
    def validate_code(cls, v):
        """Valida que el código sea alfanumérico y en mayúsculas"""
        # Convertir a mayúsculas
        v = v.upper().strip()
        
        # Permitir solo letras, números y guiones
        if not all(c.isalnum() or c in ['-', '_'] for c in v):
            raise ValueError('El código solo puede contener letras, números, guiones y guiones bajos')
        
        return v
    
    @validator('discount_type')
    def validate_discount_type(cls, v):
        """Valida que el tipo de descuento sea válido"""
        allowed_types = ['percentage', 'fixed_amount']
        if v.lower() not in allowed_types:
            raise ValueError(
                f'Tipo de descuento no válido. Debe ser uno de: {", ".join(allowed_types)}'
            )
        return v.lower()
    
    @validator('discount_value')
    def validate_discount_value(cls, v, values):
        """Valida que el valor de descuento sea razonable"""
        discount_type = values.get('discount_type')
        
        if discount_type == 'percentage' and v > 100:
            raise ValueError('El descuento en porcentaje no puede ser mayor a 100%')
        
        return v


class CouponCreate(CouponBase):
    """
    Schema para crear un cupón.
    
    Requiere:
        - code: Código del cupón (ej: "PROMO20")
        - discount_type: "percentage" o "fixed_amount"
        - discount_value: Valor del descuento
        - min_purchase_amount: Monto mínimo de compra (opcional)
        - max_uses: Máximo de usos (opcional)
        - valid_from: Fecha de inicio (opcional)
        - valid_until: Fecha de fin (opcional)
    """
    max_uses: Optional[int] = Field(None, gt=0)
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    is_active: bool = True
    
    @validator('valid_until')
    def validate_date_range(cls, v, values):
        """Valida que valid_until sea posterior a valid_from"""
        valid_from = values.get('valid_from')
        if valid_from and v and v < valid_from:
            raise ValueError('valid_until debe ser posterior a valid_from')
        return v


class CouponUpdate(BaseModel):
    """
    Schema para actualizar un cupón.
    Todos los campos son opcionales.
    """
    description: Optional[str] = Field(None, max_length=500)
    discount_value: Optional[float] = Field(None, gt=0)
    min_purchase_amount: Optional[float] = Field(None, ge=0)
    max_uses: Optional[int] = Field(None, gt=0)
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    is_active: Optional[bool] = None
    
    @validator('valid_until')
    def validate_date_range(cls, v, values):
        """Valida que valid_until sea posterior a valid_from"""
        valid_from = values.get('valid_from')
        if valid_from and v and v < valid_from:
            raise ValueError('valid_until debe ser posterior a valid_from')
        return v


class CouponResponse(CouponBase):
    """
    Schema de respuesta de Cupón.
    """
    id: int
    max_uses: Optional[int] = None
    uses_count: int
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class CouponValidate(BaseModel):
    """
    Schema para validar un cupón.
    
    El cliente ingresa:
        - code: Código del cupón
        - amount: Monto de la compra
    
    La API responde si es válido y cuánto descuenta.
    """
    code: str = Field(..., min_length=3, max_length=50)
    amount: float = Field(..., gt=0)
    
    @validator('code')
    def validate_code(cls, v):
        """Convierte el código a mayúsculas"""
        return v.upper().strip()


class CouponValidateResponse(BaseModel):
    """
    Schema de respuesta al validar un cupón.
    """
    is_valid: bool
    message: str
    discount_amount: float = 0
    final_amount: float
    coupon: Optional[CouponResponse] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "is_valid": True,
                "message": "Cupón aplicado exitosamente",
                "discount_amount": 3000.00,
                "final_amount": 12000.00,
                "coupon": {
                    "code": "PROMO20",
                    "description": "20% de descuento",
                    "discount_type": "percentage",
                    "discount_value": 20
                }
            }
        }


class CouponApply(BaseModel):
    """
    Schema para aplicar un cupón a un pago.
    """
    code: str = Field(..., min_length=3, max_length=50)
    appointment_id: int = Field(..., gt=0)
    
    @validator('code')
    def validate_code(cls, v):
        """Convierte el código a mayúsculas"""
        return v.upper().strip()