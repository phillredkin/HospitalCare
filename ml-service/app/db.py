import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, String, Uuid, create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

DEFAULT_DATABASE_URL = "postgresql+psycopg://hospitalcare:hospitalcare@localhost:5433/hospitalcare_ml"

JsonColumn = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    pass


class Prediction(Base):
    __tablename__ = "predictions"

    prediction_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    request_id: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True)
    model_version: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16))
    probability: Mapped[float | None] = mapped_column(Float)
    risk_level: Mapped[str | None] = mapped_column(String(16))
    top_factors: Mapped[list] = mapped_column(JsonColumn)
    reasons: Mapped[list] = mapped_column(JsonColumn)
    hospitalization: Mapped[dict] = mapped_column(JsonColumn)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


def init_db(url=None):
    engine = create_engine(url or os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL), pool_pre_ping=True)
    Base.metadata.create_all(engine)
    return engine
