"""
Servidor del backend para las pruebas E2E de Playwright (web/e2e/).

    TEST_DATABASE_URL=postgresql://... python tests/e2e_server.py [--port 8800]

- Usa el entorno seguro de tests/support.py (base descartable, sin credenciales reales).
- Borra y recrea el schema al arrancar: cada corrida empieza desde cero.
- Agrega rutas auxiliares /__e2e__/* SOLO en este proceso de prueba (la app de
  producción no las tiene): leer los emails simulados y mover un turno al pasado.
"""

import argparse
import datetime as dt
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from tests.support import (  # noqa: E402
    MISSING_DATABASE_MESSAGE,
    Mailbox,
    configure_test_environment,
    install_external_stubs,
    reset_database,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8800)
    parser.add_argument("--frontend-url", default="http://localhost:5180")
    args = parser.parse_args()

    database_url = os.environ.get("TEST_DATABASE_URL", "").strip()
    if not database_url:
        sys.exit(MISSING_DATABASE_MESSAGE)

    configure_test_environment(database_url, frontend_url=args.frontend_url)
    reset_database(database_url)

    mailbox = Mailbox()
    install_external_stubs(mailbox)

    import uvicorn
    from fastapi import HTTPException
    from sqlalchemy import text

    from app.core.database import SCHEMA_NAME, SessionLocal
    from app.main import app

    @app.get("/__e2e__/reset-token", include_in_schema=False)
    def e2e_reset_token(email: str):
        try:
            return {"token": mailbox.reset_token_for(email)}
        except AssertionError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    @app.post("/__e2e__/appointments/{appointment_id}/move-to-past", include_in_schema=False)
    def e2e_move_to_past(appointment_id: int, status: str = "CONFIRMED"):
        yesterday = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) - dt.timedelta(days=1)
        session = SessionLocal()
        try:
            session.execute(
                text(f'UPDATE "{SCHEMA_NAME}".appointments SET appointment_date = :date, status = :status WHERE id = :id'),
                {"date": yesterday, "status": status.upper(), "id": appointment_id},
            )
            session.commit()
        finally:
            session.close()
        return {"ok": True}

    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
