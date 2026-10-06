from sqlalchemy import select

from app.core.permissions import Permission, Role
from app.modules.audit.models import AuditLog


def test_login_sets_http_only_cookie_and_returns_permissions(client, make_user):
    user = make_user(Role.ACCOUNTING)

    response = client.post(
        "/api/v1/auth/login", json={"email": user.email.upper(), "password": "Test-Sifre-2026"}
    )

    assert response.status_code == 200
    assert "httponly" in response.headers["set-cookie"].lower()
    body = response.json()
    assert body["role_label"] == "Muhasebe"
    assert Permission.FINANCE_RECORD in body["permissions"]
    assert Permission.USERS_MANAGE not in body["permissions"]


def test_me_requires_session(client):
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_wrong_password_gives_generic_message(client, make_user):
    user = make_user()

    wrong = client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": "yanlis-sifre"}
    )
    unknown = client.post(
        "/api/v1/auth/login", json={"email": "yok@test.com", "password": "yanlis-sifre"}
    )

    assert wrong.status_code == unknown.status_code == 400
    assert wrong.json()["error"]["message"] == unknown.json()["error"]["message"]


def test_account_locks_after_five_failed_attempts(client, make_user, db):
    user = make_user()
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"email": user.email, "password": "yanlis-sifre"})

    response = client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": "Test-Sifre-2026"}
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "account_locked"
    assert db.scalar(select(AuditLog).where(AuditLog.action == "auth.locked")) is not None


def test_inactive_user_cannot_login(client, make_user):
    user = make_user(active=False)

    response = client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": "Test-Sifre-2026"}
    )

    assert response.json()["error"]["code"] == "inactive"


def test_logout_clears_session(client, make_user, login):
    login(make_user())

    client.post("/api/v1/auth/logout")

    assert client.get("/api/v1/auth/me").status_code == 401


def test_change_password_keeps_current_session(client, make_user, login):
    user = make_user()
    login(user)

    response = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Test-Sifre-2026", "new_password": "Yeni-Sifre-2026"},
    )

    assert response.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 200
    login(user, "Yeni-Sifre-2026")


def test_requests_without_csrf_header_are_rejected(client, make_user):
    user = make_user()

    response = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "Test-Sifre-2026"},
        headers={"X-Requested-With": ""},
    )

    assert response.status_code == 403
