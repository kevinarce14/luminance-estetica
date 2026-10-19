# app/schemas/auth.py
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, check_password_strength


class Token(BaseModel):
    """
    Schema de respuesta al hacer login.
    
    Retorna:
        - access_token: Token JWT para autenticación
        - token_type: Tipo de token (siempre "bearer")
    """
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """
    Schema de datos contenidos en el token JWT.
    
    Campos:
        - email: Email del usuario (usado como identificador)
    """
    email: str | None = None


class PasswordReset(BaseModel):
    """
    Schema para solicitar reseteo de contraseña.
    
    El usuario ingresa su email y recibe un link para resetear.
    """
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """
    Schema para confirmar reseteo de contraseña.
    
    El usuario ingresa el token recibido por email y su nueva contraseña.
    """
    token: str = Field(..., min_length=10, max_length=2048)
    new_password: str = Field(..., min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @field_validator('token')
    @classmethod
    def strip_token(cls, v: str) -> str:
        # El código se suele pegar desde el email: se toleran espacios y saltos de línea
        return "".join(v.split())

    @field_validator('new_password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        return check_password_strength(v)
    
    class Config:
        json_schema_extra = {
            "example": {
                "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "new_password": "MiNuevaContraseña123"
            }
        }