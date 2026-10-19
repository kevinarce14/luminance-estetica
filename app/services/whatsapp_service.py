# app/services/whatsapp_service.py
"""
Servicio de WhatsApp usando Twilio.
Envía notificaciones y confirmaciones por WhatsApp.
"""

from typing import Optional
from datetime import datetime

from app.core.config import settings
from app.core.time_utils import to_studio_time


class WhatsAppService:
    """
    Servicio para enviar mensajes de WhatsApp usando Twilio.
    """

    def __init__(self):
        self.enabled = all([
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_AUTH_TOKEN,
            settings.TWILIO_WHATSAPP_NUMBER,
        ])

        if self.enabled:
            try:
                from twilio.rest import Client

                self.client = Client(
                    settings.TWILIO_ACCOUNT_SID,
                    settings.TWILIO_AUTH_TOKEN
                )
                self.from_number = settings.TWILIO_WHATSAPP_NUMBER
                print("✅ WhatsApp service inicializado con Twilio")
            except ImportError:
                print("⚠️  Twilio no instalado. Instala con: pip install twilio")
                self.enabled = False
            except Exception as e:
                print(f"⚠️  Error inicializando Twilio: {str(e)}")
                self.enabled = False
        else:
            print("⚠️  WhatsApp service deshabilitado (falta configuración de Twilio)")

    def _format_phone(self, phone: str) -> str:
        """
        Formatea número de teléfono para WhatsApp.
        
        Args:
            phone: Número de teléfono (puede incluir +, espacios, guiones)
            
        Returns:
            Número en formato whatsapp:+5491123456789
        """
        # Limpiar el número
        cleaned = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        
        # Si no empieza con +, asumir Argentina
        if not cleaned.startswith("+"):
            if cleaned.startswith("54"):
                cleaned = "+" + cleaned
            elif cleaned.startswith("11") or cleaned.startswith("9"):
                cleaned = "+54" + cleaned
            else:
                cleaned = "+549" + cleaned
        
        return f"whatsapp:{cleaned}"

    def send_message(self, to_phone: str, message: str) -> bool:
        """
        Envía un mensaje de WhatsApp.
        
        Args:
            to_phone: Número de teléfono destino
            message: Mensaje a enviar
            
        Returns:
            True si se envió exitosamente, False si no
        """
        if not self.enabled:
            print("⚠️  WhatsApp service no está habilitado")
            return False

        try:
            to_number = self._format_phone(to_phone)

            message_response = self.client.messages.create(
                from_=self.from_number,
                body=message,
                to=to_number
            )

            print(f"✅ WhatsApp enviado a {to_phone} (SID: {message_response.sid})")
            return True

        except Exception as e:
            print(f"❌ Error enviando WhatsApp a {to_phone}: {str(e)}")
            return False

    def send_appointment_confirmation(
        self,
        to_phone: str,
        user_name: str,
        service_name: str,
        appointment_date: datetime
    ) -> bool:
        """
        Envía confirmación de turno por WhatsApp.
        """
        date_str = to_studio_time(appointment_date).strftime("%d/%m/%Y")
        time_str = to_studio_time(appointment_date).strftime("%H:%M")

        message = f"""
✨ *Luminance Studio by Cande* ✨

Hola {user_name}! 👋

Tu turno ha sido confirmado:

📅 *Servicio:* {service_name}
📆 *Fecha:* {date_str}
🕐 *Hora:* {time_str} hs

Por favor llega con 5 minutos de anticipación.

Si necesitas cancelar o reprogramar, avísanos con 24hs de anticipación.

¡Te esperamos! 💅
        """.strip()

        return self.send_message(to_phone, message)

    def send_appointment_reminder(
        self,
        to_phone: str,
        user_name: str,
        service_name: str,
        appointment_date: datetime
    ) -> bool:
        """
        Envía recordatorio de turno por WhatsApp (24h antes).
        """
        time_str = to_studio_time(appointment_date).strftime("%H:%M")

        message = f"""
🔔 *Recordatorio de Turno* 🔔

Hola {user_name}!

Te recordamos que mañana tienes turno en Luminance Studio:

💅 *Servicio:* {service_name}
🕐 *Hora:* {time_str} hs

¡Te esperamos! ✨

_Luminance Studio by Cande_
        """.strip()

        return self.send_message(to_phone, message)

    def send_payment_confirmation(
        self,
        to_phone: str,
        user_name: str,
        amount: float,
        service_name: str
    ) -> bool:
        """
        Envía confirmación de pago por WhatsApp.
        """
        message = f"""
💚 *Pago Confirmado* 💚

Hola {user_name}!

Recibimos tu pago exitosamente:

💰 *Monto:* ${amount:,.2f}
💅 *Servicio:* {service_name}

Tu turno está 100% confirmado.

¡Nos vemos pronto! ✨

_Luminance Studio by Cande_
        """.strip()

        return self.send_message(to_phone, message)

    def send_appointment_cancellation(
        self,
        to_phone: str,
        user_name: str,
        service_name: str
    ) -> bool:
        """
        Envía notificación de cancelación por WhatsApp.
        """
        message = f"""
Hola {user_name},

Tu turno de *{service_name}* ha sido cancelado.

Esperamos verte pronto. Puedes reservar un nuevo turno cuando lo desees.

_Luminance Studio by Cande_
✨ Instagram: @luminance_studio
        """.strip()

        return self.send_message(to_phone, message)


# Instancia global
whatsapp_service = WhatsAppService()