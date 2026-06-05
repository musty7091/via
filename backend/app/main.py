from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.api_router import api_router
from app.core.config import settings
from app.modules.partners.router import router as partners_router


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description="VIA EVENTS backend API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1):[0-9]+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
app.include_router(partners_router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "message": "VIA EVENTS API",
        "docs": "/docs",
        "health": "/api/v1/health",
    }