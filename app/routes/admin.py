# app/routes/admin.py
"""
Endpoints administrativos: dashboard, métricas, agenda de turnos y reportes.

Fechas: los turnos se guardan en UTC naive; "hoy", "esta semana" y "este mes"
se calculan en la hora del studio (settings.TIMEZONE).
"""

from datetime import date, datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.time_utils import (
    studio_day_range_utc,
    studio_day_start_utc,
    studio_today,
    utc_now_naive,
)
from app.routes.deps import get_current_admin
from app.models.user import User
from app.models.appointment import Appointment, AppointmentStatus
from app.models.service import Service
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.schemas.admin import (
    ClientSummary,
    MonthSummary,
    PaymentAdminView,
    PaymentMethodSummary,
    ServiceRanking,
    YearlyReport,
)
from app.schemas.appointment import AppointmentAdminView, AppointmentWithDetails

router = APIRouter(prefix="/admin", tags=["Administración"])

ACTIVE_STATUSES = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]
MIN_PHONE_DIGITS_SEARCH = 3


def _digits(text: str) -> str:
    return "".join(char for char in text if char.isdigit())


def _phone_digits_match(column, digits: str):
    """Compara solo los dígitos de un teléfono guardado con espacios o guiones."""
    return func.regexp_replace(column, "[^0-9]", "", "g").like(f"%{digits}%")


def _studio_month_bounds(year: int, month: int):
    """[inicio, fin) del mes en hora del studio: (naive UTC para turnos, aware UTC para pagos/usuarios)."""
    start = studio_day_start_utc(date(year, month, 1))
    end = studio_day_start_utc(date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1))
    return start, end, start.replace(tzinfo=timezone.utc), end.replace(tzinfo=timezone.utc)


def _with_details(query):
    """Carga usuario, servicio y pago en la misma consulta (evita N+1 al serializar)."""
    return query.options(
        joinedload(Appointment.user),
        joinedload(Appointment.service),
        joinedload(Appointment.payment),
    )


