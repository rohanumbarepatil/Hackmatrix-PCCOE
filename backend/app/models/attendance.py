from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class AttendanceEvent(Base):
    __tablename__ = "attendance_events"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    staff_id: Mapped[int] = mapped_column(
        ForeignKey("staff.id"),
        nullable=False,
        index=True
    )

    facility_id: Mapped[int] = mapped_column(
        ForeignKey("facilities.id"),
        nullable=False,
        index=True
    )

    shift_assignment_id: Mapped[int | None] = mapped_column(
        ForeignKey("shift_assignments.id"),
        nullable=True,
        index=True
    )

    event_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False
    )

    client_timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    received_timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    sync_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="SYNCED"
    )

    source: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PWA"
    )

    staff = relationship("Staff")
    facility = relationship("Facility")
    shift_assignment = relationship("ShiftAssignment")