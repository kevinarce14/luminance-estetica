# app/services/notification_service.py
"""
Servicio de notificaciones automáticas.
Maneja recordatorios de turnos y otras notificaciones programadas.
"""

from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.appointment import Appointment, AppointmentStatus
from app.models.user import User
from app.services.email_service import email_service
from app.services.whatsapp_service import whatsapp_service


class NotificationService:
    """
    Servicio para gestionar notificaciones automáticas.
    
    Este servicio debe ser ejecutado por un scheduler (ej: Celery, APScheduler)
    para enviar recordatorios automáticos.
    """

    def send_appointment_reminders(self, db: Session) -> int:
        """
        Envía recordatorios de turnos que ocurrirán en las próximas 24 horas.
        
        Args:
            db: Sesión de base de datos
            
        Returns:
            Cantidad de recordatorios enviados
        """
        # Turnos de mañana (día calendario en zona horaria del negocio)
        tz = ZoneInfo(settings.TIMEZONE)
        now_local = datetime.now(tz)
        tomorrow = (now_local + timedelta(days=1)).date()
        tomorrow_start = datetime.combine(tomorrow, time.min)
        tomorrow_end = datetime.combine(tomorrow, time.max)

        appointments = (
            db.query(Appointment)
            .filter(
                Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
                Appointment.appointment_date >= tomorrow_start,
                Appointment.appointment_date <= tomorrow_end,
                Appointment.reminder_sent == False,
            )
            .all()
        )

        sent_count = 0

        for appointment in appointments:
            user = db.query(User).filter(User.id == appointment.user_id).first()

            if not user:
                continue

            # Enviar email
            if settings.SEND_EMAIL_REMINDERS:
                try:
                    email_service.send_appointment_reminder(
                        to_email=user.email,
                        user_name=user.full_name,
                        service_name=appointment.service.name,
                        appointment_date=appointment.appointment_date,
                    )
                except Exception as e:
                    print(f"❌ Error enviando recordatorio por email: {str(e)}")

            # Enviar WhatsApp
            if settings.SEND_WHATSAPP_REMINDERS and user.phone:
                try:
                    whatsapp_service.send_appointment_reminder(
                        to_phone=user.phone,
                        user_name=user.full_name,
                        service_name=appointment.service.name,
                        appointment_date=appointment.appointment_date,
                    )
                except Exception as e:
                    print(f"❌ Error enviando recordatorio por WhatsApp: {str(e)}")

            # Marcar como enviado
            appointment.reminder_sent = True
            sent_count += 1

        db.commit()

        print(f"✅ Recordatorios enviados: {sent_count}")
        return sent_count

    def check_upcoming_appointments(self, db: Session, days: int = 7) -> dict:
        """
        Verifica los próximos turnos en los siguientes N días.
        
        Args:
            db: Sesión de base de datos
            days: Cantidad de días hacia adelante
            
        Returns:
            Dict con estadísticas de próximos turnos
        """
        now = datetime.now()
        future = now + timedelta(days=days)

        # Turnos próximos
        upcoming = (
            db.query(Appointment)
            .filter(
                Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
                Appointment.appointment_date >= now,
                Appointment.appointment_date <= future,
            )
            .count()
        )

        # Turnos de hoy
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        today = (
            db.query(Appointment)
            .filter(
                Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
                Appointment.appointment_date >= today_start,
                Appointment.appointment_date < today_end,
            )
            .count()
        )

        # Turnos mañana
        tomorrow_start = today_end
        tomorrow_end = tomorrow_start + timedelta(days=1)

        tomorrow = (
            db.query(Appointment)
            .filter(
                Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
                Appointment.appointment_date >= tomorrow_start,
                Appointment.appointment_date < tomorrow_end,
            )
            .count()
        )

        return {
            "today": today,
            "tomorrow": tomorrow,
            "next_7_days": upcoming,
        }

    def send_daily_summary_to_admin(self, db: Session) -> bool:
        """
        Envía un resumen diario al administrador.
        
        Args:
            db: Sesión de base de datos
            
        Returns:
            True si se envió exitosamente
        """
        stats = self.check_upcoming_appointments(db, days=7)

        # Obtener turnos de hoy
        now = datetime.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        today_appointments = (
            db.query(Appointment)
            .filter(
                Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
                Appointment.appointment_date >= today_start,
                Appointment.appointment_date < today_end,
            )
            .order_by(Appointment.appointment_date)
            .all()
        )

        # Construir mensaje
        message = f"""
        📊 Resumen Diario - Luminance Studio
        
        Turnos de hoy: {stats['today']}
        Turnos de mañana: {stats['tomorrow']}
        Próximos 7 días: {stats['next_7_days']}
        
        Turnos de hoy:
        """

        for appointment in today_appointments:
            user = db.query(User).filter(User.id == appointment.user_id).first()
            time_str = appointment.appointment_date.strftime("%H:%M")
            message += f"\n- {time_str} - {appointment.service.name} - {user.full_name if user else 'Usuario desconocido'}"

        if not today_appointments:
            message += "\n(No hay turnos para hoy)"

        # Enviar email al admin
        try:
            # Aquí deberías implementar un template HTML para el resumen
            # Por ahora, solo imprimimos
            print(message)
            return True
        except Exception as e:
            print(f"❌ Error enviando resumen diario: {str(e)}")
            return False

    def cleanup_old_reminders(self, db: Session, days: int = 30) -> int:
        """
        Limpia (marca como no enviado) recordatorios antiguos que ya pasaron.
        Útil para mantener limpia la BD.
        
        Args:
            db: Sesión de base de datos
            days: Cuántos días atrás limpiar
            
        Returns:
            Cantidad de registros limpiados
        """
        cutoff_date = datetime.now() - timedelta(days=days)

        # Resetear reminder_sent para turnos antiguos completados o cancelados
        updated = (
            db.query(Appointment)
            .filter(
                Appointment.status.in_([AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED]),
                Appointment.appointment_date < cutoff_date,
                Appointment.reminder_sent == True,
            )
            .update({"reminder_sent": False})
        )

        db.commit()

        print(f"✅ Limpiados {updated} recordatorios antiguos")
        return updated


# Instancia global
notification_service = NotificationService()


# ========== FUNCIONES PARA SCHEDULER ==========

def run_reminder_scheduler(db: Session):
    """
    Función para ejecutar con un scheduler (ej: Celery, APScheduler).
    
    Ejemplo con APScheduler:
    
    from apscheduler.schedulers.background import BackgroundScheduler
    
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        func=lambda: run_reminder_scheduler(get_db()),
        trigger="interval",
        hours=1  # Ejecutar cada hora
    )
    scheduler.start()
    """
    print("🔔 Ejecutando scheduler de recordatorios...")
    notification_service.send_appointment_reminders(db)


def run_daily_summary(db: Session):
    """
    Función para ejecutar resumen diario.
    
    Ejemplo con APScheduler:
    
    scheduler.add_job(
        func=lambda: run_daily_summary(get_db()),
        trigger="cron",
        hour=8,  # Todos los días a las 8 AM
        minute=0
    )
    """
    print("📊 Ejecutando resumen diario...")
    notification_service.send_daily_summary_to_admin(db)