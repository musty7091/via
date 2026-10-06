"""Canlı ortam: güvenlik başlıkları ve derlenmiş ön yüzün aynı adresten sunulması.

Ön yüz ve API aynı alan adında olduğu için oturum çerezi üçüncü taraf çerezi sayılmaz
ve CORS gerekmez.
"""

from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

# Ön yüz sadece kendi dosyalarını kullanır (fontlar dahil). Satır içi stil, React'in
# style özniteliği (ör. ilerleme çubuğu genişliği) için gereklidir.
CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
    ]
)


class SecurityHeaders(BaseHTTPMiddleware):
    def __init__(self, app, *, production: bool) -> None:  # noqa: ANN001
        super().__init__(app)
        self.production = production

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        headers = response.headers
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if request.url.path.startswith("/api/"):
            # Finansal veriler tarayıcı/vekil önbelleğinde tutulmaz.
            headers.setdefault("Cache-Control", "no-store")
        else:
            headers.setdefault("Content-Security-Policy", CONTENT_SECURITY_POLICY)
        if self.production:
            headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response


def mount_frontend(app: FastAPI, static_dir: str) -> None:
    """/assets/* değişmez dosyalar (uzun önbellek); diğer tüm yollar index.html (SPA)."""
    root = Path(static_dir).resolve()
    index = root / "index.html"
    if not index.is_file():
        raise RuntimeError(f"Ön yüz bulunamadı: {index}")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str) -> Response:
        if path.startswith("api/"):
            return JSONResponse(
                status_code=404,
                content={"error": {"code": "not_found", "message": "Adres bulunamadı."}},
            )
        candidate = (root / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(root):
            immutable = path.startswith("assets/")
            cache = "public, max-age=31536000, immutable" if immutable else "public, max-age=3600"
            return FileResponse(candidate, headers={"Cache-Control": cache})
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
