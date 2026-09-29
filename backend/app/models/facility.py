from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    district_id: Mapped[int] = mapped_column(
        ForeignKey("districts.id"),
        nullable=False,
        index=True
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    facility_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="PHC"
    )

    block: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    latitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    longitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    expected_sync_gap_min: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=30
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False
    )

    district = relationship(
        "District",
        back_populates="facilities"
    )

    staff = relationship(
        "Staff",
        back_populates="facility",
        cascade="all, delete-orphan"
    )

    facility_services = relationship(
        "FacilityService",
        back_populates="facility",
        cascade="all, delete-orphan"
    )

    shift_assignments = relationship(
        "ShiftAssignment",
        back_populates="facility",
        cascade="all, delete-orphan"
    )