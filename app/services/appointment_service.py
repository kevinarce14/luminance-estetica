# app/services/appointment_service.py
"""
Servicio de lógica de negocio para turnos/citas.
Maneja cálculos de disponibilidad, validaciones y operaciones complejas.
"""

from datetime import datetime, date, time, timedelta
from typing import List, Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.core.config import settings
from app.models.appointment import Appointment, AppointmentStatus
from app.models.service import Service
from app.models.availability import Availability
from app.models.user import User


class AppointmentService:
    """
    Servicio para gestionar la lógica de negocio de turnos.
    """

    def __init__(self):
        self.min_duration = settings.MIN_APPOINTMENT_DURATION
        self.min_advance_hours = settings.MIN_BOOKING_ADVANCE_HOURS
        self.max_advance_days = settings.MAX_BOOKING_ADVANCE_DAYS
        self.business_days = settings.business_days_list

    def is_business_day(self, target_date: date) -> bool:
        """
        Verifica si una fecha es día laboral del estudio.
        
        Args:
            target_date: Fecha a verificar
            
        Returns:
            True si es día laboral, False si no
        """
        day_of_week = target_date.weekday()
        return day_of_week in self.business_days

    def get_business_hours(self, db: Session, target_date: date) -> Tuple[time, time] | None:
        """
        Obtiene el horario de atención para una fecha específica.
        
        Args:
            db: Sesión de base de datos
            target_date: Fecha a consultar
            
        Returns:
            Tupla (start_time, end_time) o None si no hay horario
        """
        # Primero buscar disponibilidad específica para esta fecha
        specific_availability = db.query(Availability).filter(
            Availability.specific_date == target_date
        ).first()

        if specific_availability:
            if not specific_availability.is_available:
                # Día bloqueado
                return None
            return (specific_availability.start_time, specific_availability.end_time)

        # Si no hay específica, buscar por día de la semana
        day_of_week = target_date.weekday()

        regular_availability = db.query(Availability).filter(
            Availability.day_of_week == day_of_week,
            Availability.is_available == True
        ).first()

        if not regular_availability:
            return None

        return (regular_availability.start_time, regular_availability.end_time)

    def is_slot_available(
        self,
        db: Session,
        service_id: int,
        appointment_datetime: datetime,
        exclude_appointment_id: int | None = None
    ) -> bool:
        """
        Verifica si un slot específico está disponible.
        
        Args:
            db: Sesión de base de datos
            service_id: ID del servicio
            appointment_datetime: Fecha y hora del slot
            exclude_appointment_id: ID de turno a excluir (para updates)
            
        Returns:
            True si está disponible, False si no
        """
        # Obtener servicio para conocer la duración
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            return False

        # Calcular hora de fin del turno
        end_time = appointment_datetime + timedelta(minutes=service.duration_minutes)

        # Buscar turnos que se solapen con este horario
        query = db.query(Appointment).filter(
            Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
            or_(
                # Caso 1: Turno existente empieza durante nuestro slot
                and_(
                    Appointment.appointment_date >= appointment_datetime,
                    Appointment.appointment_date < end_time
                ),
                # Caso 2: Turno existente termina durante nuestro slot
                and_(
                    Appointment.appointment_date < appointment_datetime,
                    Appointment.appointment_date + timedelta(minutes=service.duration_minutes) > appointment_datetime
                ),
                # Caso 3: Nuestro slot está completamente contenido en un turno existente
                and_(
                    Appointment.appointment_date <= appointment_datetime,
                    Appointment.appointment_date + timedelta(minutes=service.duration_minutes) >= end_time
                )
            )
        )

        # Excluir el turno actual si estamos actualizando
        if exclude_appointment_id:
            query = query.filter(Appointment.id != exclude_appointment_id)

        conflicting = query.first()

        return conflicting is None

    def get_available_slots(
        self,
        db: Session,
        service_id: int,
        target_date: date
    ) -> List[Dict[str, datetime]]:
        """
        Calcula todos los slots disponibles para un servicio en una fecha.
        
        Args:
            db: Sesión de base de datos
            service_id: ID del servicio
            target_date: Fecha a consultar
            
        Returns:
            Lista de dicts con start_time y end_time de cada slot disponible
        """
        # Verificar que el servicio existe
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service or not service.is_active:
            return []

        # Obtener horario de atención para esta fecha
        business_hours = self.get_business_hours(db, target_date)
        if not business_hours:
            return []

        start_time, end_time = business_hours

        # Generar todos los slots posibles
        slots = []
        current_datetime = datetime.combine(target_date, start_time)
        end_datetime = datetime.combine(target_date, end_time)

        while current_datetime + timedelta(minutes=service.duration_minutes) <= end_datetime:
            slot_end = current_datetime + timedelta(minutes=service.duration_minutes)

            # Verificar si el slot está disponible
            is_available = self.is_slot_available(db, service_id, current_datetime)

            slots.append({
                "start_time": current_datetime,
                "end_time": slot_end,
                "is_available": is_available
            })

            # Avanzar al siguiente slot
            current_datetime += timedelta(minutes=self.min_duration)

        return slots

    def get_next_available_slot(
        self,
        db: Session,
        service_id: int,
        from_date: date | None = None
    ) -> datetime | None:
        """
        Encuentra el próximo slot disponible para un servicio.
        
        Args:
            db: Sesión de base de datos
            service_id: ID del servicio
            from_date: Fecha desde la cual buscar (default: hoy)
            
        Returns:
            DateTime del próximo slot disponible o None si no hay
        """
        if from_date is None:
            from_date = date.today()

        # Buscar en los próximos N días
        max_date = from_date + timedelta(days=self.max_advance_days)

        current_date = from_date

        while current_date <= max_date:
            slots = self.get_available_slots(db, service_id, current_date)

            # Buscar el primer slot disponible del día
            for slot in slots:
                if slot["is_available"]:
                    # Verificar anticipación mínima
                    min_datetime = datetime.now() + timedelta(hours=self.min_advance_hours)
                    if slot["start_time"] >= min_datetime:
                        return slot["start_time"]

            current_date += timedelta(days=1)

        return None

    def validate_appointment_time(
        self,
        db: Session,
        service_id: int,
        appointment_datetime: datetime
    ) -> Tuple[bool, str]:
        """
        Valida si un horario es válido para reservar.
        
        Args:
            db: Sesión de base de datos
            service_id: ID del servicio
            appointment_datetime: Fecha y hora propuesta
            
        Returns:
            Tupla (es_valido, mensaje_error)
        """
        # Verificar que el servicio existe
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            return (False, "Servicio no encontrado")

        if not service.is_active:
            return (False, "Este servicio no está disponible actualmente")

        # Verificar que sea en el futuro con anticipación mínima
        min_datetime = datetime.now() + timedelta(hours=self.min_advance_hours)
        if appointment_datetime < min_datetime:
            return (False, f"Debes reservar con al menos {self.min_advance_hours} horas de anticipación")

        # Verificar anticipación máxima
        max_datetime = datetime.now() + timedelta(days=self.max_advance_days)
        if appointment_datetime > max_datetime:
            return (False, f"No puedes reservar con más de {self.max_advance_days} días de anticipación")

        # Verificar que sea día laboral
        appointment_date = appointment_datetime.date()
        if not self.is_business_day(appointment_date):
            return (False, "El estudio no atiende este día de la semana")

        # Verificar horario de atención
        business_hours = self.get_business_hours(db, appointment_date)
        if not business_hours:
            return (False, "El estudio está cerrado en esta fecha")

        start_time, end_time = business_hours
        appointment_time = appointment_datetime.time()

        if appointment_time < start_time or appointment_time >= end_time:
            return (False, f"Fuera del horario de atención ({start_time.strftime('%H:%M')} - {end_time.strftime('%H:%M')})")

        # Verificar que el turno termine antes del cierre
        appointment_end = appointment_datetime + timedelta(minutes=service.duration_minutes)
        closing_time = datetime.combine(appointment_date, end_time)

        if appointment_end > closing_time:
            return (False, "El turno se extendería más allá del horario de cierre")

        # Verificar disponibilidad del slot
        if not self.is_slot_available(db, service_id, appointment_datetime):
            return (False, "Este horario no está disponible")

        return (True, "")

    def get_user_upcoming_appointments(
        self,
        db: Session,
        user_id: int,
        limit: int = 10
    ) -> List[Appointment]:
        """
        Obtiene los próximos turnos de un usuario.
        
        Args:
            db: Sesión de base de datos
            user_id: ID del usuario
            limit: Cantidad máxima de turnos
            
        Returns:
            Lista de turnos futuros
        """
        now = datetime.now()

        appointments = (
            db.query(Appointment)
            .filter(
                Appointment.user_id == user_id,
                Appointment.appointment_date >= now,
                Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED])
            )
            .order_by(Appointment.appointment_date.asc())
            .limit(limit)
            .all()
        )

        return appointments

    def get_user_past_appointments(
        self,
        db: Session,
        user_id: int,
        limit: int = 10
    ) -> List[Appointment]:
        """
        Obtiene el historial de turnos pasados de un usuario.
        
        Args:
            db: Sesión de base de datos
            user_id: ID del usuario
            limit: Cantidad máxima de turnos
            
        Returns:
            Lista de turnos pasados
        """
        now = datetime.now()

        appointments = (
            db.query(Appointment)
            .filter(
                Appointment.user_id == user_id,
                or_(
                    Appointment.appointment_date < now,
                    Appointment.status.in_([AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED])
                )
            )
            .order_by(Appointment.appointment_date.desc())
            .limit(limit)
            .all()
        )

        return appointments

    def can_cancel_appointment(self, appointment: Appointment) -> Tuple[bool, str]:
        """
        Verifica si un turno puede ser cancelado.
        
        Args:
            appointment: Turno a verificar
            
        Returns:
            Tupla (puede_cancelar, mensaje)
        """
        # Solo se pueden cancelar turnos pending o confirmed
        if appointment.status not in [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]:
            return (False, "Este turno no puede ser cancelado")

        # Verificar que no sea en el pasado
        if appointment.appointment_date < datetime.now():
            return (False, "No puedes cancelar un turno que ya pasó")

        # TODO: Agregar política de cancelación (ej: mínimo 24h antes)
        # min_cancellation_time = appointment.appointment_date - timedelta(hours=24)
        # if datetime.now() > min_cancellation_time:
        #     return (False, "Debes cancelar con al menos 24 horas de anticipación")

        return (True, "")

    def get_appointment_statistics(
        self,
        db: Session,
        from_date: date,
        to_date: date
    ) -> Dict:
        """
        Calcula estadísticas de turnos en un rango de fechas.
        
        Args:
            db: Sesión de base de datos
            from_date: Fecha de inicio
            to_date: Fecha de fin
            
        Returns:
            Dict con estadísticas
        """
        from_datetime = datetime.combine(from_date, time.min)
        to_datetime = datetime.combine(to_date, time.max)

        # Total de turnos
        total = db.query(Appointment).filter(
            and_(
                Appointment.appointment_date >= from_datetime,
                Appointment.appointment_date <= to_datetime
            )
        ).count()

        # Por estado
        by_status = {}
        for status in AppointmentStatus:
            count = db.query(Appointment).filter(
                and_(
                    Appointment.appointment_date >= from_datetime,
                    Appointment.appointment_date <= to_datetime,
                    Appointment.status == status
                )
            ).count()
            by_status[status.value] = count

        # Tasa de cancelación
        cancelled = by_status.get(AppointmentStatus.CANCELLED.value, 0)
        cancellation_rate = (cancelled / total * 100) if total > 0 else 0

        # Tasa de completados
        completed = by_status.get(AppointmentStatus.COMPLETED.value, 0)
        completion_rate = (completed / total * 100) if total > 0 else 0

        return {
            "total": total,
            "by_status": by_status,
            "cancellation_rate": round(cancellation_rate, 2),
            "completion_rate": round(completion_rate, 2),
            "period": {
                "from": from_date.isoformat(),
                "to": to_date.isoformat()
            }
        }

    def get_popular_time_slots(
        self,
        db: Session,
        from_date: date,
        to_date: date,
        limit: int = 5
    ) -> List[Dict]:
        """
        Obtiene los horarios más populares (más reservados).
        
        Args:
            db: Sesión de base de datos
            from_date: Fecha de inicio
            to_date: Fecha de fin
            limit: Cantidad de resultados
            
        Returns:
            Lista de horarios con cantidad de reservas
        """
        from sqlalchemy import func, extract

        from_datetime = datetime.combine(from_date, time.min)
        to_datetime = datetime.combine(to_date, time.max)

        # Agrupar por hora del día
        popular_hours = (
            db.query(
                extract('hour', Appointment.appointment_date).label('hour'),
                func.count(Appointment.id).label('count')
            )
            .filter(
                and_(
                    Appointment.appointment_date >= from_datetime,
                    Appointment.appointment_date <= to_datetime,
                    Appointment.status.in_([AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED])
                )
            )
            .group_by('hour')
            .order_by(func.count(Appointment.id).desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "hour": f"{int(hour):02d}:00",
                "count": count
            }
            for hour, count in popular_hours
        ]


# Instancia global
appointment_service = AppointmentService()