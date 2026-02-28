# app/routes/auth.py
"""
Endpoints de autenticación: registro, login, Google OAuth, password reset.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
import httpx
import os

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

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


class GoogleLoginRequest(BaseModel):
    credential: str  # El id_token que entrega Google al frontend


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
        email=email_normalized,
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
    email_normalized = form_data.username.strip().lower()

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


@router.post("/google", response_model=Token)
async def google_login(
    body: GoogleLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login / registro con Google.

    El frontend obtiene un id_token de Google (via Google Identity Services)
    y lo envía aquí. El backend lo verifica con Google, extrae el email y nombre,
    y devuelve un JWT propio igual que el login normal.

    - Si el usuario no existe → se crea automáticamente (sin contraseña)
    - Si el usuario existe → se hace login directamente
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth no está configurado en el servidor"
        )

    # Verificar el token con Google
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": body.credential}
            )
    except Exception as e:
        print(f"❌ Error contactando a Google: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo verificar el token con Google"
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de Google inválido"
        )

    google_data = response.json()
    print(f"✅ Google token verificado: {google_data.get('email')}")

    # Validar que el token fue emitido para ESTA app
    if google_data.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no corresponde a esta aplicación"
        )

    email = google_data.get("email", "").strip().lower()
    full_name = google_data.get("name", "") or google_data.get("email", "").split("@")[0]
    google_verified = google_data.get("email_verified") == "true"

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo obtener el email desde Google"
        )

    if not google_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email de Google no está verificado"
        )

    # Buscar o crear el usuario
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Primer acceso con Google → crear cuenta automáticamente
        print(f"🆕 Creando nuevo usuario desde Google: {email}")
        user = User(
            email=email,
            full_name=full_name,
            hashed_password="",  # Sin contraseña (acceso solo por Google)
            is_active=True,
            is_admin=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        try:
            email_service.send_welcome_email(
                to_email=user.email,
                user_name=user.full_name
            )
        except Exception as e:
            print(f"⚠️ No se pudo enviar email de bienvenida: {str(e)}")
    else:
        # Usuario existente
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu cuenta está desactivada"
            )
        print(f"✅ Usuario existente logueado con Google: {email}")

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
    email_normalized = str(reset_data.email).strip().lower()
    print(f"🔐 [PasswordReset] Solicitud para: {email_normalized}")

    user = db.query(User).filter(User.email == email_normalized).first()
    message = "Si el email existe, recibirás instrucciones para resetear tu contraseña"

    if not user:
        print(f"⚠️ [PasswordReset] Usuario no encontrado: {email_normalized}")
        return {"message": message}

    if not user.is_active:
        print(f"⚠️ [PasswordReset] Usuario inactivo: {email_normalized}")
        return {"message": message}

    if not user.hashed_password:
        # Usuario que solo usa Google, no tiene contraseña
        return {"message": "Esta cuenta solo puede acceder con Google"}

    print(f"✅ [PasswordReset] Usuario encontrado: {user.full_name} ({user.email})")
    reset_token = generate_password_reset_token(user.email)

    try:
        sent = email_service.send_password_reset_email(
            to_email=user.email,
            user_name=user.full_name,
            reset_token=reset_token
        )
        if not sent:
            print(f"❌ [PasswordReset] email_service devolvió False")
    except Exception as e:
        print(f"❌ [PasswordReset] Excepción: {type(e).__name__}: {str(e)}")

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