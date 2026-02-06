# app/routes/deps.py
"""
Dependencias reutilizables para los endpoints.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.config import settings
from app.models.user import User

# OAuth2 scheme para autenticación con token
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/login"
)


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    Obtiene el usuario actual autenticado desde el token JWT.
    
    Args:
        db: Sesión de base de datos
        token: Token JWT del header Authorization
        
    Returns:
        Usuario autenticado
        
    Raises:
        HTTPException 401: Si el token es inválido
        HTTPException 404: Si el usuario no existe
        HTTPException 403: Si el usuario está inactivo
    """
    # Decodificar token
    payload = decode_access_token(token)
    email: str = payload.get("sub")
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudo validar las credenciales",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Buscar usuario en la base de datos
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo"
        )
    
    return user


def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Verifica que el usuario actual sea administrador.
    
    Args:
        current_user: Usuario autenticado
        
    Returns:
        Usuario administrador
        
    Raises:
        HTTPException 403: Si el usuario no es admin
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos de administrador"
        )
    
    return current_user


def get_optional_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User | None:
    """
    Obtiene el usuario actual si está autenticado, sino retorna None.
    Útil para endpoints que funcionan con o sin autenticación.
    
    Args:
        db: Sesión de base de datos
        token: Token JWT (opcional)
        
    Returns:
        Usuario autenticado o None
    """
    if not token:
        return None
    
    try:
        return get_current_user(db, token)
    except HTTPException:
        return None