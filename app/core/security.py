# app/core/security.py
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status

from app.core.config import settings

# Contexto para hashear contraseñas con bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica que una contraseña en texto plano coincida con el hash.
    
    Args:
        plain_password: Contraseña en texto plano
        hashed_password: Hash bcrypt de la contraseña
        
    Returns:
        True si coinciden, False si no
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Genera un hash bcrypt de una contraseña.
    
    Args:
        password: Contraseña en texto plano
        
    Returns:
        Hash bcrypt de la contraseña
    """
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Crea un token JWT.
    
    Args:
        data: Datos a incluir en el payload del token (ej: {"sub": user_email})
        expires_delta: Tiempo de expiración custom (opcional)
        
    Returns:
        Token JWT codificado
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """
    Decodifica y verifica un token JWT.
    
    Args:
        token: Token JWT codificado
        
    Returns:
        Payload del token decodificado
        
    Raises:
        HTTPException: Si el token es inválido o expiró
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )


def validate_password_strength(password: str) -> bool:
    """
    Valida que una contraseña cumpla con requisitos mínimos de seguridad.
    
    Requisitos:
    - Mínimo 8 caracteres
    - Al menos una letra mayúscula
    - Al menos una letra minúscula
    - Al menos un número
    
    Args:
        password: Contraseña a validar
        
    Returns:
        True si la contraseña es válida, False si no
    """
    if len(password) < 8:
        return False
    
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    
    return has_upper and has_lower and has_digit


def generate_password_reset_token(email: str) -> str:
    """
    Genera un token temporal para resetear contraseña.
    
    Args:
        email: Email del usuario
        
    Returns:
        Token JWT con expiración de 1 hora
    """
    delta = timedelta(hours=1)
    return create_access_token(
        data={"sub": email, "type": "password_reset"},
        expires_delta=delta
    )


def verify_password_reset_token(token: str) -> Optional[str]:
    """
    Verifica un token de reseteo de contraseña.
    
    Args:
        token: Token JWT
        
    Returns:
        Email del usuario si el token es válido, None si no
    """
    try:
        payload = decode_access_token(token)
        
        if payload.get("type") != "password_reset":
            return None
        
        return payload.get("sub")
    
    except HTTPException:
        return None
