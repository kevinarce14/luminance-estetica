# app/routes/availability.py
"""
Endpoints para consultar y gestionar disponibilidad de horarios.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, date, time, timedelta

from app.core.database import get_db
from app.core.config import settings
from app.routes.deps import get_current_admin
from app.models.availability import Availability
from app.models.service import Service
from app.models.appointment import Appointment, AppointmentStatus
from app.schemas.availability import (
    AvailabilityCreate,
    AvailabilityUpdate,
    AvailabilityResponse,
    AvailableSlotsRequest,
    AvailableSlotsResponse,
    TimeSlot
)

router = APIRouter(prefix="/availability", tags=["Disponibilidad"])


def get_available_slots_for_date(
    db: Session,
    service_id: int,
    target_date: date
) -> List[TimeSlot]:
    """
    Calcula los slots de tiempo disponibles para un servicio en una fecha específica.
    
    Args:
        db: Sesión de base de datos
        service_id: ID del servicio
        target_date: Fecha para la cual calcular disponibilidad
        
    Returns:
        Lista de TimeSlots disponibles
    """
    # Obtener servicio
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        return []
    
    # Obtener día de la semana (0=Lunes, 6=Domingo)
    day_of_week = target_date.weekday()
    
    # Buscar disponibilidad específica para esta fecha
    specific_availability = db.query(Availability).filter(
        Availability.specific_date == target_date
    ).first()
    
    if specific_availability:
        # Hay disponibilidad específica para esta fecha
        if not specific_availability.is_available:
            # Día bloqueado
            return []
        
        start_time = specific_availability.start_time
        end_time = specific_availability.end_time
    else:
        # Usar disponibilidad regular del día de la semana
        regular_availability = db.query(Availability).filter(
            Availability.day_of_week == day_of_week,
            Availability.is_available == True
        ).first()
        
        if not regular_availability:
            # No hay horario para este día
            return []
        
        start_time = regular_availability.start_time
        end_time = regular_availability.end_time
    
    # Generar slots cada MIN_APPOINTMENT_DURATION minutos
    slots = []
    current_time = datetime.combine(target_date, start_time)
    end_datetime = datetime.combine(target_date, end_time)
    
    while current_time + timedelta(minutes=service.duration_minutes) <= end_datetime:
        slot_end = current_time + timedelta(minutes=service.duration_minutes)
        
        # Verificar si hay un turno en este horario
        conflicting_appointment = db.query(Appointment).filter(
            Appointment.service_id == service_id,
            Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
            Appointment.appointment_date == current_time
        ).first()
        
        slots.append(TimeSlot(
            start_time=current_time,
            end_time=slot_end,
            is_available=conflicting_appointment is None
        ))
        
        # Avanzar al siguiente slot
        current_time += timedelta(minutes=settings.MIN_APPOINTMENT_DURATION)
    
    return slots


@router.post("/available-slots", response_model=AvailableSlotsResponse)
def get_available_slots(
    request: AvailableSlotsRequest,
    db: Session = Depends(get_db)
):
    """
    Obtener slots de tiempo disponibles para un servicio en una fecha.
    
    **No requiere autenticación** - Endpoint público para que los clientes vean disponibilidad.
    """
    # Verificar que el servicio existe
    service = db.query(Service).filter(Service.id == request.service_id).first()
    
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )
    
    # Calcular slots disponibles
    slots = get_available_slots_for_date(db, service.id, request.date)
    
    return {
        "date": request.date,
        "service_id": service.id,
        "service_name": service.name,
        "duration_minutes": service.duration_minutes,
        "available_slots": slots
    }


# ========== ENDPOINTS DE ADMIN ==========


@router.get("/", response_model=List[AvailabilityResponse])
def list_availability(
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Listar toda la configuración de disponibilidad (solo admin).
    
    Incluye horarios regulares y excepciones.
    
    Requiere permisos de administrador.
    """
    availability = db.query(Availability).all()
    return availability


@router.post("/", response_model=AvailabilityResponse, status_code=status.HTTP_201_CREATED)
def create_availability(
    availability_data: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Crear nueva disponibilidad (solo admin).
    
    Puede ser:
    1. Horario regular: especificar day_of_week
    2. Excepción/Bloqueo: especificar specific_date
    
    Requiere permisos de administrador.
    """
    # Verificar si ya existe
    if availability_data.day_of_week is not None:
        existing = db.query(Availability).filter(
            Availability.day_of_week == availability_data.day_of_week
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe disponibilidad para este día de la semana"
            )
    
    if availability_data.specific_date is not None:
        existing = db.query(Availability).filter(
            Availability.specific_date == availability_data.specific_date
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe disponibilidad para esta fecha específica"
            )
    
    # Crear
    db_availability = Availability(**availability_data.model_dump())
    
    db.add(db_availability)
    db.commit()
    db.refresh(db_availability)
    
    return db_availability


@router.put("/{availability_id}", response_model=AvailabilityResponse)
def update_availability(
    availability_id: int,
    availability_data: AvailabilityUpdate,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Actualizar disponibilidad (solo admin).
    
    Requiere permisos de administrador.
    """
    availability = db.query(Availability).filter(
        Availability.id == availability_id
    ).first()
    
    if not availability:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disponibilidad no encontrada"
        )
    
    # Actualizar campos
    update_data = availability_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(availability, field, value)
    
    db.commit()
    db.refresh(availability)
    
    return availability


@router.delete("/{availability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability(
    availability_id: int,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Eliminar disponibilidad (solo admin).
    
    Requiere permisos de administrador.
    """
    availability = db.query(Availability).filter(
        Availability.id == availability_id
    ).first()
    
    if not availability:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disponibilidad no encontrada"
        )
    
    db.delete(availability)
    db.commit()
    
    return None