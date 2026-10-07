from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class DomainError(Exception):
    """İş kuralı ihlali. Kullanıcıya gösterilecek Türkçe mesaj taşır."""

    status_code = 400

    def __init__(self, message: str, *, code: str = "domain_error") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


class NotFoundError(DomainError):
    status_code = 404

    def __init__(self, message: str = "Kayıt bulunamadı.") -> None:
        super().__init__(message, code="not_found")


class PermissionDeniedError(DomainError):
    status_code = 403

    def __init__(
        self, message: str = "Bu işlem için yetkiniz yok.", code: str = "permission_denied"
    ) -> None:
        super().__init__(message, code=code)


class TooManyRequestsError(DomainError):
    status_code = 429

    def __init__(self, message: str) -> None:
        super().__init__(message, code="too_many_requests")


class ConflictError(DomainError):
    status_code = 409

    def __init__(self, message: str) -> None:
        super().__init__(message, code="conflict")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def handle_domain_error(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )
