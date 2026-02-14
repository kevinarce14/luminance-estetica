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
        
        # Construir URLs completas con query params
        success_url = f"{settings.PAYMENT_SUCCESS_URL}?external_reference={appointment_id}"
        failure_url = f"{settings.PAYMENT_FAILURE_URL}?external_reference={appointment_id}"
        pending_url = f"{settings.PAYMENT_PENDING_URL}?external_reference={appointment_id}"
        
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
                "email": "cliente@example.com",
            },
            "back_urls": {
                "success": success_url,
                "failure": failure_url,
                "pending": pending_url,
            },
            # ✅ SOLUCIÓN: NO usar auto_return en localhost
            # MercadoPago lo rechaza en modo test con localhost
            # El usuario debe hacer click en "Volver al sitio"
            # "auto_return": "approved",  ← COMENTADO / ELIMINADO
            
            "external_reference": str(appointment_id),
            "statement_descriptor": "LUMINANCE STUDIO",
            "notification_url": None,
            "expires": False,
            "payment_methods": {
                "excluded_payment_types": [],
                "installments": 12,
            },
            "metadata": {
                "appointment_id": appointment_id
            }
        }

        try:
            print(f"🔍 Creando preferencia MP para appointment {appointment_id}")
            print(f"   Amount: ${amount}")
            print(f"   Success URL: {success_url}")
            
            preference_response = self.sdk.preference().create(preference_data)

            http_status = preference_response.get("status")
            preference  = preference_response.get("response", {}) or {}

            print(f"📡 MP http_status: {http_status}")

            if http_status != 201:
                error_msg = preference.get("message", "Error desconocido de MercadoPago")
                error_detail = preference.get("error", "")
                full_error = f"{error_msg} ({error_detail})" if error_detail else error_msg
                print(f"❌ Error MP: {full_error}")
                raise Exception(f"MercadoPago error {http_status}: {full_error}")

            if not preference.get("id"):
                raise Exception("MercadoPago no devolvió un ID de preferencia válido")

            print(f"✅ Preferencia creada: {preference.get('id')}")
            print(f"🔗 Sandbox init_point: {preference.get('sandbox_init_point')}")

            return preference

        except Exception as e:
            print(f"❌ Error creando preferencia: {str(e)}")
            raise Exception(f"Error creando preferencia de pago: {str(e)}")

    def get_payment_info(self, payment_id: str) -> Dict[str, Any]:
        """
        Obtiene información de un pago por su ID.

        Args:
            payment_id: ID del pago en MercadoPago

        Returns:
            Dict con la información del pago

        Raises:
            Exception: Si hay error consultando el pago
        """
        try:
            payment_response = self.sdk.payment().get(payment_id)
            payment = payment_response["response"]

            print(f"✅ Pago consultado: {payment_id} - Status: {payment.get('status')}")

            return payment

        except Exception as e:
            print(f"❌ Error consultando pago: {str(e)}")
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