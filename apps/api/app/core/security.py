from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

_hasher = PasswordHash.recommended()
# Olmayan kullanıcıda da aynı sürede cevap vermek için (kullanıcı tahmini zorlaşır).
_DUMMY_HASH = _hasher.hash("timing-attack-dummy-password")

ALGORITHM = "HS256"
SESSION_COOKIE = "via_session"
MIN_PASSWORD_LENGTH = 10


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        _hasher.verify(password, _DUMMY_HASH)
        return False
    return _hasher.verify(password, password_hash)


def create_access_token(user_id: int, token_version: int) -> tuple[str, datetime]:
    settings = get_settings()
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=settings.access_token_minutes)
    payload = {"sub": str(user_id), "ver": token_version, "iat": now, "exp": expires_at}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM), expires_at


def decode_access_token(token: str) -> tuple[int, int] | None:
    """Geçerliyse (kullanıcı id, token sürümü) döner; aksi halde None."""
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
        return int(payload["sub"]), int(payload["ver"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
