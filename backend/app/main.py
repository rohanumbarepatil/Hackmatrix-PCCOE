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
from app.models.attendance import AttendanceEvent
from app.models.shift_assignment import ShiftAssignment
from app.models.leave import LeaveRequest
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


# ---------------------------------------------------------
# NEW STAFF DASHBOARD APIs
# ---------------------------------------------------------
from pydantic import BaseModel
from datetime import datetime

@app.get("/staff/all")
def get_all_staff(db: Session = Depends(get_db)):
    staff_members = db.query(Staff).all()
    return {
        "staff": [
            {
                "id": s.id,
                "name": s.full_name,
                "role": s.role,
                "facility_id": s.facility_id
            } for s in staff_members
        ]
    }

@app.get("/staff/{staff_id}/shift")
def get_staff_shift(staff_id: int, db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        return {"status": "error", "message": "Staff not found"}
        
    shift = db.query(ShiftAssignment).filter(
        ShiftAssignment.staff_id == staff_id
    ).order_by(ShiftAssignment.shift_date.desc()).first()
    
    return {
        "staff": {
            "id": staff.id,
            "name": staff.full_name,
            "role": staff.role,
            "facility_id": staff.facility_id
        },
        "shift": {
            "id": shift.id,
            "shift_date": shift.shift_date.isoformat(),
            "start_time": shift.start_time.isoformat(),
            "end_time": shift.end_time.isoformat(),
            "status": shift.status
        } if shift else None
    }

class AttendancePayload(BaseModel):
    facility_id: int
    shift_assignment_id: int | None = None
    client_timestamp: datetime
    source: str = "PWA"

@app.post("/attendance/check-in/{staff_id}")
def staff_check_in(staff_id: int, payload: AttendancePayload, db: Session = Depends(get_db)):
    latest_event = db.query(AttendanceEvent).filter(
        AttendanceEvent.staff_id == staff_id
    ).order_by(AttendanceEvent.id.desc()).first()
    
    if latest_event and latest_event.event_type == "CHECK_IN":
        return {"status": "success", "event_id": latest_event.id, "message": "Duplicate ignored"}

    event = AttendanceEvent(
        staff_id=staff_id,
        facility_id=payload.facility_id,
        shift_assignment_id=payload.shift_assignment_id,
        event_type="CHECK_IN",
        client_timestamp=payload.client_timestamp,
        received_timestamp=datetime.utcnow(),
        sync_status="SYNCED",
        source=payload.source
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return {"status": "success", "event_id": event.id}

@app.post("/attendance/check-out/{staff_id}")
def staff_check_out(staff_id: int, payload: AttendancePayload, db: Session = Depends(get_db)):
    latest_event = db.query(AttendanceEvent).filter(
        AttendanceEvent.staff_id == staff_id
    ).order_by(AttendanceEvent.id.desc()).first()
    
    if not latest_event or latest_event.event_type == "CHECK_OUT":
        return {"status": "success", "event_id": latest_event.id if latest_event else None, "message": "Duplicate ignored"}

    event = AttendanceEvent(
        staff_id=staff_id,
        facility_id=payload.facility_id,
        shift_assignment_id=payload.shift_assignment_id,
        event_type="CHECK_OUT",
        client_timestamp=payload.client_timestamp,
        received_timestamp=datetime.utcnow(),
        sync_status="SYNCED",
        source=payload.source
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return {"status": "success", "event_id": event.id}

class LeaveRequestPayload(BaseModel):
    facility_id: int
    start_datetime: datetime
    end_datetime: datetime
    reason: str

@app.post("/leave/request/{staff_id}")
def request_leave(staff_id: int, payload: LeaveRequestPayload, db: Session = Depends(get_db)):
    # Automatically approve for hackathon demo purposes so it shows up in readiness
    leave = LeaveRequest(
        staff_id=staff_id,
        facility_id=payload.facility_id,
        start_datetime=payload.start_datetime,
        end_datetime=payload.end_datetime,
        reason=payload.reason,
        status="APPROVED",
        approved_by="Auto (Demo)"
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return {"status": "success", "leave_id": leave.id}

@app.get("/staff/{staff_id}/attendance")
def get_staff_attendance(staff_id: int, db: Session = Depends(get_db)):
    events = db.query(AttendanceEvent).filter(
        AttendanceEvent.staff_id == staff_id
    ).order_by(AttendanceEvent.id.desc()).limit(10).all()
    
    leaves = db.query(LeaveRequest).filter(
        LeaveRequest.staff_id == staff_id
    ).order_by(LeaveRequest.start_datetime.desc()).limit(5).all()
    
    return {
        "attendance": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "timestamp": e.client_timestamp.isoformat(),
            } for e in events
        ],
        "leaves": [
            {
                "id": l.id,
                "status": l.status,
                "start": l.start_datetime.isoformat(),
                "end": l.end_datetime.isoformat()
            } for l in leaves
        ]
    }