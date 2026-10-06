"""Test altyapısı.

- Testler ayrı `via_test` veritabanında çalışır; geliştirme verisine dokunulmaz.
- Şema her test oturumunun başında sıfırdan kurulur.
- Her test kendi transaction'ı içinde çalışır ve sonunda geri alınır,
  böylece testler birbirini etkilemez.
"""

import os

os.environ["VIA_ENVIRONMENT"] = "test"

from collections.abc import Iterator  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.engine import Connection, Engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.permissions import Role  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.models import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.modules.users.models import User  # noqa: E402


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    test_engine = create_engine(get_settings().test_database_url)
    Base.metadata.drop_all(test_engine)
    Base.metadata.create_all(test_engine)
    yield test_engine
    test_engine.dispose()


@pytest.fixture
def connection(engine: Engine) -> Iterator[Connection]:
    conn = engine.connect()
    transaction = conn.begin()
    yield conn
    transaction.rollback()
    conn.close()


@pytest.fixture
def db(connection: Connection) -> Iterator[Session]:
    session = Session(
        bind=connection,
        join_transaction_mode="create_savepoint",
        autoflush=False,
        expire_on_commit=False,
    )
    yield session
    session.close()


@pytest.fixture(autouse=True)
def offline_rates(monkeypatch: pytest.MonkeyPatch) -> None:
    """Testler internete çıkmaz: TCMB çağrısı varsayılan olarak başarısız olur."""
    from app.modules.rates import service as rates

    def unavailable() -> bytes:
        raise OSError("çevrimdışı test")

    monkeypatch.setattr(rates, "_download", unavailable)
    monkeypatch.setattr(rates, "_last_attempt", 0.0)


@pytest.fixture(autouse=True)
def reset_rate_limits() -> Iterator[None]:
    from app.modules.auth.router import failed_logins_by_ip

    failed_logins_by_ip.reset()
    yield


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app, headers={"X-Requested-With": "via"}) as test_client:
        yield test_client


PASSWORD = "Test-Sifre-2026"


@pytest.fixture
def make_user(db: Session):
    """Belirli rolde kullanıcı oluşturur. Kullanım: make_user(Role.VIEWER)"""
    counter = {"n": 0}

    def factory(role: Role = Role.SUPER_ADMIN, *, email: str | None = None, active: bool = True):
        counter["n"] += 1
        user = User(
            full_name=f"Test {role.value} {counter['n']}",
            email=email or f"{role.value}{counter['n']}@test.com",
            role=role,
            is_active=active,
            password_hash=hash_password(PASSWORD),
        )
        db.add(user)
        db.flush()
        return user

    return factory


@pytest.fixture
def login(client: TestClient):
    """Kullanıcı olarak giriş yapar; çerez client'a yerleşir."""

    def do_login(user: User, password: str = PASSWORD):
        response = client.post(
            "/api/v1/auth/login", json={"email": user.email, "password": password}
        )
        assert response.status_code == 200, response.text
        return response.json()

    return do_login
