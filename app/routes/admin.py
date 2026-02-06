# app/routes/admin.py
"""
Endpoints administrativos: dashboard, métricas, reportes.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import List

from app.core.database import get_db
from app.routes.deps import get_current_admin
from app.models.user import User
from app.models.appointment import Appointment, AppointmentStatus
from app.models.service import Service
from app.models.payment import Payment, PaymentStatus
from app.schemas.appointment import AppointmentWithDetails

router = APIRouter(prefix="/admin", tags=["Administración"])


@router.get("/dashboard")
def get_dashboard_metrics(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Obtener métricas del dashboard administrativo.
    
    Incluye:
    - Total de clientes registrados
    - Turnos del día/semana/mes
    - Ingresos del mes
    - Servicios más populares
    - Turnos pendientes de confirmar
    
    Requiere permisos de administrador.
    """
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    
    # Total de clientes
    total_clients = db.query(func.count(User.id)).filter(
        User.is_admin == False
    ).scalar()
    
    # Nuevos clientes este mes
    new_clients_this_month = db.query(func.count(User.id)).filter(
        and_(
            User.is_admin == False,
            User.created_at >= month_start
        )
    ).scalar()
    
    # Turnos de hoy
    appointments_today = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.appointment_date >= today_start,
            Appointment.appointment_date < today_end,
            Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED])
        )
    ).scalar()
    
    # Turnos de esta semana
    appointments_this_week = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.appointment_date >= week_start,
            Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED])
        )
    ).scalar()
    
    # Turnos de este mes
    appointments_this_month = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.appointment_date >= month_start,
            Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED])
        )
    ).scalar()
    
    # Turnos pendientes de confirmar
    pending_appointments = db.query(func.count(Appointment.id)).filter(
        Appointment.status == AppointmentStatus.PENDING
    ).scalar()
    
    # Ingresos del mes
    monthly_revenue = db.query(func.sum(Payment.amount)).filter(
        and_(
            Payment.status == PaymentStatus.APPROVED,
            Payment.approved_at >= month_start
        )
    ).scalar() or 0
    
    # Ingresos pendientes (turnos confirmados sin pagar)
    pending_revenue = db.query(func.sum(Service.price)).join(
        Appointment, Appointment.service_id == Service.id
    ).outerjoin(
        Payment, Payment.appointment_id == Appointment.id
    ).filter(
        and_(
            Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
            Payment.id.is_(None)  # No tiene pago
        )
    ).scalar() or 0
    
    # Servicios más reservados este mes
    popular_services = db.query(
        Service.name,
        func.count(Appointment.id).label('count')
    ).join(
        Appointment, Appointment.service_id == Service.id
    ).filter(
        Appointment.created_at >= month_start
    ).group_by(
        Service.name
    ).order_by(
        func.count(Appointment.id).desc()
    ).limit(5).all()
    
    return {
        "clients": {
            "total": total_clients,
            "new_this_month": new_clients_this_month
        },
        "appointments": {
            "today": appointments_today,
            "this_week": appointments_this_week,
            "this_month": appointments_this_month,
            "pending_confirmation": pending_appointments
        },
        "revenue": {
            "this_month": monthly_revenue,
            "pending": pending_revenue,
            "currency": "ARS"
        },
        "popular_services": [
            {"name": name, "count": count}
            for name, count in popular_services
        ]
    }


@router.get("/appointments/upcoming", response_model=List[AppointmentWithDetails])
def get_upcoming_appointments(
    days: int = 7,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Obtener próximos turnos (solo admin).
    
    Query params:
    - **days**: Cantidad de días hacia adelante (default: 7)
    
    Requiere permisos de administrador.
    """
    now = datetime.now()
    future = now + timedelta(days=days)
    
    appointments = (
        db.query(Appointment)
        .filter(
            and_(
                Appointment.appointment_date >= now,
                Appointment.appointment_date <= future,
                Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED])
            )
        )
        .order_by(Appointment.appointment_date.asc())
        .all()
    )
    
    return appointments


@router.get("/appointments/today", response_model=List[AppointmentWithDetails])
def get_today_appointments(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Obtener turnos de hoy (solo admin).
    
    Requiere permisos de administrador.
    """
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    appointments = (
        db.query(Appointment)
        .filter(
            and_(
                Appointment.appointment_date >= today_start,
                Appointment.appointment_date < today_end,
                Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED])
            )
        )
        .order_by(Appointment.appointment_date.asc())
        .all()
    )
    
    return appointments


@router.get("/reports/monthly")
def get_monthly_report(
    year: int,
    month: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Reporte mensual con métricas detalladas (solo admin).
    
    Query params:
    - **year**: Año (ej: 2024)
    - **month**: Mes (1-12)
    
    Requiere permisos de administrador.
    """
    # Calcular inicio y fin del mes
    month_start = datetime(year, month, 1)
    if month == 12:
        month_end = datetime(year + 1, 1, 1)
    else:
        month_end = datetime(year, month + 1, 1)
    
    # Total de turnos
    total_appointments = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.created_at >= month_start,
            Appointment.created_at < month_end
        )
    ).scalar()
    
    # Turnos por estado
    appointments_by_status = db.query(
        Appointment.status,
        func.count(Appointment.id)
    ).filter(
        and_(
            Appointment.created_at >= month_start,
            Appointment.created_at < month_end
        )
    ).group_by(Appointment.status).all()
    
    # Ingresos
    total_revenue = db.query(func.sum(Payment.amount)).filter(
        and_(
            Payment.approved_at >= month_start,
            Payment.approved_at < month_end,
            Payment.status == PaymentStatus.APPROVED
        )
    ).scalar() or 0
    
    # Pagos por método
    payments_by_method = db.query(
        Payment.payment_method,
        func.count(Payment.id),
        func.sum(Payment.amount)
    ).filter(
        and_(
            Payment.approved_at >= month_start,
            Payment.approved_at < month_end,
            Payment.status == PaymentStatus.APPROVED
        )
    ).group_by(Payment.payment_method).all()
    
    # Servicios más vendidos
    services_sold = db.query(
        Service.name,
        func.count(Appointment.id).label('count'),
        func.sum(Payment.amount).label('revenue')
    ).join(
        Appointment, Appointment.service_id == Service.id
    ).outerjoin(
        Payment,
        and_(
            Payment.appointment_id == Appointment.id,
            Payment.status == PaymentStatus.APPROVED
        )
    ).filter(
        and_(
            Appointment.created_at >= month_start,
            Appointment.created_at < month_end
        )
    ).group_by(Service.name).order_by(func.count(Appointment.id).desc()).all()
    
    # Nuevos clientes
    new_clients = db.query(func.count(User.id)).filter(
        and_(
            User.is_admin == False,
            User.created_at >= month_start,
            User.created_at < month_end
        )
    ).scalar()
    
    return {
        "period": {
            "year": year,
            "month": month,
            "start_date": month_start.isoformat(),
            "end_date": month_end.isoformat()
        },
        "appointments": {
            "total": total_appointments,
            "by_status": {
                status.value: count
                for status, count in appointments_by_status
            }
        },
        "revenue": {
            "total": total_revenue,
            "currency": "ARS",
            "by_payment_method": [
                {
                    "method": method,
                    "count": count,
                    "amount": amount or 0
                }
                for method, count, amount in payments_by_method
            ]
        },
        "services": [
            {
                "name": name,
                "appointments_count": count,
                "revenue": revenue or 0
            }
            for name, count, revenue in services_sold
        ],
        "new_clients": new_clients
    }