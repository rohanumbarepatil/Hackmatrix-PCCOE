from datetime import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class FacilityHeartbeat(Base):
    __tablename__ = "facility_heartbeats"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    facility_id: Mapped[int] = mapped_column(
        nullable=False,
        index=True
    )

    heartbeat_timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    received_timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    connectivity_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="ONLINE"
    )

    latitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    longitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    source: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="SIMULATOR"
    )