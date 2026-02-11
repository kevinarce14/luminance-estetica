# app/services/scheduler_service.py
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.appointment import Appointment, AppointmentStatus
from app.core.database import SessionLocal

def update_appointments_status():
    """
    Actualiza automáticamente el estado de los turnos:
    - PENDING → CANCELLED (si ya pasaron)
    - CONFIRMED → COMPLETED (si ya pasaron)
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        print(f"🔄 Actualizando estados de turnos - {now.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # 1. Turnos PENDING que ya pasaron → CANCELLED
        pending_expired = db.query(Appointment).filter(
            Appointment.status == AppointmentStatus.PENDING,
            Appointment.appointment_date < now
        ).update(
            {
                Appointment.status: AppointmentStatus.CANCELLED,
                Appointment.cancelled_at: now,
                Appointment.cancellation_reason: "Cancelado automáticamente por no confirmar"
            },
            synchronize_session=False
        )
        
        # 2. Turnos CONFIRMED que ya pasaron → COMPLETED
        confirmed_completed = db.query(Appointment).filter(
            Appointment.status == AppointmentStatus.CONFIRMED,
            Appointment.appointment_date < now
        ).update(
            {Appointment.status: AppointmentStatus.COMPLETED},
            synchronize_session=False
        )
        
        db.commit()
        
        if pending_expired > 0 or confirmed_completed > 0:
            print(f"✅ Actualizados: {pending_expired} PENDING→CANCELLED, {confirmed_completed} CONFIRMED→COMPLETED")
            
    except Exception as e:
        print(f"❌ Error actualizando turnos: {str(e)}")
        db.rollback()
    finally:
        db.close()

def init_scheduler():
    """Inicializa el scheduler para que corra cada hora"""
    scheduler = BackgroundScheduler(timezone=timezone.utc)
    
    # Ejecutar cada hora
    scheduler.add_job(
        update_appointments_status,
        CronTrigger(minute=0),  # Cada hora en punto
        id="update_appointments_status",
        replace_existing=True
    )
    
    # También ejecutar al inicio
    scheduler.add_job(
        update_appointments_status,
        trigger='date',
        run_date=datetime.now(timezone.utc),
        id="update_appointments_status_startup"
    )
    
    scheduler.start()
    print("⏰ Scheduler iniciado - Actualizará turnos cada hora")
    return scheduler