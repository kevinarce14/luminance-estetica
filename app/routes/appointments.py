# app/routes/appointments.py
"""
Endpoints para gestión de turnos/citas.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.config import settings
from app.routes.deps import get_current_user, get_current_admin
from app.models.user import User
from app.models.appointment import Appointment, AppointmentStatus
from app.models.service import Service
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse,
    AppointmentWithDetails,
    AppointmentCancel
)
from app.services.email_service import email_service

router = APIRouter(prefix="/appointments", tags=["Turnos/Citas"])


def check_slot_availability(
    db: Session,
    service_id: int,
    appointment_date: datetime,
    exclude_appointment_id: int | None = None
) -> bool:
    """
    Verifica si un slot de tiempo está disponible para reservar.
    
    Args:
        db: Sesión de base de datos
        service_id: ID del servicio
        appointment_date: Fecha y hora deseada
        exclude_appointment_id: ID de turno a excluir (para updates)
        
    Returns:
        True si está disponible, False si no
    """
    # Obtener servicio para saber la duración
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        return False
    
    # Calcular hora de fin
    end_time = appointment_date + timedelta(minutes=service.duration_minutes)
    
    # Buscar turnos conflictivos (que se solapen)
    query = db.query(Appointment).filter(
        Appointment.service_id == service_id,
        Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
        or_(
            # Caso 1: El nuevo turno empieza durante un turno existente
            and_(
                Appointment.appointment_date <= appointment_date,
                Appointment.appointment_date + timedelta(minutes=service.duration_minutes) > appointment_date
            ),
            # Caso 2: El nuevo turno termina durante un turno existente
            and_(
                Appointment.appointment_date < end_time,
                Appointment.appointment_date + timedelta(minutes=service.duration_minutes) >= end_time
            ),
            # Caso 3: El nuevo turno contiene completamente a un turno existente
            and_(
                Appointment.appointment_date >= appointment_date,
                Appointment.appointment_date + timedelta(minutes=service.duration_minutes) <= end_time
            )
        )
    )
    
    # Excluir el turno actual si estamos actualizando
    if exclude_appointment_id:
        query = query.filter(Appointment.id != exclude_appointment_id)
    
    conflicting = query.first()
    
    return conflicting is None


@router.post("/", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment(
    appointment_data: AppointmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Crear un nuevo turno.
    
    Validaciones:
    - El servicio existe y está activo
    - La fecha es en el futuro
    - El horario está dentro del horario de atención
    - No hay otro turno en ese horario
    
    Requiere autenticación.
    """
    # Verificar que el servicio existe y está activo
    service = db.query(Service).filter(Service.id == appointment_data.service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )
    
    if not service.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este servicio no está disponible actualmente"
        )
    
    # Verificar que la fecha sea en el futuro (con anticipación mínima)
    min_advance = datetime.now() + timedelta(hours=settings.MIN_BOOKING_ADVANCE_HOURS)
    if appointment_data.appointment_date < min_advance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Debes reservar con al menos {settings.MIN_BOOKING_ADVANCE_HOURS} horas de anticipación"
        )
    
    # Verificar anticipación máxima
    max_advance = datetime.now() + timedelta(days=settings.MAX_BOOKING_ADVANCE_DAYS)
    if appointment_data.appointment_date > max_advance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No puedes reservar con más de {settings.MAX_BOOKING_ADVANCE_DAYS} días de anticipación"
        )
    
    # Verificar disponibilidad del slot
    if not check_slot_availability(db, service.id, appointment_data.appointment_date):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este horario no está disponible"
        )
    
    # Crear turno
    db_appointment = Appointment(
        user_id=current_user.id,
        service_id=appointment_data.service_id,
        appointment_date=appointment_data.appointment_date,
        notes=appointment_data.notes,
        status=AppointmentStatus.PENDING,
    )
    
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    
    # Enviar email de confirmación
    try:
        email_service.send_appointment_confirmation(
            to_email=current_user.email,
            user_name=current_user.full_name,
            service_name=service.name,
            appointment_date=db_appointment.appointment_date
        )
    except Exception as e:
        print(f"⚠️ Error enviando email de confirmación: {str(e)}")
    
    return db_appointment


