"""Pagos: MercadoPago (simulado), aprobación manual, rechazo y pagos manuales.

Combinaciones servicio/hora: servicio 4, 9:00–13:00.
"""


def create_preference(client, headers, appointment_id):
    response = client.post("/api/payments/create-preference", headers=headers, json={
        "appointment_id": appointment_id, "amount": 10000, "currency": "ARS", "payment_method": "mercadopago",
    })
    assert response.status_code == 200, response.text
    return response.json()


def payment_for(client, admin_headers, appointment_id):
    payments = client.get("/api/admin/payments", headers=admin_headers).json()
    return next(payment for payment in payments if payment["appointment_id"] == appointment_id)


def test_mercadopago_webhook_confirms_appointment(client, new_client, book, admin_headers):
    user = new_client()
    appointment = book(user["headers"], 9, service_id=4)
    preference = create_preference(client, user["headers"], appointment["id"])
    assert preference["init_point"].startswith("https://mercadopago.test/")

    webhook = client.post("/api/payments/webhook", json={"type": "payment", "data": {"id": f"mp-{appointment['id']}"}})
    assert webhook.status_code == 200 and webhook.json()["status"] == "ok"

    detail = client.get(f"/api/appointments/{appointment['id']}", headers=user["headers"]).json()
    assert detail["status"] == "confirmed"
    assert detail["payment"]["status"] == "approved"


def test_admin_payments_list_includes_client_and_appointment(client, new_client, book, admin_headers):
    user = new_client()
    appointment = book(user["headers"], 9, 30, service_id=4)
    create_preference(client, user["headers"], appointment["id"])

    response = client.get(f"/api/admin/payments?status=pending&search={user['email']}", headers=admin_headers)
    assert response.status_code == 200
    [payment] = response.json()
    assert payment["user"]["email"] == user["email"]
    assert payment["appointment"]["id"] == appointment["id"]
    assert payment["appointment"]["service"]["name"]


def test_approve_and_reject_with_transitions(client, new_client, book, admin_headers):
    user = new_client()
    approved_apt = book(user["headers"], 10, service_id=4)
    rejected_apt = book(user["headers"], 10, 30, service_id=4)
    for apt in (approved_apt, rejected_apt):
        create_preference(client, user["headers"], apt["id"])
    to_approve = payment_for(client, admin_headers, approved_apt["id"])
    to_reject = payment_for(client, admin_headers, rejected_apt["id"])

    approve = client.put(f"/api/payments/{to_approve['id']}/status", headers=admin_headers, json={"status": "approved", "notes": "Verificado"})
    assert approve.status_code == 200
    assert client.get(f"/api/appointments/{approved_apt['id']}", headers=user["headers"]).json()["status"] == "confirmed"

    reject = client.put(f"/api/payments/{to_reject['id']}/status", headers=admin_headers, json={"status": "rejected", "notes": "Comprobante ilegible"})
    assert reject.status_code == 200
    assert reject.json()["error_message"] == "Comprobante ilegible"

    assert client.put(f"/api/payments/{to_reject['id']}/status", headers=admin_headers, json={"status": "approved"}).status_code == 400
    assert client.put(f"/api/payments/{to_reject['id']}/status", headers=admin_headers, json={"status": "inexistente"}).status_code == 422


def test_manual_transfer_payment(client, new_client, book, admin_headers):
    user = new_client()
    appointment = book(user["headers"], 11, service_id=4)
    response = client.post("/api/payments/cash-payment", headers=admin_headers, json={
        "appointment_id": appointment["id"], "payment_method": "transfer", "reference": "OP-778899",
    })
    assert response.status_code == 201
    assert response.json()["payment_method"] == "transfer"
    assert "OP-778899" in response.json()["payment_details"]
    assert client.get(f"/api/appointments/{appointment['id']}", headers=user["headers"]).json()["status"] == "confirmed"


def test_cash_payment_reuses_rejected_payment(client, new_client, book, admin_headers):
    user = new_client()
    appointment = book(user["headers"], 11, 30, service_id=4)
    create_preference(client, user["headers"], appointment["id"])
    payment = payment_for(client, admin_headers, appointment["id"])
    client.put(f"/api/payments/{payment['id']}/status", headers=admin_headers, json={"status": "rejected"})

    response = client.post("/api/payments/cash-payment", headers=admin_headers, json={"appointment_id": appointment["id"]})
    assert response.status_code == 201
    assert response.json()["id"] == payment["id"], "cada turno tiene un único pago"
    assert response.json()["status"] == "approved"


def test_cannot_pay_cancelled_appointment(client, new_client, book, admin_headers):
    user = new_client()
    appointment = book(user["headers"], 12, service_id=4)
    client.post(f"/api/appointments/{appointment['id']}/cancel", headers=user["headers"], json={"cancellation_reason": "No puedo ir"})
    response = client.post("/api/payments/cash-payment", headers=admin_headers, json={"appointment_id": appointment["id"]})
    assert response.status_code == 400


def test_manual_payment_requires_admin(client, new_client, book):
    user = new_client()
    appointment = book(user["headers"], 12, 30, service_id=4)
    response = client.post("/api/payments/cash-payment", headers=user["headers"], json={"appointment_id": appointment["id"]})
    assert response.status_code == 403
