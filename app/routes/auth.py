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
    """Registrar un nuevo usuario."""
    email_normalized = user_data.email.strip().lower()

    existing_user = db.query(User).filter(User.email == email_normalized).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado"
        )

    db_user = User(
        email=email_normalized,          # ✅ siempre guardamos en minúsculas
        full_name=user_data.full_name,
        phone=user_data.phone,
        hashed_password=get_password_hash(user_data.password),
        is_active=True,
        is_admin=False,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

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
    """Login con email y contraseña. Retorna token JWT."""
    email_normalized = form_data.username.strip().lower()   # ✅ normalizar

    user = db.query(User).filter(User.email == email_normalized).first()

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
    Envía un email con link para resetear. El token expira en 1 hora.
    """
    # ✅ Normalizar email antes de buscar en la BD
    email_normalized = str(reset_data.email).strip().lower()

    print(f"🔐 [PasswordReset] Solicitud para: {email_normalized}")

    user = db.query(User).filter(User.email == email_normalized).first()

    # Por seguridad, siempre respondemos igual (no revelamos si el email existe)
    message = "Si el email existe, recibirás instrucciones para resetear tu contraseña"

    if not user:
        print(f"⚠️ [PasswordReset] Usuario no encontrado: {email_normalized}")
        return {"message": message}

    if not user.is_active:
        print(f"⚠️ [PasswordReset] Usuario inactivo: {email_normalized}")
        return {"message": message}

    print(f"✅ [PasswordReset] Usuario encontrado: {user.full_name} ({user.email})")

    reset_token = generate_password_reset_token(user.email)

    try:
        sent = email_service.send_password_reset_email(
            to_email=user.email,
            user_name=user.full_name,
            reset_token=reset_token
        )
        if not sent:
            print(f"❌ [PasswordReset] email_service.send_password_reset_email devolvió False")
    except Exception as e:
        print(f"❌ [PasswordReset] Excepción en email_service: {type(e).__name__}: {str(e)}")

    return {"message": message}


@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
def confirm_password_reset(
    reset_data: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """
    Confirmar reseteo de contraseña con el token recibido por email.
    """
    print(f"🔐 [PasswordResetConfirm] Verificando token...")

    email = verify_password_reset_token(reset_data.token)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o expirado"
        )

    print(f"✅ [PasswordResetConfirm] Token válido para: {email}")

    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    user.hashed_password = get_password_hash(reset_data.new_password)
    db.commit()

    print(f"✅ [PasswordResetConfirm] Contraseña actualizada para: {email}")

    try:
        email_service.send_password_changed_email(
            to_email=user.email,
            user_name=user.full_name
        )
    except Exception as e:
        print(f"⚠️ Error enviando email de confirmación: {str(e)}")

    return {"message": "Contraseña actualizada exitosamente"}