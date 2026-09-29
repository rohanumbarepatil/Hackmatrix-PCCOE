from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.database import engine, get_db
from app.models.alert import Alert
from app.models.base import Base
from app.models.facility import Facility
from app.models.staff import Staff
from app.models.heartbeat import FacilityHeartbeat
from app.services.readiness_engine import evaluate_staff_readiness
from app.services.demo_seed import seed_demo_data
from app.services.alert_engine import (
    generate_alert,
    get_open_alerts,
    resolve_alert,
)

app = FastAPI(
    title="PHC Pulse API",
    description="PHC Staffing & Service-Availability Monitoring",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "project": "PHC Pulse",
        "status": "running",
        "version": "0.1.0",
    }


@app.get("/health")
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected"
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }

@app.post("/setup/database")
def setup_database():
    Base.metadata.create_all(bind=engine)

    return {
        "status": "success",
        "message": "PHC Pulse database tables created"
    }   
@app.get("/readiness/evaluate/{facility_id}/{staff_id}")
def evaluate_readiness(
    facility_id: int,
    staff_id: int,
    db: Session = Depends(get_db),
):
    return evaluate_staff_readiness(
        db=db,
        facility_id=facility_id,
        staff_id=staff_id,
    ) 

@app.post("/alerts/generate/{facility_id}/{staff_id}")
def create_alert(
    facility_id: int,
    staff_id: int,
    db: Session = Depends(get_db),
):
    readiness = evaluate_staff_readiness(
        db=db,
        facility_id=facility_id,
        staff_id=staff_id,
    )

    classification = readiness.get("classification")

    alert = generate_alert(
        db=db,
        facility_id=facility_id,
        staff_id=staff_id,
        classification=classification,
        staff_name=readiness.get("staff"),
    )

    if not alert:
        return {
            "status": "no_alert",
            "classification": classification,
            "message": "No alert required for this readiness state.",
        }

    return {
        "status": "created",
        "alert": {
            "id": alert.id,
            "facility_id": alert.facility_id,
            "staff_id": alert.staff_id,
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "title": alert.title,
            "message": alert.message,
            "status": alert.status,
            "created_at": alert.created_at.isoformat(),
        },
    }


@app.get("/alerts")
def list_alerts(
    facility_id: int | None = None,
    db: Session = Depends(get_db),
):
    alerts = get_open_alerts(
        db=db,
        facility_id=facility_id,
    )

    return {
        "count": len(alerts),
        "alerts": [
            {
                "id": alert.id,
                "facility_id": alert.facility_id,
                "staff_id": alert.staff_id,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "title": alert.title,
                "message": alert.message,
                "status": alert.status,
                "created_at": alert.created_at.isoformat(),
            }
            for alert in alerts
        ],
    }


@app.post("/alerts/{alert_id}/resolve")
def resolve_existing_alert(
    alert_id: int,
    resolution_note: str = "Reviewed by district officer",
    db: Session = Depends(get_db),
):
    alert = resolve_alert(
        db=db,
        alert_id=alert_id,
        resolution_note=resolution_note,
    )

    if not alert:
        return {
            "status": "error",
            "message": "Alert not found",
        }

    return {
        "status": "resolved",
        "alert": {
            "id": alert.id,
            "facility_id": alert.facility_id,
            "staff_id": alert.staff_id,
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "title": alert.title,
            "message": alert.message,
            "status": alert.status,
            "resolution_note": alert.resolution_note,
            "resolved_at": (
                alert.resolved_at.isoformat()
                if alert.resolved_at
                else None
            ),
        },
    }    

@app.get("/district/overview")
def district_overview(
    db: Session = Depends(get_db),
):
    facilities = db.query(Facility).all()

    total_phcs = len(facilities)
    operational = 0
    staffing_gaps = 0
    reporting_delays = 0
    approved_absences = 0
    total_staff_monitored = 0

    facility_summaries = []

    for facility in facilities:

        # -----------------------------
        # Facility heartbeat
        # -----------------------------
        heartbeat = (
            db.query(FacilityHeartbeat)
            .filter(
                FacilityHeartbeat.facility_id == facility.id
            )
            .order_by(
                FacilityHeartbeat.heartbeat_timestamp.desc()
            )
            .first()
        )

        heartbeat_recent = False

        if heartbeat:
            from datetime import datetime, timedelta

            heartbeat_recent = (
                datetime.now() - heartbeat.heartbeat_timestamp
            ) <= timedelta(
                minutes=facility.expected_sync_gap_min
            )

        if heartbeat_recent:
            operational += 1

        # -----------------------------
        # Staff readiness
        # -----------------------------
        staff_members = (
            db.query(Staff)
            .filter(
                Staff.facility_id == facility.id
            )
            .all()
        )

        facility_staffing_gaps = 0
        facility_reporting_delays = 0
        facility_approved_absences = 0
        facility_present = 0

        for staff in staff_members:

            result = evaluate_staff_readiness(
                db=db,
                facility_id=facility.id,
                staff_id=staff.id,
            )

            classification = result.get("classification")

            if classification == "PRESENT":
                facility_present += 1

            elif classification == "APPROVED_ABSENCE":
                facility_approved_absences += 1
                approved_absences += 1

            elif classification == "REPORTING_DELAY":
                facility_reporting_delays += 1
                reporting_delays += 1

            elif classification == "POSSIBLE_STAFFING_GAP":
                facility_staffing_gaps += 1
                staffing_gaps += 1

        total_staff_monitored += len(staff_members)

        facility_summaries.append(
            {
                "facility_id": facility.id,
                "facility": facility.name,
                "operational": heartbeat_recent,
                "staff_monitored": len(staff_members),
                "present": facility_present,
                "approved_absences": facility_approved_absences,
                "reporting_delays": facility_reporting_delays,
                "staffing_gaps": facility_staffing_gaps,
            }
        )

    # Current demo has one district/facility grouping.
    district_name = (
        facilities[0].name
        if len(facilities) == 1
        else "Karveer District"
    )

    return {
        "district": district_name,
        "total_phcs": total_phcs,
        "operational": operational,
        "staffing_gaps": staffing_gaps,
        "reporting_delays": reporting_delays,
        "approved_absences": approved_absences,
        "total_staff_monitored": total_staff_monitored,
        "facilities": facility_summaries,
    }


@app.post("/setup/seed")
def seed_data():
    db = next(get_db())
    return seed_demo_data(db)