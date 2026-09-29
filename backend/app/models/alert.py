from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime

from app.models.base import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)

    facility_id = Column(Integer, nullable=False, index=True)
    staff_id = Column(Integer, nullable=True, index=True)

    alert_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)

    status = Column(String(20), nullable=False, default="OPEN")

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    resolution_note = Column(Text, nullable=True)