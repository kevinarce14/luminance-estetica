# app/services/payment_service.py
"""
Servicio de pagos con MercadoPago.
Maneja la creación de preferencias y consulta de pagos.
"""

import mercadopago
from typing import Dict, Any

from app.core.config import settings


class PaymentService:
    """
    Servicio para gestionar pagos con MercadoPago.
    """

    def __init__(self):
        # Inicializar SDK de MercadoPago
        self.sdk = mercadopago.SDK(settings.MERCADOPAGO_ACCESS_TOKEN)
        self.public_key = settings.MERCADOPAGO_PUBLIC_KEY

    def create_preference(
        self,
        appointment_id: int,
        amount: float,
        title: str,
        description: str = "",
    ) -> Dict[str, Any]:
        """
        Crea una preferencia de pago en MercadoPago.

        Args:
            appointment_id: ID del turno (se usa como external_reference)
            amount: Monto a cobrar
            title: Título del pago
            description: Descripción adicional

        Returns:
            Dict con los datos de la preferencia creada, incluyendo:
            - id: ID de la preferencia
            - init_point: URL de checkout web
            - sandbox_init_point: URL de checkout sandbox (testing)

        Raises:
            Exception: Si hay error creando la preferencia
        """
        preference_data = {
            "items": [
                {
                    "title": title,
                    "description": description,
                    "quantity": 1,
                    "unit_price": float(amount),
                    "currency_id": "ARS",
                }
            ],
            "payer": {
                "email": "cliente@example.com",  # Opcional
            },
            "back_urls": {
                "success": settings.PAYMENT_SUCCESS_URL,
                "failure": settings.PAYMENT_FAILURE_URL,
                "pending": settings.PAYMENT_PENDING_URL,
            },
            "auto_return": "approved",
            "external_reference": str(appointment_id),
            "statement_descriptor": "LUMINANCE STUDIO",
            "notification_url": f"{settings.FRONTEND_URL}/api/v1/payments/webhook",
            "expires": False,  # La preferencia no expira
        }

        try:
            preference_response = self.sdk.preference().create(preference_data)
            preference = preference_response["response"]

            print(f"✅ Preferencia creada: {preference.get('id')}")

            return preference

        except Exception as e:
            print(f"❌ Error creando preferencia de MercadoPago: {str(e)}")
            raise Exception(f"Error creando preferencia de pago: {str(e)}")

    def get_payment_info(self, payment_id: str) -> Dict[str, Any]:
        """
        Obtiene información de un pago por su ID.

        Args:
            payment_id: ID del pago en MercadoPago

        Returns:
            Dict con la información del pago:
            - id: ID del pago
            - status: Estado (approved, rejected, etc.)
            - status_detail: Detalle del estado
            - external_reference: Referencia externa (appointment_id)
            - transaction_amount: Monto
            - date_approved: Fecha de aprobación

        Raises:
            Exception: Si hay error consultando el pago
        """
        try:
            payment_response = self.sdk.payment().get(payment_id)
            payment = payment_response["response"]

            print(f"✅ Pago consultado: {payment_id} - Status: {payment.get('status')}")

            return payment

        except Exception as e:
            print(f"❌ Error consultando pago de MercadoPago: {str(e)}")
            raise Exception(f"Error consultando pago: {str(e)}")

    def refund_payment(self, payment_id: str) -> Dict[str, Any]:
        """
        Realiza un reembolso total de un pago.

        Args:
            payment_id: ID del pago a reembolsar

        Returns:
            Dict con la información del reembolso

        Raises:
            Exception: Si hay error procesando el reembolso
        """
        try:
            refund_response = self.sdk.refund().create(payment_id)
            refund = refund_response["response"]

            print(f"✅ Reembolso procesado para pago: {payment_id}")

            return refund

        except Exception as e:
            print(f"❌ Error procesando reembolso: {str(e)}")
            raise Exception(f"Error procesando reembolso: {str(e)}")

    def get_payment_methods(self) -> Dict[str, Any]:
        """
        Obtiene los métodos de pago disponibles.

        Returns:
            Dict con los métodos de pago disponibles
        """
        try:
            payment_methods_response = self.sdk.payment_methods().list_all()
            payment_methods = payment_methods_response["response"]

            return payment_methods

        except Exception as e:
            print(f"❌ Error obteniendo métodos de pago: {str(e)}")
            return {}

    def check_payment_status(self, payment_id: str) -> str:
        """
        Verifica el estado de un pago de forma rápida.

        Args:
            payment_id: ID del pago

        Returns:
            Estado del pago: "approved", "rejected", "pending", etc.
        """
        try:
            payment_info = self.get_payment_info(payment_id)
            return payment_info.get("status", "unknown")
        except Exception:
            return "error"


# Instancia global
payment_service = PaymentService()