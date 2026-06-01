from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    app_name: str = Field(default="VIA EVENTS API", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    database_url: str = Field(default="sqlite:///./via_local.db", alias="DATABASE_URL")
    secret_key: str = Field(default="change-this-secret-key-before-production", alias="SECRET_KEY")
    access_token_expire_minutes: int = Field(default=1440, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    backend_cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="BACKEND_CORS_ORIGINS",
    )
    admin_email: str = Field(default="admin@via.local", alias="ADMIN_EMAIL")
    admin_password: str = Field(default="Via12345!", alias="ADMIN_PASSWORD")
    admin_full_name: str = Field(default="VIA Admin", alias="ADMIN_FULL_NAME")

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [
            item.strip()
            for item in self.backend_cors_origins.split(",")
            if item.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()