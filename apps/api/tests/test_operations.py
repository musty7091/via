"""Aşama 6: etkinlik operasyonu (görevler, rider kontrolü, operasyon raporu)."""

from datetime import timedelta

import pytest

from app.core import clock
from app.core.permissions import Role
from app.modules.partners.models import Partner

OPS = "/api/v1/operations"
TODAY = clock.today()


@pytest.fixture
def admin(make_user, login):
    user = make_user()
    login(user)
    return user


@pytest.fixture
def setup(client, admin, db):
    partner = Partner(full_name="Alper", sort_order=1)
    db.add(partner)
    db.flush()
    artist = client.post(
        "/api/v1/catalog/artists", json={"artist_type": "solo", "name": "Asena"}
    ).json()
    riders = f"/api/v1/catalog/artists/{artist['id']}/rider-items"
    client.post(riders, json={"category": "technical", "title": "2 adet monitör", "sort_order": 10})
    client.post(riders, json={"category": "backstage", "title": "Ayna ve ütü", "sort_order": 20})
    customer = client.post(
        "/api/v1/customers", json={"customer_type": "company", "name": "Merit"}
    ).json()
    return {"partner": partner, "artist": artist, "customer": customer, "riders": riders}


@pytest.fixture
def make_event(client, setup):
    def factory(days_ahead=10, price="10000"):
        offer = client.post(
            "/api/v1/offers",
            json={
                "customer_id": setup["customer"]["id"],
                "partner_id": setup["partner"].id,
                "title": "Gala",
                "event_date": (TODAY + timedelta(days=days_ahead)).isoformat(),
                "invoice_type": "without_invoice",
            },
        ).json()
        client.post(
            f"/api/v1/offers/{offer['id']}/lines",
            json={"line_type": "artist", "artist_id": setup["artist"]["id"], "unit_price": price},
        )
        client.post(f"/api/v1/offers/{offer['id']}/status", json={"action": "send"})
        r = client.post(f"/api/v1/offers/{offer['id']}/convert", json={})
        assert r.status_code == 201, r.text
        return r.json()["event_id"]

    return factory


def test_agreement_creates_default_tasks_and_rider_checks(client, make_event):
    event_id = make_event()

    ops = client.get(f"{OPS}/events/{event_id}").json()

    assert len(ops["tasks"]) == 7
    assert ops["tasks"][0]["due_date"] == (TODAY + timedelta(days=3)).isoformat()
    assert [c["title"] for c in ops["rider_checks"]] == ["2 adet monitör", "Ayna ve ütü"]
    assert ops["rider_checks"][0]["artist"]["name"] == "Asena"
    assert ops["progress"] == {
        "tasks_total": 7,
        "tasks_done": 0,
        "riders_total": 2,
        "riders_ok": 0,
        "rider_problems": 0,
        "report": "none",
    }


def test_complete_and_reopen_task_tracks_who_and_when(client, make_event, admin):
    event_id = make_event()
    task = client.get(f"{OPS}/events/{event_id}").json()["tasks"][0]

    done = client.patch(f"{OPS}/tasks/{task['id']}", json={"status": "done"}).json()
    row = done["tasks"][0]
    assert row["status"] == "done"
    assert row["completed_by"] == admin.full_name
    assert done["progress"]["tasks_done"] == 1

    undone = client.patch(f"{OPS}/tasks/{task['id']}", json={"status": "todo"}).json()
    assert undone["tasks"][0]["completed_at"] is None
    assert undone["progress"]["tasks_done"] == 0


def test_overdue_task_is_flagged(client, make_event):
    event_id = make_event()
    r = client.post(
        f"{OPS}/events/{event_id}/tasks",
        json={"title": "Jeneratör teyidi", "due_date": (TODAY - timedelta(days=1)).isoformat()},
    )
    assert r.status_code == 201
    task = r.json()["tasks"][-1]
    assert task["title"] == "Jeneratör teyidi"
    assert task["is_overdue"] is True


def test_assign_task_and_list_my_tasks(client, make_event, make_user, login):
    event_id = make_event()
    worker = make_user(Role.OPERATION)
    task = client.get(f"{OPS}/events/{event_id}").json()["tasks"][2]
    client.patch(f"{OPS}/tasks/{task['id']}", json={"assigned_to_id": worker.id})

    login(worker)
    mine = client.get(f"{OPS}/my-tasks").json()

    assert [m["task"]["id"] for m in mine] == [task["id"]]
    assert mine[0]["event_title"] == "Gala"


def test_only_operation_capable_users_are_assignees(client, make_event, make_user):
    event_id = make_event()
    accountant = make_user(Role.ACCOUNTING)
    worker = make_user(Role.OPERATION)
    ops = client.get(f"{OPS}/events/{event_id}").json()
    ids = {a["id"] for a in ops["assignees"]}
    assert worker.id in ids
    assert accountant.id not in ids

    task = ops["tasks"][0]
    r = client.patch(f"{OPS}/tasks/{task['id']}", json={"assigned_to_id": 999999})
    assert r.status_code == 400


