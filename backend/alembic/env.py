"""Alembic ortamı — uygulamanın modellerine ve DATABASE_URL'ine bağlıdır."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Uygulamanın veritabanı adresi (postgres:// -> postgresql:// normalize edilmiş)
from app.db.database import DATABASE_URL, Base

# Tüm modelleri Base.metadata'ya kaydetmek için init_db'yi import et.
# (init_db modül seviyesinde tüm model sınıflarını import eder.)
import app.db.init_db  # noqa: F401

config = context.config

# Veritabanı adresini koddan ata (alembic.ini'de sabit URL tutmuyoruz)
config.set_main_option("sqlalchemy.url", DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """'Offline' mod: yalnızca URL ile SQL üretir."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        render_as_batch=True,  # SQLite için ALTER desteği
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """'Online' mod: gerçek bağlantı ile migration uygular."""
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = DATABASE_URL

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            render_as_batch=True,  # SQLite için ALTER desteği (batch mode)
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
