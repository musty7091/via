from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import BASE_DIR, settings


def build_database_url() -> str:
    if settings.database_url == "sqlite:///./via_local.db":
        db_path = BASE_DIR / "via_local.db"
        return f"sqlite:///{db_path.as_posix()}"

    return settings.database_url


DATABASE_URL = build_database_url()

connect_args = {}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}


engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    future=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)


class Base(DeclarativeBase):
    pass


def get_sqlite_database_path() -> Path | None:
    if DATABASE_URL.startswith("sqlite:///"):
        raw_path = DATABASE_URL.replace("sqlite:///", "", 1)
        return Path(raw_path)

    return None


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()