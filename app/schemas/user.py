# app/schemas/user.py
from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
from typing import Optional


class UserBase(BaseModel):
    """Schema base de Usuario con campos comunes"""
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)


class UserCreate(UserBase):
    """
    Schema para crear un usuario (registro).
    
    Requiere:
        - email: Email válido
        - full_name: Nombre completo (mínimo 2 caracteres)
        - password: Contraseña (mínimo 8 caracteres)
        - phone: Teléfono (opcional)
    """
    password: str = Field(..., min_length=8, max_length=100)
    
    @validator('password')
    def validate_password_strength(cls, v):
        """Valida que la contraseña tenga al menos una mayúscula, una minúscula y un número"""
        if not any(c.isupper() for c in v):
            raise ValueError('La contraseña debe contener al menos una letra mayúscula')
        if not any(c.islower() for c in v):
            raise ValueError('La contraseña debe contener al menos una letra minúscula')
        if not any(c.isdigit() for c in v):
            raise ValueError('La contraseña debe contener al menos un número')
        return v
    
    @validator('phone')
    def validate_phone(cls, v):
        """Valida formato de teléfono (opcional pero básico)"""
        if v:
            # Remover espacios y guiones
            cleaned = v.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
            if not cleaned.replace('+', '').isdigit():
                raise ValueError('El teléfono debe contener solo números')
            if len(cleaned) < 8:
                raise ValueError('El teléfono debe tener al menos 8 dígitos')
        return v


class UserLogin(BaseModel):
    """
    Schema para login.
    
    Requiere:
        - email: Email del usuario
        - password: Contraseña
    """
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """
    Schema para actualizar perfil de usuario.
    Todos los campos son opcionales.
    """
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    
    @validator('phone')
    def validate_phone(cls, v):
        """Valida formato de teléfono"""
        if v:
            cleaned = v.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
            if not cleaned.replace('+', '').isdigit():
                raise ValueError('El teléfono debe contener solo números')
            if len(cleaned) < 8:
                raise ValueError('El teléfono debe tener al menos 8 dígitos')
        return v


class UserResponse(UserBase):
    """
    Schema de respuesta de Usuario.
    Se usa cuando la API retorna datos de un usuario.
    """
    id: int
    is_active: bool
    is_admin: bool
    created_at: datetime
    
    class Config:
        from_attributes = True  # Permite convertir modelos SQLAlchemy a Pydantic


class UserPublic(BaseModel):
    """
    Schema público de Usuario (sin info sensible).
    Para mostrar en listas, comentarios, etc.
    """
    id: int
    full_name: str
    
    class Config:
        from_attributes = True