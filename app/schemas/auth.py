# app/schemas/auth.py
from pydantic import BaseModel, EmailStr


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
    token: str
    new_password: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "new_password": "MiNuevaContraseña123"
            }
        }