"""Servicios (ABM) y disponibilidad (horario semanal, excepciones y horarios ofrecidos).

Combinaciones servicio/hora: servicio 6, 14:00–15:00 (19:00 queda libre).
"""

import datetime as dt
import uuid

from tests.conftest import STUDIO_TZ


# ---------- Servicios ----------

def new_service_payload(**overrides):
    payload = {
        "name": f"Masaje {uuid.uuid4().hex[:6]}",
        "description": "Relajante",
        "duration_minutes": 50,
        "price": 9000,
        "category": "corporal",
    }
    payload.update(overrides)
    return payload


def test_service_crud(client, admin_headers):
    created = client.post("/api/services/", headers=admin_headers, json=new_service_payload())
    assert created.status_code == 201
    service_id = created.json()["id"]

    updated = client.put(f"/api/services/{service_id}", headers=admin_headers, json={"price": 9500})
    assert updated.status_code == 200 and updated.json()["price"] == 9500

    toggled = client.put(f"/api/services/{service_id}/toggle-active", headers=admin_headers)
    assert toggled.json()["is_active"] is False
    public = client.get("/api/services/?is_active=true").json()
    assert all(service["id"] != service_id for service in public)

    assert client.delete(f"/api/services/{service_id}", headers=admin_headers).status_code == 204


def test_service_validations(client, admin_headers):
    created = client.post("/api/services/", headers=admin_headers, json=new_service_payload()).json()
    duplicate = client.put(f"/api/services/{created['id']}", headers=admin_headers, json={"name": "Lifting de Pestañas"})
    assert duplicate.status_code == 400
    bad_category = client.put(f"/api/services/{created['id']}", headers=admin_headers, json={"category": "inventada"})
    assert bad_category.status_code == 422


def test_cannot_delete_service_with_appointments(client, new_client, book, admin_headers):
    user = new_client()
    book(user["headers"], 14, service_id=6)
    response = client.delete("/api/services/6", headers=admin_headers)
    assert response.status_code == 400
    assert "desactivarlo" in response.json()["detail"]


def test_service_admin_requires_admin(client, new_client):
    user = new_client()
    assert client.post("/api/services/", headers=user["headers"], json=new_service_payload()).status_code == 403


# ---------- Disponibilidad ----------

def test_seeded_schedule_uses_sunday_zero_convention(client, admin_headers):
    regular = client.get("/api/availability/regular", headers=admin_headers).json()
    open_days = sorted(item["day_of_week"] for item in regular if item["is_available"])
    assert open_days == [1, 2, 3, 4, 5, 6], "Lunes (1) a Sábado (6); 0 = Domingo"


def test_open_schedule_requires_hours(client, admin_headers):
    response = client.post("/api/availability/regular", headers=admin_headers, json={"day_of_week": 0, "is_available": True})
    assert response.status_code == 422


def test_sunday_schedule_lifecycle(client, admin_headers):
    created = client.post("/api/availability/regular", headers=admin_headers, json={
        "day_of_week": 0, "start_time": "10:00", "end_time": "13:00", "is_available": False,
    })
    assert created.status_code == 201
    schedule_id = created.json()["id"]

    inverted = client.put(f"/api/availability/regular/{schedule_id}", headers=admin_headers, json={"start_time": "15:00", "end_time": "11:00"})
    assert inverted.status_code in (400, 422)

    opened = client.put(f"/api/availability/regular/{schedule_id}", headers=admin_headers, json={"is_available": True})
    assert opened.status_code == 200

    next_sunday = dt.datetime.now(STUDIO_TZ).date()
    next_sunday += dt.timedelta(days=(6 - next_sunday.weekday()) % 7 or 7)
    check = client.get(f"/api/availability/check/{next_sunday.isoformat()}").json()
    assert check["is_available"] is True and check["start_time"] == "10:00:00"

    # Dejarlo como estaba (cerrado) para no afectar a otros tests
    client.put(f"/api/availability/regular/{schedule_id}", headers=admin_headers, json={"is_available": False})


def test_exception_blocks_a_date(client, admin_headers, booking_date):
    blocked = booking_date + dt.timedelta(days=2)
    created = client.post("/api/availability/exceptions", headers=admin_headers, json={"specific_date": blocked.isoformat(), "is_available": False})
    assert created.status_code == 201

    slots = client.post("/api/availability/available-slots", json={"service_id": 1, "date": blocked.isoformat()})
    assert slots.status_code == 200 and slots.json()["available_slots"] == []

    listed = client.get("/api/availability/exceptions", headers=admin_headers).json()
    assert any(item["id"] == created.json()["id"] for item in listed)
    assert client.delete(f"/api/availability/exceptions/{created.json()['id']}", headers=admin_headers).status_code == 204


def test_available_slots_exclude_confirmed(client, new_client, book, admin_headers, booking_date):
    user = new_client()
    appointment = book(user["headers"], 15, service_id=6)
    client.post("/api/payments/cash-payment", headers=admin_headers, json={"appointment_id": appointment["id"]})

    response = client.post("/api/availability/available-slots", json={"service_id": 6, "date": booking_date.isoformat()})
    slots = {slot["start_time"][11:16]: slot["is_available"] for slot in response.json()["available_slots"]}
    assert slots["15:00"] is False, "el horario confirmado queda ocupado"
    assert slots["19:00"] is True, "un horario sin turnos confirmados sigue libre"
