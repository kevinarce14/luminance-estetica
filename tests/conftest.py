"""
Fixtures de la suite del backend.

Seguridad: los tests NUNCA usan la base ni las credenciales del .env.
- TEST_DATABASE_URL es obligatoria y debe apuntar a una base PostgreSQL descartable:
  el schema de la app se borra y se recrea al iniciar la suite.
- Las variables de entorno tienen prioridad sobre el .env (pydantic-settings), así que
  acá se fuerzan la base de prueba y se vacían todas las credenciales externas.
- Email, MercadoPago y la verificación de Google quedan reemplazados por stubs.
"""

import datetime as dt
import os
import uuid
from typing import Callable, Dict
from zoneinfo import ZoneInfo

import pytest

from tests.support import (
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    MISSING_DATABASE_MESSAGE,
    Mailbox,
    configure_test_environment,
    install_external_stubs,
    reset_database,
)

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "").strip()
if not TEST_DATABASE_URL:
    pytest.exit(MISSING_DATABASE_MESSAGE, returncode=2)

configure_test_environment(TEST_DATABASE_URL)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.database import SCHEMA_NAME, SessionLocal  # noqa: E402

STUDIO_TZ = ZoneInfo("America/Argentina/Buenos_Aires")


@pytest.fixture(scope="session")
def mailbox() -> Mailbox:
    return Mailbox()


@pytest.fixture(scope="session", autouse=True)
def external_services(mailbox: Mailbox):
    """Stubs de email, MercadoPago y Google para toda la suite."""
    restore = install_external_stubs(mailbox)
    yield
    restore()


# ---------------------------------------------------------------------------
# App y base de datos
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def client(external_services) -> TestClient:
    """App con la base recreada desde cero (el lifespan crea tablas, admin, horarios y servicios)."""
    reset_database(TEST_DATABASE_URL)

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Helpers de dominio
# ---------------------------------------------------------------------------

def auth_header(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def login(client: TestClient, email: str, password: str):
    return client.post("/api/auth/login", data={"username": email, "password": password})


@pytest.fixture(scope="session")
def admin_headers(client: TestClient) -> Dict[str, str]:
    response = login(client, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert response.status_code == 200, response.text
    return auth_header(response.json()["access_token"])


@pytest.fixture()
def new_client(client: TestClient) -> Callable[..., Dict]:
    """Registra un cliente nuevo (email único) y devuelve sus datos con el token."""

    def create(phone: str = "11 4444-5555", password: str = "Clave1234") -> Dict:
        email = f"cliente.{uuid.uuid4().hex[:10]}@example.com"
        response = client.post("/api/auth/register", json={
            "email": email,
            "full_name": "Cliente Test",
            "phone": phone,
            "password": password,
        })
        assert response.status_code == 201, response.text
        token = login(client, email, password).json()["access_token"]
        return {
            "id": response.json()["id"],
            "email": email,
            "password": password,
            "phone": phone,
            "headers": auth_header(token),
        }

    return create


@pytest.fixture(scope="session")
def booking_date() -> dt.date:
    """Próximo día con atención (no domingo), a partir de mañana en hora del studio."""
    day = dt.datetime.now(STUDIO_TZ).date() + dt.timedelta(days=1)
    while day.weekday() == 6:
        day += dt.timedelta(days=1)
    return day


@pytest.fixture()
def book(client: TestClient, booking_date: dt.date) -> Callable[..., Dict]:
    """Reserva un turno para `booking_date` a la hora indicada (hora del studio)."""

    def create(headers: Dict[str, str], hour: int, minute: int = 0, service_id: int = 1) -> Dict:
        local = dt.datetime.combine(booking_date, dt.time(hour, minute), tzinfo=STUDIO_TZ)
        response = client.post(
            "/api/appointments/",
            headers=headers,
            json={"service_id": service_id, "appointment_date": local.isoformat()},
        )
        assert response.status_code == 201, response.text
        return response.json()

    return create


def move_appointment_to_past(db, appointment_id: int, status: str = "CONFIRMED") -> None:
    """Simula un turno ya ocurrido (ayer) directamente en la base."""
    yesterday = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) - dt.timedelta(days=1)
    db.execute(
        text(f'UPDATE "{SCHEMA_NAME}".appointments SET appointment_date = :date, status = :status WHERE id = :id'),
        {"date": yesterday, "status": status, "id": appointment_id},
    )
    db.commit()
