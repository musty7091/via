import pytest

from app.core.permissions import Role


@pytest.mark.parametrize("role", [Role.PARTNER, Role.ACCOUNTING, Role.VIEWER])
def test_only_super_admin_can_change_partners(client, make_user, login, role):
    login(make_user(role))

    assert client.get("/api/v1/partners").status_code == 200
    assert client.post("/api/v1/partners", json={"full_name": "Yeni Ortak"}).status_code == 403


def test_operation_role_cannot_see_partners(client, make_user, login):
    login(make_user(Role.OPERATION))

    assert client.get("/api/v1/partners").status_code == 403


def test_super_admin_manages_partners_and_links_user(client, make_user, login):
    actor = make_user(Role.SUPER_ADMIN)
    linked_user = make_user(Role.PARTNER)
    login(actor)

    response = client.post(
        "/api/v1/partners",
        json={"full_name": "Volkan", "sort_order": 2, "user_id": linked_user.id, "phone": ""},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["user_email"] == linked_user.email
    assert body["phone"] is None


def test_user_can_be_linked_to_only_one_partner(client, make_user, login):
    login(make_user())
    user = make_user(Role.PARTNER)
    client.post("/api/v1/partners", json={"full_name": "Alper", "user_id": user.id})

    response = client.post("/api/v1/partners", json={"full_name": "Volkan", "user_id": user.id})

    assert response.status_code == 409


def test_last_active_partner_cannot_be_deactivated(client, make_user, login):
    login(make_user())
    partner = client.post("/api/v1/partners", json={"full_name": "Alper"}).json()

    response = client.patch(f"/api/v1/partners/{partner['id']}", json={"is_active": False})

    assert response.status_code == 400


def test_inactive_partners_hidden_by_default(client, make_user, login):
    login(make_user())
    client.post("/api/v1/partners", json={"full_name": "Alper", "sort_order": 1})
    second = client.post(
        "/api/v1/partners", json={"full_name": "Eski Ortak", "sort_order": 2}
    ).json()
    client.patch(f"/api/v1/partners/{second['id']}", json={"is_active": False})

    active = client.get("/api/v1/partners").json()
    everyone = client.get("/api/v1/partners", params={"include_inactive": True}).json()

    assert [p["full_name"] for p in active] == ["Alper"]
    assert len(everyone) == 2


def test_partner_changes_are_recorded_in_audit_log(client, make_user, login):
    login(make_user())
    partner = client.post("/api/v1/partners", json={"full_name": "İbrahim"}).json()
    client.patch(f"/api/v1/partners/{partner['id']}", json={"phone": "0533 000 00 00"})

    logs = client.get(
        "/api/v1/audit-logs", params={"entity_type": "partner", "entity_id": partner["id"]}
    ).json()

    assert logs["total"] == 2
    latest = logs["items"][0]
    assert latest["action"] == "partner.update"
    assert latest["changes"] == {"phone": {"before": None, "after": "0533 000 00 00"}}


def test_audit_log_visible_to_accounting_but_not_operation(client, make_user, login):
    login(make_user(Role.ACCOUNTING))
    assert client.get("/api/v1/audit-logs").status_code == 200

    client.cookies.clear()
    login(make_user(Role.OPERATION))
    assert client.get("/api/v1/audit-logs").status_code == 403


def test_get_single_partner(client, make_user, login, db):
    from app.modules.partners.models import Partner

    login(make_user())
    partner = Partner(full_name="Volkan", sort_order=2)
    db.add(partner)
    db.flush()
    assert client.get(f"/api/v1/partners/{partner.id}").json()["full_name"] == "Volkan"
    assert client.get("/api/v1/partners/999999").status_code == 404
