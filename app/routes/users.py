# app/routes/users.py
"""
Endpoints para gestión de usuarios (perfil, datos personales).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.routes.deps import get_current_user, get_current_admin
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.appointment import AppointmentWithDetails

router = APIRouter(prefix="/users", tags=["Usuarios"])


@router.get("/me", response_model=UserResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Obtener perfil del usuario actual.
    
    Requiere autenticación.
    """
    return current_user


@router.put("/me", response_model=UserResponse)
def update_my_profile(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Actualizar perfil del usuario actual.
    
    Campos actualizables:
    - full_name
    - phone
    
    Requiere autenticación.
    """
    # Actualizar campos si se proporcionan
    if user_data.full_name is not None:
        current_user.full_name = user_data.full_name
    
    if user_data.phone is not None:
        current_user.phone = user_data.phone
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.get("/me/appointments", response_model=List[AppointmentWithDetails])
def get_my_appointments(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtener todos los turnos del usuario actual.
    
    Query params:
    - **skip**: Número de registros a saltar (paginación)
    - **limit**: Número máximo de registros a retornar
    
    Requiere autenticación.
    """
    from app.models.appointment import Appointment
    
    appointments = (
        db.query(Appointment)
        .filter(Appointment.user_id == current_user.id)
        .order_by(Appointment.appointment_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    return appointments


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Eliminar cuenta del usuario actual.
    
    **ADVERTENCIA**: Esta acción es irreversible.
    Se eliminarán todos los turnos y pagos asociados.
    
    Requiere autenticación.
    """
    # Nota: Con cascade="all, delete-orphan" en las relaciones,
    # SQLAlchemy eliminará automáticamente turnos y pagos asociados
    
    db.delete(current_user)
    db.commit()
    
    return None


# ========== ENDPOINTS DE ADMIN ==========


@router.get("/", response_model=List[UserResponse])
def list_all_users(
    skip: int = 0,
    limit: int = 100,
    is_active: bool | None = None,
    is_admin: bool | None = None,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Listar todos los usuarios (solo admin).
    
    Query params:
    - **skip**: Paginación
    - **limit**: Límite de resultados
    - **is_active**: Filtrar por usuarios activos/inactivos
    - **is_admin**: Filtrar por administradores/clientes
    
    Requiere permisos de administrador.
    """
    query = db.query(User)
    
    # Filtros opcionales
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    if is_admin is not None:
        query = query.filter(User.is_admin == is_admin)
    
    users = query.offset(skip).limit(limit).all()
    
    return users


@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Obtener usuario por ID (solo admin).
    
    Requiere permisos de administrador.
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    return user


@router.put("/{user_id}/toggle-active", response_model=UserResponse)
def toggle_user_active(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Activar/desactivar usuario (solo admin).
    
    Cambia el estado is_active del usuario.
    
    Requiere permisos de administrador.
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # No permitir desactivar al propio admin
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar tu propia cuenta"
        )
    
    # Cambiar estado
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    
    return user


@router.put("/{user_id}/make-admin", response_model=UserResponse)
def make_user_admin(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Convertir usuario en administrador (solo admin).
    
    Requiere permisos de administrador.
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    if user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario ya es administrador"
        )
    
    user.is_admin = True
    db.commit()
    db.refresh(user)
    
    return user