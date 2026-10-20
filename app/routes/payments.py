# app/routes/payments.py
"""
Endpoints para gestión de pagos con MercadoPago.
"""

from app.core.time_utils import utc_now
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.routes.deps import get_current_user, get_current_admin
from app.models.user import User
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.appointment import Appointment, AppointmentStatus
from app.schemas.payment import (
    ManualPaymentRequest,
    PaymentCreate,
    PaymentResponse,
    MercadoPagoPreference,
    MercadoPagoWebhook,
    PaymentStatusUpdate
)
from app.services.payment_service import payment_service
from app.services.email_service import email_service


# Transiciones manuales permitidas desde el panel admin
ALLOWED_PAYMENT_TRANSITIONS = {
    PaymentStatus.PENDING: {PaymentStatus.APPROVED, PaymentStatus.REJECTED, PaymentStatus.CANCELLED},
    PaymentStatus.APPROVED: {PaymentStatus.REFUNDED},
}

router = APIRouter(prefix="/payments", tags=["Pagos"])


def _send_payment_confirmation_email(db: Session, appointment: Appointment, payment: Payment) -> None:
    """Envía email de confirmación de pago/turno al cliente."""
    user = db.query(User).filter(User.id == appointment.user_id).first()
    if not user:
        print(f"⚠️ No se encontró usuario para appointment_id={appointment.id}")
        return
    service_name = appointment.service.name if appointment.service else "Servicio"
    sent = email_service.send_payment_confirmation(
        to_email=user.email,
        user_name=user.full_name,
        service_name=service_name,
        amount=payment.amount,
        appointment_date=appointment.appointment_date,
    )
    if sent:
        print(f"✅ Email de confirmación enviado a {user.email}")
    else:
        print(f"❌ Email de confirmación NO enviado a {user.email} (revisar EMAIL_SERVICE / API key)")


