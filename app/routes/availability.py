# app/routes/availability.py
"""
Endpoints para consultar y gestionar disponibilidad de horarios.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, date, time, timedelta, timezone as tz

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
    
    ✅ CORREGIDO: Ahora detecta correctamente solapamientos de horarios.
    
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
    
    # ✅ OBTENER TODOS LOS TURNOS DEL DÍA DE UNA VEZ
    # Esto es más eficiente que hacer una query por cada slot
    # IMPORTANTE: Crear el rango en timezone-aware (UTC) para que coincida con la DB
    from zoneinfo import ZoneInfo
    tz_argentina = ZoneInfo("America/Argentina/Buenos_Aires")
    
    # Crear día en hora local de Argentina
    day_start_local = datetime.combine(target_date, time.min).replace(tzinfo=tz_argentina)
    day_end_local = datetime.combine(target_date, time.max).replace(tzinfo=tz_argentina)
    
    # Convertir a UTC para la query (la DB guarda en UTC)
    day_start = day_start_local.astimezone(tz.utc)
    day_end = day_end_local.astimezone(tz.utc)
    
    existing_appointments = db.query(Appointment).filter(
        ##Appointment.service_id == service_id,   ##DESCOMENTAR ESTO PARA PERMITIR QUE PUEDAN ELEGIR EL MISMO DIA/HORARIO CON LA CONDICION QUE SEA OTRO SERVICIO, SOLO SI ESCALA EL PERSONAL
        Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
        Appointment.appointment_date >= day_start,
        Appointment.appointment_date <= day_end
    ).all()
    # DEBUG: Agregar logging temporal
    print(f"🔍 Buscando turnos para servicio {service_id} en fecha {target_date}")
    print(f"📅 Rango: {day_start} a {day_end}")
    print(f"📋 Turnos encontrados: {len(existing_appointments)}")
    for apt in existing_appointments:
        print(f"   - Turno #{apt.id}: {apt.appointment_date} (status: {apt.status})")
    # Generar slots cada MIN_APPOINTMENT_DURATION minutos
    slots = []
    current_time = datetime.combine(target_date, start_time)
    end_datetime = datetime.combine(target_date, end_time)
    
    while current_time + timedelta(minutes=service.duration_minutes) <= end_datetime:
        slot_end = current_time + timedelta(minutes=service.duration_minutes)
        
        # ✅ VERIFICAR SOLAPAMIENTO CON TODOS LOS TURNOS EXISTENTES
        is_available = True
        
        for apt in existing_appointments:
            # Convertir el turno de la DB (UTC) a hora local Argentina
            apt_start = apt.appointment_date
            if apt_start.tzinfo is None:
                # Si por alguna razón está naive, asumimos que es UTC
                apt_start = apt_start.replace(tzinfo=tz.utc)
            
            apt_start_local = apt_start.astimezone(tz_argentina).replace(tzinfo=None)
            apt_end_local = apt_start_local + timedelta(minutes=service.duration_minutes)
            
            # Los slots ya están en hora local (naive)
            slot_start_naive = current_time.replace(tzinfo=None) if current_time.tzinfo else current_time
            slot_end_naive = slot_end.replace(tzinfo=None) if slot_end.tzinfo else slot_end
            
            # Hay solapamiento si los rangos se cruzan
            # Lógica: start_A < end_B AND end_A > start_B
            if apt_start_local < slot_end_naive and apt_end_local > slot_start_naive:
                is_available = False
                print(f"   ❌ Slot {slot_start_naive.strftime('%H:%M')} bloqueado por turno #{apt.id}")
                break
        slots.append(TimeSlot(
            start_time=current_time,
            end_time=slot_end,
            is_available=is_available
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

# CÓDIGO ADICIONAL PARA app/routes/availability.py
# Agrega estos endpoints AL FINAL de tu archivo existente (después de delete_availability)

# ========== ENDPOINTS ADICIONALES PARA ADMIN DASHBOARD ==========

@router.get("/regular", response_model=List[AvailabilityResponse])
def get_regular_schedules(
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Obtener solo horarios regulares (por día de la semana).
    
    Endpoint específico para el dashboard de admin.
    Retorna solo las configuraciones de Lunes-Domingo.
    
    Requiere permisos de administrador.
    """
    schedules = (
        db.query(Availability)
        .filter(Availability.day_of_week.isnot(None))
        .order_by(Availability.day_of_week)
        .all()
    )
    
    return schedules


