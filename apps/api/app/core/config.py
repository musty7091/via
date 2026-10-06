from functools import lru_cache
from typing import Annotated, Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

LOCAL_SECRET_PREFIX = "local-dev-only"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="VIA_",
        env_file=".env",
        env_file_encoding="utf-8-sig",
        extra="ignore",
    )

    app_name: str = "VIA EVENTS API"
    environment: Literal["local", "test", "production"] = "local"

    database_url: str = "postgresql+psycopg://via:via_dev_password@localhost:5433/via"
    test_database_url: str = "postgresql+psycopg://via:via_dev_password@localhost:5433/via_test"

    secret_key: str = "local-dev-only-secret-key-change-me-0123456789"
    access_token_minutes: int = 60 * 12

    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Ön yüzün derlenmiş dosyaları (apps/web/dist). Verilirse API aynı adresten sunar.
    static_dir: str | None = None
    # İstemci ile uygulama arasındaki güvenilen vekil sayısı (Cloud Run: 1).
    # Gerçek IP, X-Forwarded-For başlığının sağdan bu kadarıncı değeridir.
    trusted_proxies: int = 0
    db_pool_size: int = 5
    db_max_overflow: int = 5

    base_currency: str = "TRY"
    default_vat_rate: str = "16"
    timezone: str = "Europe/Istanbul"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @model_validator(mode="after")
    def guard_production(self) -> "Settings":
        weak_secret = self.secret_key.startswith(LOCAL_SECRET_PREFIX) or len(self.secret_key) < 32
        if self.environment == "production" and weak_secret:
            raise ValueError("Canlı ortamda güçlü bir VIA_SECRET_KEY zorunludur.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
