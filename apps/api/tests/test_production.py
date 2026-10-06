"""Aşama 8: canlı ortam güvenliği ve ön yüzün aynı adresten sunulması."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.session import get_db
from app.main import create_app


@pytest.fixture
def site(tmp_path, db, monkeypatch):
    """Derlenmiş ön yüz klasörüyle çalışan uygulama."""
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>VIA</html>", encoding="utf-8")
    (tmp_path / "assets" / "app-123.js").write_text("console.log(1)", encoding="utf-8")
    (tmp_path / "robots.txt").write_text("User-agent: *", encoding="utf-8")
    monkeypatch.setattr(get_settings(), "static_dir", str(tmp_path))
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app, headers={"X-Requested-With": "via"}) as client:
        yield client


def test_spa_routes_fall_back_to_index(site):
    r = site.get("/etkinlikler/12?sekme=operasyon")
    assert r.status_code == 200
    assert r.text == "<html>VIA</html>"
    assert r.headers["cache-control"] == "no-cache"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]


def test_assets_are_cached_long_and_files_served(site):
    r = site.get("/assets/app-123.js")
    assert r.status_code == 200
    assert "immutable" in r.headers["cache-control"]
    assert site.get("/robots.txt").text == "User-agent: *"


def test_path_traversal_is_not_served(site):
    r = site.get("/..%2F..%2Fpyproject.toml")
    assert r.text == "<html>VIA</html>"


def test_unknown_api_path_is_json_404_not_index(site):
    r = site.get("/api/v1/yok-boyle-bir-sey")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_api_responses_are_not_cached_and_hardened(client):
    r = client.get("/api/v1/health")
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"


def test_production_hides_docs_and_sets_hsts(db, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as client:
        assert client.get("/docs").status_code == 404
        assert client.get("/openapi.json").status_code == 404
        assert "max-age" in client.get("/api/v1/health").headers["strict-transport-security"]


def test_production_session_cookie_is_secure(client, make_user, monkeypatch):
    user = make_user()
    monkeypatch.setattr(get_settings(), "environment", "production")
    r = client.post("/api/v1/auth/login", json={"email": user.email, "password": "Test-Sifre-2026"})
    cookie = r.headers["set-cookie"].lower()
    assert "secure" in cookie and "httponly" in cookie and "samesite=lax" in cookie


def test_ip_is_taken_from_trusted_proxy_not_client_supplied(client, make_user, monkeypatch):
    monkeypatch.setattr(get_settings(), "trusted_proxies", 1)
    user = make_user()
    client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "Test-Sifre-2026"},
        headers={"X-Forwarded-For": "6.6.6.6, 81.214.10.20"},
    )
    logs = client.get("/api/v1/audit-logs", params={"search": "giriş yaptı"}).json()["items"]
    assert logs[0]["ip_address"] == "81.214.10.20"


def test_many_failed_logins_from_one_ip_are_throttled(client, make_user):
    users = [make_user() for _ in range(3)]
    for i in range(20):
        r = client.post(
            "/api/v1/auth/login",
            json={"email": users[i % 3].email, "password": "yanlis-sifre"},
        )
        assert r.status_code == 400
    r = client.post(
        "/api/v1/auth/login", json={"email": users[0].email, "password": "Test-Sifre-2026"}
    )
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "too_many_requests"
