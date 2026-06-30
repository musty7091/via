"""
Pytest ortak yapılandırması.

ÖNEMLİ: Uygulama import edilmeden ÖNCE izole bir test veritabanı ayarlanır;
böylece testler asla gerçek/canlı veritabanına dokunmaz. TestClient context
yöneticisiyle açıldığı için açılış (startup) yaşam döngüsü tetiklenir
(bootstrap + temel veri tohumlama).
"""

import os
import tempfile

# --- Uygulama import edilmeden önce izole test DB'si ayarla ---------------
_TEST_DB_PATH = os.path.join(tempfile.gettempdir(), "via_pytest.db")
# Güvenlik: testler her zaman geçici sqlite kullanır (canlı DATABASE_URL'i ezeriz)
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH}"
os.environ["APP_ENV"] = "test"
os.environ.setdefault("ADMIN_EMAIL", "admin@viaevents.com")
os.environ.setdefault("ADMIN_PASSWORD", "Via12345!")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

# Her oturum başında temiz başla
if os.path.exists(_TEST_DB_PATH):
    os.remove(_TEST_DB_PATH)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    # Context yöneticisi açılış yaşam döngüsünü tetikler (bootstrap + seed)
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_headers(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={
            "email": os.environ["ADMIN_EMAIL"],
            "password": os.environ["ADMIN_PASSWORD"],
        },
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def user_headers(client, admin_headers):
    """Verilen rolde kullanıcı oluşturup giriş başlığı döndüren fabrika."""

    def _make(role: str, email: str):
        client.post(
            "/api/v1/users",
            headers=admin_headers,
            json={
                "full_name": role,
                "email": email,
                "password": "Test12345!",
                "role": role,
            },
        )
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "Test12345!"},
        )
        assert resp.status_code == 200, resp.text
        return {"Authorization": f"Bearer {resp.json()['access_token']}"}

    return _make
