import pytest
from sqlalchemy import select

from app.core.permissions import Role
from app.modules.audit.models import AuditLog

NEW_USER = {
    "full_name": "Ayşe Muhasebe",
    "email": "Ayse@ViaEvents.com",
    "role": "accounting",
    "password": "Gecici-Sifre-1",
}


@pytest.mark.parametrize("role", [Role.PARTNER, Role.ACCOUNTING, Role.OPERATION, Role.VIEWER])
def test_only_admin_can_manage_users(client, make_user, login, role):
    login(make_user(role))

    assert client.get("/api/v1/users").status_code == 403
    assert client.post("/api/v1/users", json=NEW_USER).status_code == 403


def test_admin_creates_user_and_action_is_audited(client, make_user, login, db):
    admin = make_user()
    login(admin)

    response = client.post("/api/v1/users", json=NEW_USER)

    assert response.status_code == 201
    created = response.json()
    assert created["email"] == "ayse@viaevents.com"
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "user.create"))
    assert entry.user_id == admin.id
    assert entry.entity_id == created["id"]
    assert "password" not in str(entry.changes)
    assert "password_hash" not in str(entry.changes)


def test_duplicate_email_is_rejected(client, make_user, login):
    login(make_user())
    client.post("/api/v1/users", json=NEW_USER)

    response = client.post("/api/v1/users", json={**NEW_USER, "email": "ayse@viaevents.com"})

    assert response.status_code == 409


def test_short_password_is_rejected(client, make_user, login):
    login(make_user())

    response = client.post("/api/v1/users", json={**NEW_USER, "password": "kisa"})

    assert response.status_code == 422


def test_admin_cannot_demote_or_deactivate_self(client, make_user, login):
    admin = make_user()
    make_user()  # ikinci yönetici olsa bile kendi yetkisini kaldıramaz
    login(admin)

    demote = client.patch(f"/api/v1/users/{admin.id}", json={"role": "viewer"})
    deactivate = client.patch(f"/api/v1/users/{admin.id}", json={"is_active": False})

    assert demote.status_code == deactivate.status_code == 400


def test_admin_can_demote_another_admin(client, make_user, login):
    acting_admin = make_user()
    other_admin = make_user()
    login(acting_admin)

    response = client.patch(f"/api/v1/users/{other_admin.id}", json={"role": "partner"})

    assert response.status_code == 200
    assert response.json()["role_label"] == "Ortak"


def test_service_keeps_at_least_one_active_admin(db, make_user):
    """API'de yönetici kendini düşüremediği için bu durum servis seviyesinde ek güvencedir."""
    from app.core.deps import RequestContext
    from app.core.errors import DomainError
    from app.modules.users import service
    from app.modules.users.schemas import UserUpdate

    lone_admin = make_user()
    script_actor = make_user(Role.PARTNER)  # ör. bir bakım betiği

    with pytest.raises(DomainError, match="en az bir aktif yönetici"):
        service.update_user(
            db,
            lone_admin,
            UserUpdate(is_active=False),
            actor=script_actor,
            context=RequestContext(ip_address=None, user_agent=None),
        )


def test_reset_password_invalidates_existing_sessions(client, make_user, login, db):
    admin = make_user()
    target = make_user(Role.VIEWER)
    login(target)
    assert client.get("/api/v1/auth/me").status_code == 200
    target_cookie = client.cookies.get("via_session")

    client.cookies.clear()
    login(admin)
    response = client.post(
        f"/api/v1/users/{target.id}/reset-password", json={"new_password": "Yeni-Sifre-2026"}
    )
    assert response.status_code == 204

    client.cookies.clear()
    client.cookies.set("via_session", target_cookie)
    assert client.get("/api/v1/auth/me").status_code == 401


def test_deactivated_user_session_stops_working(client, make_user, login):
    admin = make_user()
    target = make_user(Role.OPERATION)
    login(target)
    target_cookie = client.cookies.get("via_session")

    client.cookies.clear()
    login(admin)
    client.patch(f"/api/v1/users/{target.id}", json={"is_active": False})

    client.cookies.clear()
    client.cookies.set("via_session", target_cookie)
    assert client.get("/api/v1/auth/me").status_code == 401


def test_new_user_must_change_password_before_anything_else(client, make_user, login, db):
    login(make_user())
    created = client.post("/api/v1/users", json=NEW_USER).json()
    assert created["must_change_password"] is True
    client.post("/api/v1/auth/logout")

    me = client.post(
        "/api/v1/auth/login", json={"email": NEW_USER["email"], "password": NEW_USER["password"]}
    ).json()
    assert me["must_change_password"] is True
    blocked = client.get("/api/v1/customers")
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "password_change_required"

    same = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": NEW_USER["password"], "new_password": NEW_USER["password"]},
    )
    assert same.status_code == 400
    changed = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": NEW_USER["password"], "new_password": "Kendi-Sifrem-2026"},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["must_change_password"] is False
    assert client.get("/api/v1/customers").status_code == 200


def test_admin_reset_requires_change_again(client, make_user, login, db):
    admin = make_user()
    target = make_user(Role.ACCOUNTING)
    assert target.must_change_password is False
    login(admin)

    client.post(
        f"/api/v1/users/{target.id}/reset-password", json={"new_password": "Yeni-Sifre-2026"}
    )

    db.refresh(target)
    assert target.must_change_password is True


def test_cli_admin_does_not_need_password_change(db):
    from app.modules.users import service
    from app.modules.users.schemas import UserCreate

    user = service.create_user(
        db,
        UserCreate(
            full_name="Kurulum Yöneticisi",
            email="kurulum@test.com",
            role=Role.SUPER_ADMIN,
            password="Kurulum-Sifre-2026",
        ),
        actor=None,
        context=None,
    )
    assert user.must_change_password is False