def test_rider_problem_requires_note_and_is_audited(client, make_event):
    event_id = make_event()
    check = client.get(f"{OPS}/events/{event_id}").json()["rider_checks"][0]

    r = client.patch(f"{OPS}/rider-checks/{check['id']}", json={"status": "problem"})
    assert r.status_code == 400

    r = client.patch(
        f"{OPS}/rider-checks/{check['id']}",
        json={"status": "problem", "note": "Monitör tek geldi"},
    )
    assert r.status_code == 200
    assert r.json()["progress"]["rider_problems"] == 1

    logs = client.get("/api/v1/audit-logs", params={"search": "Monitör"}).json()
    assert any("Monitör tek geldi" in item["summary"] for item in logs["items"])


def test_rider_ok_and_not_needed_count_as_resolved(client, make_event):
    event_id = make_event()
    checks = client.get(f"{OPS}/events/{event_id}").json()["rider_checks"]
    client.patch(f"{OPS}/rider-checks/{checks[0]['id']}", json={"status": "ok"})
    ops = client.patch(
        f"{OPS}/rider-checks/{checks[1]['id']}", json={"status": "not_needed"}
    ).json()
    assert ops["progress"]["riders_ok"] == 2


def test_sync_adds_only_new_rider_items(client, make_event, setup):
    event_id = make_event()
    client.post(setup["riders"], json={"category": "hospitality", "title": "Vegan menü"})

    ops = client.post(f"{OPS}/events/{event_id}/rider-checks/sync").json()
    assert "Vegan menü" in [c["title"] for c in ops["rider_checks"]]
    assert len(ops["rider_checks"]) == 3

    again = client.post(f"{OPS}/events/{event_id}/rider-checks/sync").json()
    assert len(again["rider_checks"]) == 3


def test_report_cannot_be_submitted_before_event_day(client, make_event):
    event_id = make_event(days_ahead=5)
    r = client.put(f"{OPS}/events/{event_id}/report", json={"notes": "Taslak", "submit": True})
    assert r.status_code == 400

    draft = client.put(f"{OPS}/events/{event_id}/report", json={"notes": "Taslak"}).json()
    assert draft["report"]["status"] == "draft"
    assert draft["progress"]["report"] == "draft"


def test_submitted_report_shows_in_closure_checks(client, make_event):
    event_id = make_event(days_ahead=0)
    before = client.get(f"/api/v1/closing/events/{event_id}").json()
    check = next(c for c in before["checks"] if c["key"] == "operation_report")
    assert check["ok"] is False
    assert check["blocking"] is False

    r = client.put(
        f"{OPS}/events/{event_id}/report",
        json={"actual_guest_count": 180, "issues": "Ses 20 dk gecikti", "submit": True},
    )
    assert r.status_code == 200
    assert r.json()["report"]["status"] == "submitted"

    after = client.get(f"/api/v1/closing/events/{event_id}").json()
    assert next(c for c in after["checks"] if c["key"] == "operation_report")["ok"] is True


def test_cancelled_event_operations_are_locked(client, make_event):
    event_id = make_event()
    task = client.get(f"{OPS}/events/{event_id}").json()["tasks"][0]
    client.post(f"/api/v1/events/{event_id}/status", json={"action": "cancel", "note": "Vazgeçti"})

    ops = client.get(f"{OPS}/events/{event_id}").json()
    assert ops["can_manage"] is False
    assert client.patch(f"{OPS}/tasks/{task['id']}", json={"status": "done"}).status_code == 400
    assert all(b["event_id"] != event_id for b in client.get(f"{OPS}/board").json())


def test_board_lists_upcoming_events_with_progress(client, make_event):
    near = make_event(days_ahead=3)
    make_event(days_ahead=90)

    board = client.get(f"{OPS}/board", params={"days": 30}).json()

    assert [b["event_id"] for b in board] == [near]
    assert board[0]["progress"]["tasks_total"] == 7
    assert "total_amount" not in board[0]


def test_operation_role_manages_but_partner_and_accounting_only_view(
    client, make_event, make_user, login
):
    event_id = make_event()
    task = client.get(f"{OPS}/events/{event_id}").json()["tasks"][0]

    for role, can_manage in [
        (Role.OPERATION, True),
        (Role.PARTNER, False),
        (Role.ACCOUNTING, False),
    ]:
        login(make_user(role))
        ops = client.get(f"{OPS}/events/{event_id}")
        assert ops.status_code == 200
        assert ops.json()["can_manage"] is can_manage
        r = client.patch(f"{OPS}/tasks/{task['id']}", json={"note": "x"})
        assert (r.status_code == 200) is can_manage, role
