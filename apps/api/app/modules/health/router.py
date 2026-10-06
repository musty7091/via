from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db

router = APIRouter(tags=["health"])


class HealthRead(BaseModel):
    status: str
    environment: str
    database: str


@router.get("/health", response_model=HealthRead)
def health(db: Annotated[Session, Depends(get_db)]) -> HealthRead:
    db.execute(text("SELECT 1"))
    return HealthRead(status="ok", environment=get_settings().environment, database="ok")
