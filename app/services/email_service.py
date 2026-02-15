# app/services/email_service.py
"""
Servicio de emails usando SendGrid o Resend.
Maneja todos los emails transaccionales del sistema.
"""

import os
from typing import Dict
from datetime import datetime

from app.core.config import settings


class EmailService:
    """
    Servicio para enviar emails.
    Soporta SendGrid y Resend.
    """

    def __init__(self):
        self.email_service = settings.EMAIL_SERVICE.lower()
        self.from_email = settings.FROM_EMAIL
        self.from_name = settings.FROM_NAME
        self.studio_email = settings.STUDIO_EMAIL

        # Configurar el servicio correspondiente
        if self.email_service == "sendgrid":
            self.sendgrid_key = settings.SENDGRID_API_KEY
            if not self.sendgrid_key:
                print("⚠️  SENDGRID_API_KEY no configurada")
        elif self.email_service == "resend":
            self.resend_key = settings.RESEND_API_KEY
            if not self.resend_key:
                print("⚠️  RESEND_API_KEY no configurada")
        else:
            print(f"⚠️  EMAIL_SERVICE '{self.email_service}' no reconocido")

    # ========== TEMPLATES HTML ==========

    def _get_base_template(self, content: str, preheader: str = "") -> str:
        """Template base para todos los emails"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{
                    font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: linear-gradient(135deg, #f8d7e6 0%, #f4f0ff 100%);
                    margin: 0;
                    padding: 20px;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    background: linear-gradient(135deg, #f8d7e6 0%, #f4f0ff 100%);
                    padding: 40px 30px;
                    text-align: center;
                }}
                .header h1 {{
                    font-family: 'Playfair Display', serif;
                    font-size: 32px;
                    margin: 0;
                    color: #2d3436;
                }}
                .header .tagline {{
                    font-size: 14px;
                    color: #636e72;
                    margin-top: 10px;
                }}
                .content {{
                    padding: 40px 30px;
                    line-height: 1.8;
                    color: #2d3436;
                }}
                .button {{
                    display: inline-block;
                    background: linear-gradient(135deg, #e75480, #9c89b8);
                    color: white !important;
                    padding: 15px 40px;
                    border-radius: 50px;
                    text-decoration: none;
                    font-weight: 600;
                    margin: 20px 0;
                }}
                .footer {{
                    background: #f8f9fa;
                    padding: 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #636e72;
                }}
                .divider {{
                    height: 1px;
                    background: linear-gradient(90deg, transparent, #e9ecef, transparent);
                    margin: 30px 0;
                }}
            </style>
        </head>
        <body>
            <span style="display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0;">
                {preheader}
            </span>
            <div class="container">
                <div class="header">
                    <h1>Luminance Studio</h1>
                    <div class="tagline">by Cande</div>
                </div>
                <div class="content">
                    {content}
                </div>
                <div class="footer">
                    <strong>LUMINANCE STUDIO BY CANDE</strong><br>
                    {self.studio_email}<br>
                    Don Torcuato, Buenos Aires, Argentina<br>
                    Instagram: @luminance_studio
                    <div style="margin-top: 15px; font-size: 11px; color: #999;">
                        Este email fue enviado automáticamente. Por favor no respondas a este mensaje.
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

    def _get_welcome_content(self, user_name: str) -> str:
        """Template de bienvenida"""
        return f"""
        <h2 style="color: #e75480;">¡Bienvenida a Luminance Studio, {user_name}!</h2>
        <p>
            Estamos emocionadas de tenerte con nosotras. En Luminance Studio, nos especializamos 
            en realzar tu belleza natural con tratamientos profesionales de pestañas, cejas, 
            depilación láser y estética corporal.
        </p>
        <div class="divider"></div>
        <h3>¿Qué puedes hacer ahora?</h3>
        <ul style="line-height: 2;">
            <li>✨ Explorar nuestros servicios</li>
            <li>📅 Reservar tu primer turno online</li>
            <li>💫 Consultar disponibilidad en tiempo real</li>
            <li>💳 Pagar de forma segura con MercadoPago</li>
        </ul>
        <div style="text-align: center;">
            <a href="{settings.FRONTEND_URL}" class="button">Reservar mi primer turno</a>
        </div>
        <p style="margin-top: 30px; font-size: 14px; color: #636e72;">
            Si tienes alguna pregunta, no dudes en contactarnos por WhatsApp o Instagram.
        </p>
        """

    def _get_appointment_confirmation_content(
        self, user_name: str, service_name: str, appointment_date: datetime
    ) -> str:
        """Template de confirmación de turno"""
        date_str = appointment_date.strftime("%d/%m/%Y")
        time_str = appointment_date.strftime("%H:%M")

        return f"""
        <h2 style="color: #9c89b8;">✅ Turno Confirmado</h2>
        <p>Hola {user_name},</p>
        <p>
            Tu turno ha sido reservado exitosamente. Te esperamos con muchas ganas 
            de cuidarte y hacerte sentir increíble.
        </p>
        <div style="background: linear-gradient(135deg, #f8d7e6 0%, #f4f0ff 100%); 
                    padding: 25px; border-radius: 15px; margin: 25px 0;">
            <p style="margin: 5px 0;"><strong>Servicio:</strong> {service_name}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> {date_str}</p>
            <p style="margin: 5px 0;"><strong>Hora:</strong> {time_str} hs</p>
        </div>
        <h3>Importante:</h3>
        <ul style="line-height: 2;">
            <li>🕐 Por favor llega con 5 minutos de anticipación</li>
            <li>💄 Si es lifting de pestañas, no uses máscara el día del turno</li>
            <li>📱 Si necesitas cancelar o reprogramar, hazlo con al menos 24hs de anticipación</li>
        </ul>
        <p style="margin-top: 30px;">
            ¿Tienes alguna consulta? Contáctanos por WhatsApp o Instagram.
        </p>
        """

    def _get_appointment_cancellation_content(
        self, user_name: str, service_name: str, appointment_date: datetime
    ) -> str:
        """Template de cancelación de turno"""
        date_str = appointment_date.strftime("%d/%m/%Y a las %H:%M")

        return f"""
        <h2 style="color: #636e72;">Turno Cancelado</h2>
        <p>Hola {user_name},</p>
        <p>
            Tu turno de <strong>{service_name}</strong> para el <strong>{date_str}</strong> 
            ha sido cancelado exitosamente.
        </p>
        <p>
            Esperamos verte pronto. Puedes reservar un nuevo turno cuando lo desees.
        </p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{settings.FRONTEND_URL}" class="button">Reservar nuevo turno</a>
        </div>
        """

    def _get_payment_confirmation_content(
        self, user_name: str, service_name: str, amount: float, appointment_date: datetime
    ) -> str:
        """Template de confirmación de pago"""
        date_str = appointment_date.strftime("%d/%m/%Y a las %H:%M")

        return f"""
        <h2 style="color: #28a745;">💚 Pago Confirmado</h2>
        <p>Hola {user_name},</p>
        <p>
            Recibimos tu pago exitosamente. Tu turno está 100% confirmado.
        </p>
        <div style="background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); 
                    padding: 25px; border-radius: 15px; margin: 25px 0;">
            <p style="margin: 5px 0;"><strong>Servicio:</strong> {service_name}</p>
            <p style="margin: 5px 0;"><strong>Monto pagado:</strong> ${amount:,.2f}</p>
            <p style="margin: 5px 0;"><strong>Turno:</strong> {date_str}</p>
        </div>
        <p>
            ¡Te esperamos! Nos vemos pronto en Luminance Studio ✨
        </p>
        """

    def _get_password_reset_content(self, user_name: str, reset_token: str) -> str:
        """Template de reseteo de contraseña"""
        # ✅ Apunta a login.html?token= donde el frontend detecta el token automáticamente
        reset_link = f"{settings.FRONTEND_URL}/login.html?token={reset_token}"

        return f"""
        <h2 style="color: #e75480;">Recuperar Contraseña</h2>
        <p>Hola {user_name},</p>
        <p>
            Recibimos una solicitud para restablecer tu contraseña. Si no fuiste vos, 
            podés ignorar este email sin problema.
        </p>
        <p>Hacé click en el botón para crear una nueva contraseña:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}" class="button">Restablecer Contraseña</a>
        </div>
        <p style="font-size: 13px; color: #636e72;">
            O copiá este link en tu navegador:<br>
            <span style="word-break: break-all; color: #9c89b8;">{reset_link}</span>
        </p>
        <p style="font-size: 12px; color: #999; margin-top: 20px;">
            ⏱ Este link expira en 1 hora.
        </p>
        """

    def _get_password_changed_content(self, user_name: str) -> str:
        """Template de contraseña cambiada"""
        return f"""
        <h2 style="color: #28a745;">✅ Contraseña Actualizada</h2>
        <p>Hola {user_name},</p>
        <p>
            Tu contraseña ha sido cambiada exitosamente.
        </p>
        <p>
            Si no realizaste este cambio, por favor contáctanos inmediatamente.
        </p>
        """

    def _get_appointment_reminder_content(
        self, user_name: str, service_name: str, appointment_date: datetime
    ) -> str:
        """Template de recordatorio de turno"""
        date_str = appointment_date.strftime("%d/%m/%Y")
        time_str = appointment_date.strftime("%H:%M")

        return f"""
        <h2 style="color: #9c89b8;">🔔 Recordatorio de Turno</h2>
        <p>Hola {user_name},</p>
        <p>
            Te recordamos que mañana tienes turno en Luminance Studio:
        </p>
        <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); 
                    padding: 25px; border-radius: 15px; margin: 25px 0;">
            <p style="margin: 5px 0;"><strong>Servicio:</strong> {service_name}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> {date_str}</p>
            <p style="margin: 5px 0;"><strong>Hora:</strong> {time_str} hs</p>
        </div>
        <p>
            ¡Te esperamos! Por favor llega con 5 minutos de anticipación.
        </p>
        <p style="font-size: 14px; color: #636e72;">
            Si necesitas cancelar o reprogramar, hazlo con anticipación para que 
            otra persona pueda aprovechar el horario.
        </p>
        """

    # ========== MÉTODOS DE ENVÍO ==========

    def _send_with_sendgrid(self, to_email: str, subject: str, html_content: str) -> bool:
        """Envía email usando SendGrid"""
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail, Email, To, Content

            print(f"📡 [SendGrid] Enviando a: {to_email}")
            print(f"📡 [SendGrid] Asunto: {subject}")
            print(f"📡 [SendGrid] From: {self.from_email}")
            print(f"📡 [SendGrid] API Key: {self.sendgrid_key[:20]}...")

            message = Mail(
                from_email=Email(self.from_email, self.from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content),
            )

            sg = SendGridAPIClient(self.sendgrid_key)
            response = sg.send(message)

            print(f"✅ [SendGrid] Status: {response.status_code}")
            return True

        except Exception as e:
            print(f"❌ [SendGrid] {type(e).__name__}: {str(e)}")
            if hasattr(e, 'body'):
                print(f"❌ [SendGrid] Body: {e.body}")
            if hasattr(e, 'status_code'):
                print(f"❌ [SendGrid] HTTP Status: {e.status_code}")
            return False

    def _send_with_resend(self, to_email: str, subject: str, html_content: str) -> bool:
        """Envía email usando Resend"""
        try:
            import resend

            resend.api_key = self.resend_key

            params = {
                "from": f"{self.from_name} <{self.from_email}>",
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            }

            email = resend.Emails.send(params)
            print(f"✅ Email enviado a {to_email} (Resend: {email.get('id')})")
            return True

        except Exception as e:
            print(f"❌ Error enviando email con Resend: {str(e)}")
            return False

    def _send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Método genérico para enviar email"""
        if self.email_service == "sendgrid":
            return self._send_with_sendgrid(to_email, subject, html_content)
        elif self.email_service == "resend":
            return self._send_with_resend(to_email, subject, html_content)
        else:
            print(f"❌ Servicio de email '{self.email_service}' no configurado")
            return False

    # ========== MÉTODOS PÚBLICOS ==========

    def send_welcome_email(self, to_email: str, user_name: str) -> bool:
        """Envía email de bienvenida a nuevo usuario"""
        content = self._get_welcome_content(user_name)
        html = self._get_base_template(content, "Bienvenida a Luminance Studio")
        return self._send_email(to_email, "¡Bienvenida a Luminance Studio! ✨", html)

    def send_appointment_confirmation(
        self, to_email: str, user_name: str, service_name: str, appointment_date: datetime
    ) -> bool:
        """Envía email de confirmación de turno"""
        content = self._get_appointment_confirmation_content(
            user_name, service_name, appointment_date
        )
        html = self._get_base_template(content, "Tu turno ha sido confirmado")
        return self._send_email(to_email, f"✅ Turno Confirmado - {service_name}", html)

    def send_appointment_cancellation(
        self, to_email: str, user_name: str, service_name: str, appointment_date: datetime
    ) -> bool:
        """Envía email de cancelación de turno"""
        content = self._get_appointment_cancellation_content(
            user_name, service_name, appointment_date
        )
        html = self._get_base_template(content, "Turno cancelado")
        return self._send_email(to_email, f"Turno Cancelado - {service_name}", html)

    def send_payment_confirmation(
        self,
        to_email: str,
        user_name: str,
        service_name: str,
        amount: float,
        appointment_date: datetime,
    ) -> bool:
        """Envía email de confirmación de pago"""
        content = self._get_payment_confirmation_content(
            user_name, service_name, amount, appointment_date
        )
        html = self._get_base_template(content, "Pago confirmado")
        return self._send_email(to_email, f"💚 Pago Confirmado - ${amount:,.2f}", html)

    def send_password_reset_email(
        self, to_email: str, user_name: str, reset_token: str
    ) -> bool:
        """Envía email con link para resetear contraseña"""
        print(f"🔐 [PasswordReset] Iniciando envío a: {to_email} | usuario: {user_name}")
        print(f"🔐 [PasswordReset] Token (primeros 20 chars): {reset_token[:20]}...")
        content = self._get_password_reset_content(user_name, reset_token)
        html = self._get_base_template(content, "Recuperá tu contraseña")
        result = self._send_email(to_email, "Recuperar Contraseña - Luminance Studio", html)
        print(f"🔐 [PasswordReset] Resultado envío: {'✅ OK' if result else '❌ FALLÓ'}")
        return result

    def send_password_changed_email(self, to_email: str, user_name: str) -> bool:
        """Envía email confirmando cambio de contraseña"""
        content = self._get_password_changed_content(user_name)
        html = self._get_base_template(content, "Contraseña actualizada")
        return self._send_email(to_email, "✅ Contraseña Actualizada", html)

    def send_appointment_reminder(
        self, to_email: str, user_name: str, service_name: str, appointment_date: datetime
    ) -> bool:
        """Envía recordatorio de turno (24h antes)"""
        content = self._get_appointment_reminder_content(
            user_name, service_name, appointment_date
        )
        html = self._get_base_template(content, "Recordatorio de turno mañana")
        return self._send_email(to_email, f"🔔 Recordatorio: Turno Mañana - {service_name}", html)


# Instancia global
email_service = EmailService()