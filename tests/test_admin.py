"""Panel admin: agenda, clientes, dashboard y reportes.

Combinaciones servicio/hora: servicio 5, 9:00–16:00.
"""

import datetime as dt

from tests.conftest import STUDIO_TZ, move_appointment_to_past


def test_admin_endpoints_require_admin(client, new_client):
    user = new_client()
    for url in ("/api/admin/appointments", "/api/admin/payments", "/api/admin/clients",
                "/api/admin/dashboard", "/api/admin/reports/yearly?year=2026"):
        assert client.get(url, headers=user["headers"]).status_code == 403, url


def test_agenda_filters(client, new_client, book, admin_headers, booking_date, db):
    user = new_client(phone="11 7777-0101")
    upcoming = book(user["headers"], 9, service_id=5)
    past = book(user["headers"], 10, service_id=5)
    move_appointment_to_past(db, past["id"])

    def agenda(query: str):
        response = client.get(f"/api/admin/appointments?{query}", headers=admin_headers)
        assert response.status_code == 200, response.text
        return {item["id"] for item in response.json()}

    mine = agenda(f"user_id={user['id']}")
    assert mine == {upcoming["id"], past["id"]}, "historial completo, pasados incluidos"
    assert agenda(f"search={user['email']}") == mine
    assert agenda("search=77770101") >= mine, "búsqueda por dígitos del teléfono"
    assert agenda(f"search=%23{upcoming['id']}") >= {upcoming["id"]}
    assert upcoming["id"] in agenda(f"date={booking_date.isoformat()}&user_id={user['id']}")
    assert agenda(f"status=confirmed&user_id={user['id']}") == {past["id"]}
    today = dt.datetime.now(STUDIO_TZ).date().isoformat()
    assert agenda(f"date_from={today}&user_id={user['id']}") == {upcoming["id"]}

    first = client.get(f"/api/admin/appointments?user_id={user['id']}&order=desc", headers=admin_headers).json()[0]
    assert first["id"] == upcoming["id"]
    assert first["user"]["email"] == user["email"] and first["user"]["phone"] == user["phone"]


def test_clients_with_metrics(client, new_client, book, admin_headers):
    user = new_client(phone="11 7777-0202")
    paid = book(user["headers"], 11, service_id=5)
    book(user["headers"], 11, 30, service_id=5)
    client.post("/api/payments/cash-payment", headers=admin_headers, json={"appointment_id": paid["id"]})

    response = client.get("/api/admin/clients?search=77770202", headers=admin_headers)
    assert response.status_code == 200
    [row] = response.json()
    assert row["email"] == user["email"]
    assert row["appointments_count"] == 2
    assert row["total_paid"] > 0

    all_clients = client.get("/api/admin/clients", headers=admin_headers).json()
    assert all(not item["email"].startswith("admin@") for item in all_clients), "excluye administradores"


def test_deactivated_client_cannot_login(client, new_client, admin_headers):
    user = new_client()
    response = client.put(f"/api/users/{user['id']}/toggle-active", headers=admin_headers)
    assert response.json()["is_active"] is False
    blocked = client.post("/api/auth/login", data={"username": user["email"], "password": user["password"]})
    assert blocked.status_code == 403
    client.put(f"/api/users/{user['id']}/toggle-active", headers=admin_headers)


def test_dashboard_metrics(client, admin_headers):
    response = client.get("/api/admin/dashboard", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert {"clients", "appointments", "revenue", "popular_services"} <= set(body)


def test_yearly_report(client, new_client, book, admin_headers):
    user = new_client()
    appointment = book(user["headers"], 12, service_id=5)
    client.post("/api/payments/cash-payment", headers=admin_headers, json={"appointment_id": appointment["id"]})

    year = dt.datetime.now(STUDIO_TZ).year
    response = client.get(f"/api/admin/reports/yearly?year={year}", headers=admin_headers)
    assert response.status_code == 200
    report = response.json()
    assert len(report["months"]) == 12
    assert report["total_revenue"] == sum(month["revenue"] for month in report["months"])
    assert report["total_revenue"] > 0
    assert report["top_services"]
    assert {method["method"] for method in report["payment_methods"]} >= {"cash"}


def test_monthly_report_validates_input(client, admin_headers):
    now = dt.datetime.now(STUDIO_TZ)
    assert client.get(f"/api/admin/reports/monthly?year={now.year}&month={now.month}", headers=admin_headers).status_code == 200
    assert client.get(f"/api/admin/reports/monthly?year={now.year}&month=13", headers=admin_headers).status_code == 422