@router.get("/", response_model=List[AppointmentWithDetails])
def list_my_appointments(
    skip: int = 0,
    limit: int = 100,
    status_filter: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Listar turnos del usuario actual.
    
    Query params:
    - **skip**: Paginación
    - **limit**: Límite de resultados
    - **status_filter**: Filtrar por estado (pending, confirmed, completed, cancelled)
    
    Requiere autenticación.
    """
    query = db.query(Appointment).filter(Appointment.user_id == current_user.id)
    
    if status_filter:
        query = query.filter(Appointment.status == status_filter)
    
    appointments = (
        query
        .order_by(Appointment.appointment_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    return appointments


@router.get("/{appointment_id}", response_model=AppointmentWithDetails)
def get_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtener detalles de un turno específico.
    
    Requiere autenticación.
    Solo el dueño del turno o un admin pueden verlo.
    """
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Turno no encontrado"
        )
    
    # Verificar permisos
    if appointment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para ver este turno"
        )
    
    return appointment


@router.put("/{appointment_id}", response_model=AppointmentResponse)
def update_appointment(
    appointment_id: int,
    appointment_data: AppointmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Actualizar un turno (cambiar fecha/hora o notas).
    
    Solo se puede modificar si está en estado PENDING o CONFIRMED.
    
    Requiere autenticación.
    """
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Turno no encontrado"
        )
    
    # Verificar permisos
    if appointment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para modificar este turno"
        )
    
    # Verificar que se pueda modificar
    if appointment.status not in [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede modificar un turno que está completado o cancelado"
        )
    
    # Si cambia la fecha, verificar disponibilidad
    if appointment_data.appointment_date:
        if not check_slot_availability(
            db,
            appointment.service_id,
            appointment_data.appointment_date,
            exclude_appointment_id=appointment_id
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nuevo horario no está disponible"
            )
        
        appointment.appointment_date = appointment_data.appointment_date
    
    # Actualizar otros campos
    if appointment_data.notes is not None:
        appointment.notes = appointment_data.notes
    
    if appointment_data.status and current_user.is_admin:
        # Solo admin puede cambiar el estado directamente
        appointment.status = appointment_data.status
    
    db.commit()
    db.refresh(appointment)
    
    return appointment


@router.post("/{appointment_id}/cancel", response_model=AppointmentResponse)
def cancel_appointment(
    appointment_id: int,
    cancel_data: AppointmentCancel,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancelar un turno.
    
    Requiere autenticación.
    """
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Turno no encontrado"
        )
    
    # Verificar permisos
    if appointment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para cancelar este turno"
        )
    
    # Verificar que se pueda cancelar
    if not appointment.can_be_cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este turno no se puede cancelar"
        )
    
    # Cancelar
    appointment.status = AppointmentStatus.CANCELLED
    appointment.cancelled_at = datetime.now()
    appointment.cancellation_reason = cancel_data.cancellation_reason
    
    db.commit()
    db.refresh(appointment)
    
    # Enviar email de cancelación
    try:
        service = db.query(Service).filter(Service.id == appointment.service_id).first()
        email_service.send_appointment_cancellation(
            to_email=current_user.email,
            user_name=current_user.full_name,
            service_name=service.name,
            appointment_date=appointment.appointment_date
        )
    except Exception as e:
        print(f"⚠️ Error enviando email de cancelación: {str(e)}")
    
    return appointment


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Eliminar un turno permanentemente (solo admin).
    
    **NOTA**: Mejor opción es cancelar en lugar de eliminar.
    
    Requiere permisos de administrador.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden eliminar turnos"
        )
    
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Turno no encontrado"
        )
    
    db.delete(appointment)
    db.commit()
    
    return None