@router.get("/dashboard")
def get_dashboard_metrics(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Obtener métricas del dashboard administrativo.

    Incluye:
    - Total de clientes registrados
    - Turnos del día/semana/mes (hora del studio)
    - Ingresos del mes
    - Servicios más populares
    - Turnos pendientes de confirmar

    Requiere permisos de administrador.
    """
    today = studio_today()
    today_start, today_end = studio_day_range_utc(today)
    week_start = studio_day_start_utc(today - timedelta(days=today.weekday()))
    month_start = studio_day_start_utc(today.replace(day=1))
    # Columnas con timezone (users.created_at, payments.approved_at) se comparan con aware.
    month_start_aware = month_start.replace(tzinfo=timezone.utc)

    # Total de clientes
    total_clients = db.query(func.count(User.id)).filter(
        User.is_admin == False
    ).scalar()

    # Nuevos clientes este mes
    new_clients_this_month = db.query(func.count(User.id)).filter(
        and_(
            User.is_admin == False,
            User.created_at >= month_start_aware
        )
    ).scalar()

    # Turnos de hoy
    appointments_today = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.appointment_date >= today_start,
            Appointment.appointment_date < today_end,
            Appointment.status.in_(ACTIVE_STATUSES)
        )
    ).scalar()

    # Turnos de esta semana
    appointments_this_week = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.appointment_date >= week_start,
            Appointment.status.in_(ACTIVE_STATUSES)
        )
    ).scalar()

    # Turnos de este mes
    appointments_this_month = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.appointment_date >= month_start,
            Appointment.status.in_(ACTIVE_STATUSES)
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
            Payment.approved_at >= month_start_aware
        )
    ).scalar() or 0

    # Ingresos pendientes (turnos activos sin pago)
    pending_revenue = db.query(func.sum(Service.price)).join(
        Appointment, Appointment.service_id == Service.id
    ).outerjoin(
        Payment, Payment.appointment_id == Appointment.id
    ).filter(
        and_(
            Appointment.status.in_(ACTIVE_STATUSES),
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


@router.get("/appointments", response_model=List[AppointmentAdminView])
def list_appointments(
    day: Optional[date] = Query(None, alias="date", description="Día exacto (YYYY-MM-DD, hora del studio)"),
    date_from: Optional[date] = Query(None, description="Desde este día inclusive (hora del studio)"),
    date_to: Optional[date] = Query(None, description="Hasta este día inclusive (hora del studio)"),
    status_filter: Optional[AppointmentStatus] = Query(None, alias="status", description="pending | confirmed | completed | cancelled"),
    search: Optional[str] = Query(None, max_length=100, description="Cliente (nombre, email, teléfono), servicio, notas o #ID"),
    user_id: Optional[int] = Query(None, gt=0, description="Turnos de un cliente (historial)"),
    order: Literal["asc", "desc"] = Query("asc", description="Orden por fecha del turno"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Agenda completa de turnos para el panel admin (todos los estados, pasados y futuros).

    Filtros combinables por fecha, estado y búsqueda de cliente.
    Requiere permisos de administrador.
    """
    query = (
        _with_details(db.query(Appointment))
        .join(User, Appointment.user_id == User.id)
        .join(Service, Appointment.service_id == Service.id)
    )

    if day is not None:
        start, end = studio_day_range_utc(day)
        query = query.filter(Appointment.appointment_date >= start, Appointment.appointment_date < end)
    if date_from is not None:
        query = query.filter(Appointment.appointment_date >= studio_day_start_utc(date_from))
    if date_to is not None:
        query = query.filter(Appointment.appointment_date < studio_day_start_utc(date_to + timedelta(days=1)))
    if status_filter is not None:
        query = query.filter(Appointment.status == status_filter)
    if user_id is not None:
        query = query.filter(Appointment.user_id == user_id)

    term = (search or "").strip()
    if term:
        pattern = f"%{term}%"
        conditions = [
            User.full_name.ilike(pattern),
            User.email.ilike(pattern),
            User.phone.ilike(pattern),
            Service.name.ilike(pattern),
            Appointment.notes.ilike(pattern),
        ]
        id_candidate = term.lstrip("#")
        if id_candidate.isdigit():
            conditions.append(Appointment.id == int(id_candidate))
        digits = _digits(term)
        if len(digits) >= MIN_PHONE_DIGITS_SEARCH:
            conditions.append(_phone_digits_match(User.phone, digits))
        query = query.filter(or_(*conditions))

    ordering = Appointment.appointment_date.asc() if order == "asc" else Appointment.appointment_date.desc()
    return query.order_by(ordering, Appointment.id).offset(skip).limit(limit).all()


@router.get("/appointments/upcoming", response_model=List[AppointmentWithDetails])
def get_upcoming_appointments(
    days: int = Query(7, ge=1, le=365),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Obtener próximos turnos activos (solo admin).

    Query params:
    - **days**: Cantidad de días hacia adelante (default: 7)

    Requiere permisos de administrador.
    """
    now = utc_now_naive()
    future = now + timedelta(days=days)

    return (
        _with_details(db.query(Appointment))
        .filter(
            and_(
                Appointment.appointment_date >= now,
                Appointment.appointment_date <= future,
                Appointment.status.in_(ACTIVE_STATUSES)
            )
        )
        .order_by(Appointment.appointment_date.asc())
        .all()
    )


@router.get("/appointments/today", response_model=List[AppointmentWithDetails])
def get_today_appointments(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Obtener turnos activos de hoy, en hora del studio (solo admin).

    Requiere permisos de administrador.
    """
    today_start, today_end = studio_day_range_utc(studio_today())

    return (
        _with_details(db.query(Appointment))
        .filter(
            and_(
                Appointment.appointment_date >= today_start,
                Appointment.appointment_date < today_end,
                Appointment.status.in_(ACTIVE_STATUSES)
            )
        )
        .order_by(Appointment.appointment_date.asc())
        .all()
    )


@router.get("/payments", response_model=List[PaymentAdminView])
def list_payments(
    status_filter: Optional[PaymentStatus] = Query(None, alias="status", description="pending | approved | rejected | cancelled | refunded"),
    method: Optional[PaymentMethod] = Query(None, description="mercadopago | cash | transfer"),
    search: Optional[str] = Query(None, max_length=100, description="Cliente (nombre, email, teléfono), servicio o #ID de turno"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Pagos con el cliente y el turno asociado (solo admin).
    Ordenados del más reciente al más antiguo.
    """
    query = (
        db.query(Payment)
        .join(User, Payment.user_id == User.id)
        .join(Appointment, Payment.appointment_id == Appointment.id)
        .join(Service, Appointment.service_id == Service.id)
        .options(
            joinedload(Payment.user),
            joinedload(Payment.appointment).joinedload(Appointment.service),
        )
    )
    if status_filter is not None:
        query = query.filter(Payment.status == status_filter)
    if method is not None:
        query = query.filter(Payment.payment_method == method)

    term = (search or "").strip()
    if term:
        pattern = f"%{term}%"
        conditions = [
            User.full_name.ilike(pattern),
            User.email.ilike(pattern),
            User.phone.ilike(pattern),
            Service.name.ilike(pattern),
        ]
        id_candidate = term.lstrip("#")
        if id_candidate.isdigit():
            conditions.append(Appointment.id == int(id_candidate))
        digits = _digits(term)
        if len(digits) >= MIN_PHONE_DIGITS_SEARCH:
            conditions.append(_phone_digits_match(User.phone, digits))
        query = query.filter(or_(*conditions))

    return query.order_by(Payment.created_at.desc(), Payment.id.desc()).offset(skip).limit(limit).all()


@router.get("/clients", response_model=List[ClientSummary])
def list_clients(
    search: Optional[str] = Query(None, max_length=100, description="Nombre, email o teléfono"),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Clientes registrados (no admins) con métricas de su historial:
    cantidad de turnos, completados, cancelados, último turno y total pagado.
    """
    appointment_stats = (
        db.query(
            Appointment.user_id.label("user_id"),
            func.count(Appointment.id).label("total"),
            func.count(case((Appointment.status == AppointmentStatus.COMPLETED, 1))).label("completed"),
            func.count(case((Appointment.status == AppointmentStatus.CANCELLED, 1))).label("cancelled"),
            func.max(Appointment.appointment_date).label("last_date"),
        )
        .group_by(Appointment.user_id)
        .subquery()
    )
    paid_stats = (
        db.query(
            Payment.user_id.label("user_id"),
            func.sum(Payment.amount).label("paid"),
        )
        .filter(Payment.status == PaymentStatus.APPROVED)
        .group_by(Payment.user_id)
        .subquery()
    )

    query = (
        db.query(
            User,
            appointment_stats.c.total,
            appointment_stats.c.completed,
            appointment_stats.c.cancelled,
            appointment_stats.c.last_date,
            paid_stats.c.paid,
        )
        .outerjoin(appointment_stats, appointment_stats.c.user_id == User.id)
        .outerjoin(paid_stats, paid_stats.c.user_id == User.id)
        .filter(User.is_admin == False)
    )
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    term = (search or "").strip()
    if term:
        pattern = f"%{term}%"
        conditions = [User.full_name.ilike(pattern), User.email.ilike(pattern), User.phone.ilike(pattern)]
        digits = _digits(term)
        if len(digits) >= MIN_PHONE_DIGITS_SEARCH:
            conditions.append(_phone_digits_match(User.phone, digits))
        query = query.filter(or_(*conditions))

    rows = query.order_by(User.created_at.desc(), User.id.desc()).offset(skip).limit(limit).all()
    return [
        ClientSummary(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            phone=user.phone,
            is_active=user.is_active,
            created_at=user.created_at,
            appointments_count=total or 0,
            completed_count=completed or 0,
            cancelled_count=cancelled or 0,
            last_appointment_date=last_date,
            total_paid=float(paid or 0),
        )
        for user, total, completed, cancelled, last_date, paid in rows
    ]


@router.get("/reports/yearly", response_model=YearlyReport)
def get_yearly_report(
    year: int = Query(..., ge=2020, le=2100),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Reporte anual (meses en hora del studio): ingresos por mes, turnos por mes y estado,
    servicios más demandados y medios de pago.

    - Ingresos: pagos aprobados según su fecha de aprobación.
    - Turnos: según la fecha del turno.
    """
    year_start, year_end = _studio_month_bounds(year, 1)[0], _studio_month_bounds(year, 12)[1]
    year_start_aware, year_end_aware = year_start.replace(tzinfo=timezone.utc), year_end.replace(tzinfo=timezone.utc)

    months: List[MonthSummary] = []
    for month in range(1, 13):
        start, end, start_aware, end_aware = _studio_month_bounds(year, month)
        revenue, payments_count = db.query(
            func.coalesce(func.sum(Payment.amount), 0), func.count(Payment.id)
        ).filter(
            Payment.status == PaymentStatus.APPROVED,
            Payment.approved_at >= start_aware,
            Payment.approved_at < end_aware,
        ).one()
        total, completed, cancelled = db.query(
            func.count(Appointment.id),
            func.count(case((Appointment.status == AppointmentStatus.COMPLETED, 1))),
            func.count(case((Appointment.status == AppointmentStatus.CANCELLED, 1))),
        ).filter(
            Appointment.appointment_date >= start,
            Appointment.appointment_date < end,
        ).one()
        months.append(MonthSummary(
            month=month,
            revenue=float(revenue or 0),
            payments_count=payments_count or 0,
            appointments_count=total or 0,
            completed_count=completed or 0,
            cancelled_count=cancelled or 0,
        ))

    in_year = and_(Appointment.appointment_date >= year_start, Appointment.appointment_date < year_end)
    by_status = dict(
        db.query(Appointment.status, func.count(Appointment.id)).filter(in_year).group_by(Appointment.status).all()
    )

    top_services = (
        db.query(
            Service.name,
            func.count(Appointment.id).label("appointments_count"),
            func.coalesce(func.sum(Payment.amount), 0).label("revenue"),
        )
        .join(Appointment, Appointment.service_id == Service.id)
        .outerjoin(Payment, and_(Payment.appointment_id == Appointment.id, Payment.status == PaymentStatus.APPROVED))
        .filter(in_year, Appointment.status != AppointmentStatus.CANCELLED)
        .group_by(Service.name)
        .order_by(func.count(Appointment.id).desc(), Service.name)
        .limit(10)
        .all()
    )

    methods = (
        db.query(Payment.payment_method, func.count(Payment.id), func.coalesce(func.sum(Payment.amount), 0))
        .filter(
            Payment.status == PaymentStatus.APPROVED,
            Payment.approved_at >= year_start_aware,
            Payment.approved_at < year_end_aware,
        )
        .group_by(Payment.payment_method)
        .all()
    )

    new_clients = db.query(func.count(User.id)).filter(
        User.is_admin == False,
        User.created_at >= year_start_aware,
        User.created_at < year_end_aware,
    ).scalar() or 0

    total_revenue = sum(month.revenue for month in months)
    total_payments = sum(month.payments_count for month in months)
    return YearlyReport(
        year=year,
        total_revenue=total_revenue,
        total_payments=total_payments,
        average_ticket=round(total_revenue / total_payments, 2) if total_payments else 0,
        total_appointments=sum(month.appointments_count for month in months),
        appointments_by_status={status.value: count for status, count in by_status.items()},
        new_clients=new_clients,
        months=months,
        top_services=[
            ServiceRanking(name=name, appointments_count=count, revenue=float(revenue or 0))
            for name, count, revenue in top_services
        ],
        payment_methods=[
            PaymentMethodSummary(method=method.value, count=count, amount=float(amount or 0))
            for method, count, amount in methods
        ],
    )


@router.get("/reports/monthly")
def get_monthly_report(
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
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
    # Inicio y fin del mes en hora del studio (naive UTC para turnos, aware para pagos/usuarios)
    month_start, month_end, month_start_aware, month_end_aware = _studio_month_bounds(year, month)
    
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
            Payment.approved_at >= month_start_aware,
            Payment.approved_at < month_end_aware,
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
            Payment.approved_at >= month_start_aware,
            Payment.approved_at < month_end_aware,
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
            User.created_at >= month_start_aware,
            User.created_at < month_end_aware
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