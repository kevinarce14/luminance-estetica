# app/routes/auth.py
"""
Endpoints de autenticación: registro, login, password reset.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    generate_password_reset_token,
    verify_password_reset_token,
)
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
from app.schemas.auth import Token, PasswordReset, PasswordResetConfirm
from app.services.email_service import email_service

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Registrar un nuevo usuario.
    
    - **email**: Email único (se validará que no exista)
    - **full_name**: Nombre completo
    - **password**: Contraseña (mínimo 8 caracteres, con mayúscula, minúscula y número)
    - **phone**: Teléfono (opcional)
    
    Retorna el usuario creado (sin la contraseña).
    """
    # Verificar que el email no exista
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado"
        )
    
    # Crear usuario
    db_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        phone=user_data.phone,
        hashed_password=get_password_hash(user_data.password),
        is_active=True,
        is_admin=False,
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Enviar email de bienvenida (opcional, no bloqueante)
    try:
        email_service.send_welcome_email(
            to_email=db_user.email,
            user_name=db_user.full_name
        )
    except Exception as e:
        print(f"⚠️ No se pudo enviar email de bienvenida: {str(e)}")
    
    return db_user


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login con email y contraseña.
    
    Retorna un token JWT para autenticación.
    
    **Nota**: FastAPI espera que uses OAuth2PasswordRequestForm,
    donde `username` es el email y `password` es la contraseña.
    """
    # Buscar usuario por email
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo"
        )
    
    # Crear token JWT
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.post("/password-reset", status_code=status.HTTP_200_OK)
def request_password_reset(
    reset_data: PasswordReset,
    db: Session = Depends(get_db)
):
    """
    Solicitar reseteo de contraseña.
    
    Envía un email con un link para resetear la contraseña.
    El token expira en 1 hora.
    """
    # Buscar usuario
    user = db.query(User).filter(User.email == reset_data.email).first()
    
    # Por seguridad, siempre retornamos el mismo mensaje
    # (no revelamos si el email existe o no)
    message = "Si el email existe, recibirás instrucciones para resetear tu contraseña"
    
    if user:
        # Generar token de reseteo
        reset_token = generate_password_reset_token(user.email)
        
        # Enviar email con el token
        try:
            email_service.send_password_reset_email(
                to_email=user.email,
                user_name=user.full_name,
                reset_token=reset_token
            )
        except Exception as e:
            print(f"⚠️ Error enviando email de reseteo: {str(e)}")
    
    return {"message": message}


@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
def confirm_password_reset(
    reset_data: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """
    Confirmar reseteo de contraseña con el token recibido por email.
    
    - **token**: Token JWT recibido por email
    - **new_password**: Nueva contraseña
    """
    # Verificar token
    email = verify_password_reset_token(reset_data.token)
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o expirado"
        )
    
    # Buscar usuario
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Actualizar contraseña
    user.hashed_password = get_password_hash(reset_data.new_password)
    db.commit()
    
    # Enviar email de confirmación (opcional)
    try:
        email_service.send_password_changed_email(
            to_email=user.email,
            user_name=user.full_name
        )
    except Exception as e:
        print(f"⚠️ Error enviando email de confirmación: {str(e)}")
    
    return {"message": "Contraseña actualizada exitosamente"}