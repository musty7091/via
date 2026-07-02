from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BASE_DIR / ".env"

# Production'da kullanılması YASAK varsayılanlar
DEFAULT_SECRET_KEY = "change-this-secret-key-before-production"
DEFAULT_ADMIN_PASSWORD = "Via12345!"


class Settings(BaseSettings):
    app_name: str = Field(default="VIA EVENTS API", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    database_url: str = Field(default="sqlite:///./via_local.db", alias="DATABASE_URL")
    secret_key: str = Field(default=DEFAULT_SECRET_KEY, alias="SECRET_KEY")
    access_token_expire_minutes: int = Field(default=1440, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    backend_cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="BACKEND_CORS_ORIGINS",
    )
    admin_email: str = Field(default="admin@viaevents.com", alias="ADMIN_EMAIL")
    admin_password: str = Field(default=DEFAULT_ADMIN_PASSWORD, alias="ADMIN_PASSWORD")
    admin_full_name: str = Field(default="VIA Admin", alias="ADMIN_FULL_NAME")

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() in ("production", "prod")

    @property
    def cors_origins(self) -> list[str]:
        return [
            item.strip()
            for item in self.backend_cors_origins.split(",")
            if item.strip()
        ]


def check_production_security(current: "Settings" = None) -> None:
    """Production'da güvensiz varsayılanları engeller (fail-fast).

    - SECRET_KEY varsayılansa: uygulama BAŞLAMAZ (sahte token riski).
    - ADMIN_PASSWORD varsayılansa: yüksek sesli UYARI (başlatmayı engellemez,
      aksi hâlde ilk kurulum kilitlenebilir).
    """
    s = current or settings
    if not s.is_production:
        return
    if s.secret_key == DEFAULT_SECRET_KEY:
        raise RuntimeError(
            "GÜVENLİK: production ortamında SECRET_KEY varsayılan değerde olamaz. "
            "Güçlü, rastgele bir SECRET_KEY ayarlayın (Render'da otomatik üretilir)."
        )
    if s.admin_password == DEFAULT_ADMIN_PASSWORD:
        print(
            "[GÜVENLİK UYARISI] Production'da varsayılan ADMIN_PASSWORD kullanılıyor. "
            "Lütfen Render panelinden güçlü bir ADMIN_PASSWORD ayarlayın."
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
