from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class District(Base):
    __tablename__ = "districts"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False
    )

    facilities = relationship(
        "Facility",
        back_populates="district",
        cascade="all, delete-orphan"
    )