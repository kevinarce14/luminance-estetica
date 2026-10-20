"""Registro, login, Google y recuperación de contraseña."""

import uuid

from tests.conftest import auth_header, login


def unique_email(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:10]}@example.com"


# ---------- Registro y login ----------

def test_register_and_login(client, new_client):
    user = new_client()
    me = client.get("/api/users/me", headers=user["headers"])
    assert me.status_code == 200
    assert me.json()["email"] == user["email"]
    assert me.json()["is_admin"] is False


def test_register_duplicate_email(client, new_client):
    user = new_client()
    response = client.post("/api/auth/register", json={
        "email": user["email"], "full_name": "Otra", "password": "Clave1234",
    })
    assert response.status_code == 400
    assert response.json()["detail"] == "El email ya está registrado"


def test_register_rejects_weak_password(client):
    response = client.post("/api/auth/register", json={
        "email": unique_email("debil"), "full_name": "Débil", "password": "abcdefgh",
    })
    assert response.status_code == 422


def test_login_wrong_password(client, new_client):
    user = new_client()
    response = login(client, user["email"], "Incorrecta1")
    assert response.status_code == 401
    assert response.json()["detail"] == "Email o contraseña incorrectos"


# ---------- Google ----------

def test_google_config_is_public(client):
    response = client.get("/api/auth/google/config")
    assert response.status_code == 200
    assert response.json() == {"enabled": True, "client_id": "test-client-id.apps.googleusercontent.com"}


def test_google_login_creates_account(client):
    email = unique_email("google")
    response = client.post("/api/auth/google", json={"credential": f"google:{email}:Sofía Google"})
    assert response.status_code == 200
    me = client.get("/api/users/me", headers=auth_header(response.json()["access_token"]))
    assert me.json()["email"] == email
    assert me.json()["full_name"] == "Sofía Google"


def test_google_account_password_login_explains(client):
    email = unique_email("google")
    client.post("/api/auth/google", json={"credential": f"google:{email}:Solo Google"})
    response = login(client, email, "Cualquiera1")
    assert response.status_code == 401
    assert "Google" in response.json()["detail"]


def test_google_invalid_token(client):
    response = client.post("/api/auth/google", json={"credential": "token-invalido"})
    assert response.status_code == 401


# ---------- Recuperar contraseña ----------

GENERIC_RESET_MESSAGE = "Si el email existe, recibirás instrucciones para resetear tu contraseña"


def test_reset_request_does_not_reveal_accounts(client, new_client):
    user = new_client()
    google_email = unique_email("google")
    client.post("/api/auth/google", json={"credential": f"google:{google_email}:G"})

    for email in (user["email"], unique_email("nadie"), google_email):
        response = client.post("/api/auth/password-reset", json={"email": email})
        assert response.status_code == 200
        assert response.json()["message"] == GENERIC_RESET_MESSAGE


def test_reset_password_full_flow(client, new_client, mailbox):
    user = new_client()
    client.post("/api/auth/password-reset", json={"email": user["email"]})
    token = mailbox.reset_token_for(user["email"])

    # El token del email no es una sesión
    assert client.get("/api/users/me", headers=auth_header(token)).status_code == 401

    weak = client.post("/api/auth/password-reset/confirm", json={"token": token, "new_password": "debil"})
    assert weak.status_code == 422

    ok = client.post("/api/auth/password-reset/confirm", json={"token": token, "new_password": "NuevaClave9"})
    assert ok.status_code == 200

    reused = client.post("/api/auth/password-reset/confirm", json={"token": token, "new_password": "OtraClave77"})
    assert reused.status_code == 400, "el token debe ser de un solo uso"

    assert login(client, user["email"], user["password"]).status_code == 401
    assert login(client, user["email"], "NuevaClave9").status_code == 200


def test_reset_token_tolerates_pasted_whitespace(client, new_client, mailbox):
    user = new_client()
    client.post("/api/auth/password-reset", json={"email": user["email"]})
    token = mailbox.reset_token_for(user["email"])
    pasted = f"  {token[:20]}\n{token[20:]}  "
    response = client.post("/api/auth/password-reset/confirm", json={"token": pasted, "new_password": "NuevaClave9"})
    assert response.status_code == 200


def test_reset_with_garbage_token(client):
    response = client.post("/api/auth/password-reset/confirm", json={"token": "no-es-un-token-valido", "new_password": "NuevaClave9"})
    assert response.status_code == 400
