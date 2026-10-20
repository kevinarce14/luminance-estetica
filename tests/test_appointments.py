"""Turnos: creación, historial, cancelación y cambios de estado.

Combinaciones servicio/hora usadas acá (para no chocar con otros módulos): servicio 2, 9:00–13:00.
"""

import datetime as dt

from tests.conftest import STUDIO_TZ, move_appointment_to_past


def test_create_appointment_returns_utc_with_offset(client, new_client, book):
    user = new_client()
    appointment = book(user["headers"], 9, service_id=2)
    assert appointment["status"] == "pending"
    assert appointment["appointment_date"].endswith(("Z", "+00:00"))


def test_cannot_book_in_the_past(client, new_client):
    user = new_client()
    yesterday = dt.datetime.now(STUDIO_TZ) - dt.timedelta(days=1)
    response = client.post("/api/appointments/", headers=user["headers"], json={
        "service_id": 2, "appointment_date": yesterday.isoformat(),
    })
    assert response.status_code == 422


def test_history_includes_past_appointments(client, new_client, book, db):
    user = new_client()
    appointment = book(user["headers"], 9, 30, service_id=2)
    move_appointment_to_past(db, appointment["id"])

    detail = client.get(f"/api/appointments/{appointment['id']}", headers=user["headers"])
    assert detail.status_code == 200, "un turno pasado debe poder consultarse"

    history = client.get("/api/appointments/", headers=user["headers"])
    assert history.status_code == 200
    assert [item["id"] for item in history.json()] == [appointment["id"]]
    assert history.json()[0]["service"]["name"]


def test_cancel_requires_reason_and_works(client, new_client, book):
    user = new_client()
    appointment = book(user["headers"], 10, service_id=2)

    short = client.post(f"/api/appointments/{appointment['id']}/cancel", headers=user["headers"], json={"cancellation_reason": "no"})
    assert short.status_code == 422

    response = client.post(f"/api/appointments/{appointment['id']}/cancel", headers=user["headers"], json={"cancellation_reason": "Surgió un imprevisto"})
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    assert response.json()["cancellation_reason"] == "Surgió un imprevisto"


def test_only_admin_changes_status(client, new_client, book):
    user = new_client()
    appointment = book(user["headers"], 10, 30, service_id=2)
    response = client.put(f"/api/appointments/{appointment['id']}", headers=user["headers"], json={"status": "confirmed"})
    assert response.status_code == 403


def test_status_transitions_are_validated(client, new_client, book, admin_headers):
    user = new_client()
    appointment = book(user["headers"], 11, service_id=2)
    url = f"/api/appointments/{appointment['id']}"

    assert client.put(url, headers=admin_headers, json={"status": "inventado"}).status_code == 422
    assert client.put(url, headers=admin_headers, json={"status": "completed"}).status_code == 400, "pending → completed no es válido"
    assert client.put(url, headers=admin_headers, json={"status": "confirmed"}).json()["status"] == "confirmed"
    assert client.put(url, headers=admin_headers, json={"status": "pending"}).status_code == 400


def test_admin_completes_past_appointment(client, new_client, book, admin_headers, db):
    user = new_client()
    appointment = book(user["headers"], 13, service_id=2)
    move_appointment_to_past(db, appointment["id"], status="CONFIRMED")
    response = client.put(f"/api/appointments/{appointment['id']}", headers=admin_headers, json={"status": "completed"})
    assert response.status_code == 200, "completar un turno pasado no debe dar 500"
    assert response.json()["status"] == "completed"


def test_admin_cancel_via_put_records_reason(client, new_client, book, admin_headers):
    user = new_client()
    appointment = book(user["headers"], 12, service_id=2)
    response = client.put(f"/api/appointments/{appointment['id']}", headers=admin_headers, json={"status": "cancelled"})
    assert response.status_code == 200
    assert response.json()["cancelled_at"] is not None
    assert response.json()["cancellation_reason"]


def test_public_confirmed_hides_clients(client, new_client, book, admin_headers, db):
    user = new_client()
    future = book(user["headers"], 9, service_id=3)
    client.post("/api/payments/cash-payment", headers=admin_headers, json={"appointment_id": future["id"]})
    past = book(user["headers"], 9, 30, service_id=3)
    move_appointment_to_past(db, past["id"])

    response = client.get("/api/appointments/public/confirmed")
    assert response.status_code == 200
    slots = response.json()
    assert slots, "debe listar el turno confirmado futuro"
    assert all(set(slot) == {"appointment_date", "duration_minutes"} for slot in slots)
    today_start = dt.datetime.combine(dt.datetime.now(STUDIO_TZ).date(), dt.time.min, tzinfo=STUDIO_TZ)
    assert all(dt.datetime.fromisoformat(slot["appointment_date"]) >= today_start for slot in slots)
