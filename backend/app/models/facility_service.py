from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class FacilityService(Base):
    __tablename__ = "facility_services"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    facility_id: Mapped[int] = mapped_column(
        ForeignKey("facilities.id"),
        nullable=False,
        index=True
    )

    service_id: Mapped[int] = mapped_column(
        ForeignKey("services.id"),
        nullable=False,
        index=True
    )

    is_available: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    facility = relationship(
        "Facility",
        back_populates="facility_services"
    )

    service = relationship(
        "Service",
        back_populates="facility_services"
    )