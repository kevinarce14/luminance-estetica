"""
Entorno de prueba compartido por pytest (tests/conftest.py) y por el servidor de
E2E (tests/e2e_server.py).

Garantías de seguridad:
- La base es SIEMPRE la de TEST_DATABASE_URL (descartable): nunca la del .env.
- Todas las credenciales externas se vacían (las variables de entorno tienen
  prioridad sobre el .env en pydantic-settings).
- Email, MercadoPago y la verificación de Google se reemplazan por stubs locales.
"""

import importlib
import os
import re
from typing import Callable, Dict, List

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "Admin1234"
GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com"
MP_CHECKOUT_URL = "https://mercadopago.test/checkout"

MISSING_DATABASE_MESSAGE = (
    "Definí TEST_DATABASE_URL con una base PostgreSQL descartable "
    "(ej. postgresql://postgres:postgres@localhost:5432/luminance_test). "
    "Los tests borran y recrean el schema de la app."
)


def configure_test_environment(database_url: str, frontend_url: str = "http://localhost:5173") -> None:
    """Debe llamarse ANTES de importar cualquier módulo de `app`."""
    os.environ.update({
        "DATABASE_URL": database_url,
        "SECRET_KEY": "test-secret-key-no-usar-en-produccion",
        "ENVIRONMENT": "test",
        "DEBUG": "false",
        "ADMIN_EMAIL": ADMIN_EMAIL,
        "STUDIO_EMAIL": "studio@example.com",
        "INITIAL_ADMIN_EMAIL": ADMIN_EMAIL,
        "INITIAL_ADMIN_PASSWORD": ADMIN_PASSWORD,
        "INITIAL_ADMIN_NAME": "Cande Admin",
        "GOOGLE_CLIENT_ID": GOOGLE_CLIENT_ID,
        "MERCADOPAGO_ACCESS_TOKEN": "TEST-dummy",
        "MERCADOPAGO_PUBLIC_KEY": "",
        "EMAIL_SERVICE": "test-stub",
        "SENDGRID_API_KEY": "",
        "RESEND_API_KEY": "",
        "MAILJET_API_KEY_PUBLIC": "",
        "MAILJET_API_KEY_PRIVATE": "",
        "TWILIO_ACCOUNT_SID": "",
        "TWILIO_AUTH_TOKEN": "",
        "TWILIO_WHATSAPP_NUMBER": "",
        "SENTRY_DSN": "",
        "FRONTEND_URL": frontend_url,
        "BACKEND_URL": "http://testserver",
        "CORS_ORIGINS": frontend_url,
        "SEND_EMAIL_REMINDERS": "false",
        "SEND_WHATSAPP_REMINDERS": "false",
    })


def reset_database(database_url: str) -> None:
    """Borra el schema de la app; el arranque de FastAPI lo recrea con los datos iniciales."""
    from sqlalchemy import create_engine, text

    from app.core.database import SCHEMA_NAME

    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text(f'DROP SCHEMA IF EXISTS "{SCHEMA_NAME}" CASCADE'))
    engine.dispose()


class Mailbox:
    """Emails "enviados" por la app durante las pruebas."""

    def __init__(self, on_send: Callable[[Dict[str, str]], None] | None = None) -> None:
        self.messages: List[Dict[str, str]] = []
        self._on_send = on_send

    def send(self, to_email: str, subject: str, html_content: str) -> bool:
        message = {"to": to_email, "subject": subject, "html": html_content}
        self.messages.append(message)
        if self._on_send:
            self._on_send(message)
        return True

    def reset_token_for(self, email: str) -> str:
        """Token del último email de recuperación enviado a `email`."""
        for message in reversed(self.messages):
            match = re.search(r'token=([^"&]+)', message["html"])
            if message["to"] == email and match:
                return match.group(1)
        raise AssertionError(f"No se envió un email de recuperación a {email}")


class _FakeTokenInfo:
    def __init__(self, status_code: int, data: dict) -> None:
        self.status_code = status_code
        self._data = data

    def json(self) -> dict:
        return self._data


class FakeGoogleClient:
    """Reemplaza httpx.AsyncClient en auth: el credential 'google:<email>:<nombre>' es válido."""

    def __init__(self, *args, **kwargs) -> None:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc) -> bool:
        return False

    async def get(self, url, params=None):
        credential = (params or {}).get("id_token", "")
        if not credential.startswith("google:"):
            return _FakeTokenInfo(400, {"error": "invalid_token"})
        _, email, name = credential.split(":", 2)
        return _FakeTokenInfo(200, {
            "aud": GOOGLE_CLIENT_ID,
            "email": email,
            "name": name,
            "email_verified": "true",
        })


def install_external_stubs(mailbox: Mailbox) -> Callable[[], None]:
    """Reemplaza email, MercadoPago y Google. Devuelve una función que restaura los originales."""
    email_module = importlib.import_module("app.services.email_service")
    payment_module = importlib.import_module("app.services.payment_service")
    auth_module = importlib.import_module("app.routes.auth")

    def create_preference(appointment_id, amount, title, description):
        return {
            "id": f"pref-test-{appointment_id}",
            "init_point": f"{MP_CHECKOUT_URL}?pref=pref-test-{appointment_id}",
            "sandbox_init_point": None,
        }

    def get_payment_info(payment_id):
        # El id de pago de MP codifica el turno: "mp-<appointment_id>"
        return {"id": f"tx-{payment_id}", "status": "approved", "external_reference": str(payment_id).split("-")[-1]}

    patches = [
        (email_module.email_service, "_send_email", mailbox.send),
        (payment_module.payment_service, "create_preference", create_preference),
        (payment_module.payment_service, "get_payment_info", get_payment_info),
        (auth_module.httpx, "AsyncClient", FakeGoogleClient),
    ]
    originals = [(target, name, getattr(target, name)) for target, name, _ in patches]
    for target, name, replacement in patches:
        setattr(target, name, replacement)

    def restore() -> None:
        for target, name, original in originals:
            setattr(target, name, original)

    return restore