@router.post("/create-preference", response_model=MercadoPagoPreference)
def create_payment_preference(
    payment_data: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Crear una preferencia de pago en MercadoPago.
    
    Pasos:
    1. Verificar que el turno existe y pertenece al usuario
    2. Verificar que no tenga un pago pendiente/aprobado
    3. Crear preferencia en MercadoPago
    4. Guardar el pago en la BD con status PENDING
    5. Retornar URL de checkout
    
    Requiere autenticación.
    """
    # Verificar que el turno existe
    appointment = db.query(Appointment).filter(
        Appointment.id == payment_data.appointment_id
    ).first()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Turno no encontrado"
        )
    
    # Verificar que el turno pertenece al usuario
    if appointment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este turno no te pertenece"
        )
    
    # Verificar que no tenga un pago ya
    existing_payment = db.query(Payment).filter(
        Payment.appointment_id == appointment.id,
        Payment.status.in_([PaymentStatus.PENDING, PaymentStatus.APPROVED])
    ).first()
    
    if existing_payment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este turno ya tiene un pago asociado"
        )
    
    # Crear preferencia en MercadoPago
    try:
        preference_data = payment_service.create_preference(
            appointment_id=appointment.id,
            amount=payment_data.amount,
            title=f"Turno - {appointment.service.name}",
            description=f"Pago de turno #{appointment.id}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creando preferencia de pago: {str(e)}"
        )
    
    # Guardar pago en la BD
    db_payment = Payment(
        appointment_id=appointment.id,
        user_id=current_user.id,
        amount=payment_data.amount,
        currency=payment_data.currency,
        payment_method=payment_data.payment_method,
        status=PaymentStatus.PENDING,
        mercadopago_preference_id=preference_data.get("id"),
    )
    
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    
    return {
        "preference_id": preference_data.get("id"),
        "init_point": preference_data.get("init_point"),
        "sandbox_init_point": preference_data.get("sandbox_init_point")
    }


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def mercadopago_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Webhook de MercadoPago.
    
    MercadoPago llama a este endpoint cuando cambia el estado de un pago.
    
    **Este endpoint NO requiere autenticación** - Es llamado por MercadoPago.
    """
    # Obtener el body del request
    body = await request.json()
    
    # Log para debugging
    print(f"📩 Webhook recibido de MercadoPago: {body}")
    
    # Verificar que sea una notificación de pago
    if body.get("type") != "payment":
        return {"status": "ignored", "reason": "not a payment notification"}
    
    # Obtener ID del pago
    payment_id = body.get("data", {}).get("id")
    
    if not payment_id:
        return {"status": "error", "reason": "no payment id"}
    
    # Obtener info del pago desde MercadoPago
    try:
        payment_info = payment_service.get_payment_info(payment_id)
    except Exception as e:
        print(f"❌ Error obteniendo info del pago: {str(e)}")
        return {"status": "error", "reason": str(e)}
    
    # Buscar el pago en nuestra BD por external_reference (appointment_id)
    external_reference = payment_info.get("external_reference")
    
    if not external_reference:
        print("⚠️ Pago sin external_reference")
        return {"status": "error", "reason": "no external reference"}
    
    try:
        appointment_id = int(external_reference)
    except ValueError:
        print(f"⚠️ External reference inválido: {external_reference}")
        return {"status": "error", "reason": "invalid external reference"}
    
    # Buscar el pago en nuestra BD
    db_payment = db.query(Payment).filter(
        Payment.appointment_id == appointment_id
    ).first()
    
    if not db_payment:
        print(f"⚠️ Pago no encontrado para appointment_id: {appointment_id}")
        return {"status": "error", "reason": "payment not found"}
    
    # Actualizar estado del pago
    mp_status = payment_info.get("status")
    
    if mp_status == "approved":
        db_payment.status = PaymentStatus.APPROVED
        db_payment.approved_at = utc_now()
        
        # Marcar el turno como confirmado
        appointment = db.query(Appointment).filter(
            Appointment.id == appointment_id
        ).first()
        
        if appointment:
            appointment.status = AppointmentStatus.CONFIRMED
        
        # Enviar email de confirmación
        try:
            if appointment:
                _send_payment_confirmation_email(db, appointment, db_payment)
        except Exception as e:
            print(f"⚠️ Error enviando email de confirmación: {str(e)}")
    
    elif mp_status == "rejected":
        db_payment.status = PaymentStatus.REJECTED
        db_payment.error_message = payment_info.get("status_detail")
    
    elif mp_status == "cancelled":
        db_payment.status = PaymentStatus.CANCELLED
    
    elif mp_status == "refunded":
        db_payment.status = PaymentStatus.REFUNDED
    
    # Guardar ID de pago de MercadoPago
    db_payment.mercadopago_id = str(payment_id)
    db_payment.transaction_id = payment_info.get("id")
    
    db.commit()
    
    print(f"✅ Pago actualizado: {db_payment.id} - Status: {db_payment.status}")
    
    return {"status": "ok"}


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtener detalles de un pago.
    
    Requiere autenticación.
    """
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    # Verificar permisos
    if payment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para ver este pago"
        )
    
    return payment


@router.get("/", response_model=List[PaymentResponse])
def list_my_payments(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Listar pagos del usuario actual.
    
    Requiere autenticación.
    """
    payments = (
        db.query(Payment)
        .filter(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    return payments


# ========== ENDPOINTS DE ADMIN ==========


@router.get("/all/payments", response_model=List[PaymentResponse])
def list_all_payments(
    skip: int = 0,
    limit: int = 100,
    status_filter: str | None = None,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Listar todos los pagos (solo admin).
    
    Query params:
    - **skip**: Paginación
    - **limit**: Límite
    - **status_filter**: Filtrar por estado
    
    Requiere permisos de administrador.
    """
    query = db.query(Payment)
    
    if status_filter:
        query = query.filter(Payment.status == status_filter)
    
    payments = (
        query
        .order_by(Payment.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    return payments


@router.put("/{payment_id}/status", response_model=PaymentResponse)
def update_payment_status(
    payment_id: int,
    status_update: PaymentStatusUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Actualizar estado de un pago manualmente (solo admin).
    
    Útil para marcar pagos en efectivo o transferencia como aprobados.
    
    Requiere permisos de administrador.
    """
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado"
        )
    
    new_status = status_update.status
    if new_status == payment.status:
        return payment
    if new_status not in ALLOWED_PAYMENT_TRANSITIONS.get(payment.status, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede pasar un pago de '{payment.status.value}' a '{new_status.value}'"
        )

    appointment = db.query(Appointment).filter(Appointment.id == payment.appointment_id).first()
    if new_status == PaymentStatus.APPROVED and appointment and appointment.status == AppointmentStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede aprobar el pago de un turno cancelado"
        )

    payment.status = new_status
    if new_status == PaymentStatus.APPROVED:
        payment.approved_at = utc_now()
        payment.error_message = None
        if status_update.notes:
            payment.payment_details = status_update.notes
        # Confirmar el turno y notificar al cliente
        if appointment and appointment.status == AppointmentStatus.PENDING:
            appointment.status = AppointmentStatus.CONFIRMED
        if appointment:
            try:
                _send_payment_confirmation_email(db, appointment, payment)
            except Exception as e:
                print(f"⚠️ Error enviando email de confirmación: {str(e)}")
    elif new_status in (PaymentStatus.REJECTED, PaymentStatus.CANCELLED):
        payment.error_message = status_update.notes or "Rechazado por el administrador"
    elif status_update.notes:
        payment.payment_details = status_update.notes

    db.commit()
    db.refresh(payment)
    
    return payment


@router.post("/cash-payment", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_manual_payment(
    request: ManualPaymentRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Registrar un pago manual aprobado (efectivo en el estudio o transferencia bancaria).

    - Si el turno ya tiene un pago (por ej. una preferencia de MP pendiente) se reutiliza
      ese registro, porque cada turno tiene como máximo un pago.
    - Confirma el turno y envía el email de confirmación.

    Requiere permisos de administrador.
    """
    appointment = db.query(Appointment).filter(Appointment.id == request.appointment_id).first()
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Turno no encontrado"
        )
    if appointment.status == AppointmentStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede registrar un pago para un turno cancelado"
        )

    method = PaymentMethod.TRANSFER if request.payment_method == "transfer" else PaymentMethod.CASH
    details = " · ".join(
        part for part in [
            f"Comprobante: {request.reference}" if request.reference else None,
            request.notes,
        ] if part
    ) or None

    payment = db.query(Payment).filter(Payment.appointment_id == appointment.id).first()
    if payment and payment.status == PaymentStatus.APPROVED:
        # Ya estaba pago: solo asegurar que el turno quede confirmado
        if appointment.status == AppointmentStatus.PENDING:
            appointment.status = AppointmentStatus.CONFIRMED
            db.commit()
        db.refresh(payment)
        return payment

    if payment is None:
        payment = Payment(
            appointment_id=appointment.id,
            user_id=appointment.user_id,
            amount=appointment.service.price,
            currency="ARS",
        )
        db.add(payment)

    payment.payment_method = method
    payment.status = PaymentStatus.APPROVED
    payment.approved_at = utc_now()
    payment.error_message = None
    payment.payment_details = details

    if appointment.status == AppointmentStatus.PENDING:
        appointment.status = AppointmentStatus.CONFIRMED

    try:
        _send_payment_confirmation_email(db, appointment, payment)
    except Exception as e:
        print(f"⚠️ Error enviando email de confirmación: {str(e)}")

    db.commit()
    db.refresh(payment)
    return payment