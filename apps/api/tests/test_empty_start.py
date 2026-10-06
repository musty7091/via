"""Canlıya ilk çıkış: veritabanında sadece süper admin varken ekranlar hata vermemeli."""

import pytest

from app.core import clock


@pytest.fixture
def admin(make_user, login):
    user = make_user()
    login(user)
    return user


def test_fresh_install_screens_load_without_errors(client, admin):
    month = f"{clock.today().year:04d}-{clock.today().month:02d}"
    for path in [
        "/api/v1/finance/overview",
        "/api/v1/finance/partners",
        "/api/v1/closing/periods",
        f"/api/v1/closing/periods/{month}",
        "/api/v1/reports/monthly",
        "/api/v1/operations/board",
        "/api/v1/operations/my-tasks",
    ]:
        r = client.get(path)
        assert r.status_code == 200, (path, r.text)
