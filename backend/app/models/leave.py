from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

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

    start_datetime: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    end_datetime: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING"
    )

    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    approved_by: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True
    )

    staff = relationship("Staff")
    facility = relationship("Facility")