@router.post("/regular", response_model=AvailabilityResponse, status_code=status.HTTP_201_CREATED)
def create_regular_schedule(
    availability_data: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Crear un horario regular específicamente.
    
    Valida que tenga day_of_week y no specific_date.
    
    Requiere permisos de administrador.
    """
    # Validar que sea un horario regular
    if availability_data.day_of_week is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Para crear un horario regular debe especificar day_of_week"
        )
    
    if availability_data.specific_date is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un horario regular no debe tener specific_date. Use /exceptions para fechas específicas."
        )
    
    # Verificar si ya existe
    existing = db.query(Availability).filter(
        Availability.day_of_week == availability_data.day_of_week
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un horario para el día {availability_data.day_of_week}"
        )
    
    # Crear
    db_availability = Availability(**availability_data.model_dump())
    db.add(db_availability)
    db.commit()
    db.refresh(db_availability)
    
    return db_availability


@router.put("/regular/{schedule_id}", response_model=AvailabilityResponse)
def update_regular_schedule(
    schedule_id: int,
    availability_data: AvailabilityUpdate,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Actualizar un horario regular específicamente.
    
    Requiere permisos de administrador.
    """
    schedule = db.query(Availability).filter(
        Availability.id == schedule_id,
        Availability.day_of_week.isnot(None)
    ).first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Horario regular no encontrado"
        )
    
    # Actualizar campos
    update_data = availability_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(schedule, field, value)
    
    db.commit()
    db.refresh(schedule)
    
    return schedule


@router.delete("/regular/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_regular_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Eliminar un horario regular específicamente.
    
    Requiere permisos de administrador.
    """
    schedule = db.query(Availability).filter(
        Availability.id == schedule_id,
        Availability.day_of_week.isnot(None)
    ).first()
    
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Horario regular no encontrado"
        )
    
    db.delete(schedule)
    db.commit()
    
    return None


@router.get("/exceptions", response_model=List[AvailabilityResponse])
def get_exceptions(
    future_only: bool = True,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Obtener solo excepciones (fechas específicas).
    
    Query params:
    - **future_only**: Si True, solo retorna excepciones futuras (default: True)
    
    Requiere permisos de administrador.
    """
    query = db.query(Availability).filter(
        Availability.specific_date.isnot(None)
    )
    
    if future_only:
        today = date.today()
        query = query.filter(Availability.specific_date >= today)
    
    exceptions = query.order_by(Availability.specific_date).all()
    
    return exceptions


@router.post("/exceptions", response_model=AvailabilityResponse, status_code=status.HTTP_201_CREATED)
def create_exception(
    availability_data: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Crear una excepción específicamente.
    
    Valida que tenga specific_date y no day_of_week.
    
    Requiere permisos de administrador.
    """
    # Validar que sea una excepción
    if availability_data.specific_date is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Para crear una excepción debe especificar specific_date"
        )
    
    if availability_data.day_of_week is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Una excepción no debe tener day_of_week. Use /regular para horarios regulares."
        )
    
    # Verificar si ya existe
    existing = db.query(Availability).filter(
        Availability.specific_date == availability_data.specific_date
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una excepción para la fecha {availability_data.specific_date}"
        )
    
    # Crear
    db_availability = Availability(**availability_data.model_dump())
    db.add(db_availability)
    db.commit()
    db.refresh(db_availability)
    
    return db_availability


@router.delete("/exceptions/{exception_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exception(
    exception_id: int,
    db: Session = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Eliminar una excepción específicamente.
    
    Requiere permisos de administrador.
    """
    exception = db.query(Availability).filter(
        Availability.id == exception_id,
        Availability.specific_date.isnot(None)
    ).first()
    
    if not exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Excepción no encontrada"
        )
    
    db.delete(exception)
    db.commit()
    
    return None


@router.get("/check/{date_str}")
def check_availability_for_date(
    date_str: str,
    db: Session = Depends(get_db)
):
    """
    Verificar disponibilidad para una fecha específica.
    
    Endpoint público (no requiere autenticación).
    
    Retorna:
    - Si hay excepciones para esa fecha, las retorna
    - Si no, retorna el horario regular del día de la semana
    - Indica si el día está disponible o bloqueado
    
    Path params:
    - **date_str**: Fecha en formato YYYY-MM-DD
    """
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de fecha inválido. Use YYYY-MM-DD"
        )
    
    # Primero buscar excepciones
    exception = db.query(Availability).filter(
        Availability.specific_date == target_date
    ).first()
    
    if exception:
        return {
            "date": target_date,
            "day_of_week": target_date.weekday(),
            "is_available": exception.is_available,
            "start_time": str(exception.start_time) if exception.start_time else None,
            "end_time": str(exception.end_time) if exception.end_time else None,
            "is_exception": True
        }
    
    # No hay excepción, buscar horario regular
    day_of_week = target_date.weekday()
    regular = db.query(Availability).filter(
        Availability.day_of_week == day_of_week
    ).first()
    
    if regular:
        return {
            "date": target_date,
            "day_of_week": day_of_week,
            "is_available": regular.is_available,
            "start_time": str(regular.start_time) if regular.start_time else None,
            "end_time": str(regular.end_time) if regular.end_time else None,
            "is_exception": False
        }
    
    # No hay configuración
    return {
        "date": target_date,
        "day_of_week": day_of_week,
        "is_available": False,
        "start_time": None,
        "end_time": None,
        "is_exception": False
    }