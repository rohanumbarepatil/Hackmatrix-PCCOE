from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.facility import Facility
from app.models.staff import Staff
from app.models.shift_assignment import ShiftAssignment
from app.models.attendance import AttendanceEvent
from app.models.leave import LeaveRequest
from app.models.heartbeat import FacilityHeartbeat


def evaluate_staff_readiness(
    db: Session,
    facility_id: int,
    staff_id: int,
):
    now = datetime.now()

    facility = (
        db.query(Facility)
        .filter(Facility.id == facility_id)
        .first()
    )

    if not facility:
        return {
            "status": "error",
            "message": "Facility not found"
        }

    staff = (
        db.query(Staff)
        .filter(
            Staff.id == staff_id,
            Staff.facility_id == facility_id
        )
        .first()
    )

    if not staff:
        return {
            "status": "error",
            "message": "Staff member not found"
        }

    shift = (
        db.query(ShiftAssignment)
        .filter(
            ShiftAssignment.facility_id == facility_id,
            ShiftAssignment.staff_id == staff_id,
        )
        .order_by(ShiftAssignment.shift_date.desc())
        .first()
    )

    if not shift:
        return {
            "status": "error",
            "message": "No shift assignment found"
        }

    attendance = (
        db.query(AttendanceEvent)
        .filter(
            AttendanceEvent.facility_id == facility_id,
            AttendanceEvent.staff_id == staff_id,
        )
        .order_by(AttendanceEvent.id.desc())
        .first()
    )

    approved_leave = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.facility_id == facility_id,
            LeaveRequest.staff_id == staff_id,
            LeaveRequest.status == "APPROVED",
            LeaveRequest.start_datetime <= now,
            LeaveRequest.end_datetime >= now,
        )
        .first()
    )

    heartbeat = (
        db.query(FacilityHeartbeat)
        .filter(
            FacilityHeartbeat.facility_id == facility_id
        )
        .order_by(
            FacilityHeartbeat.heartbeat_timestamp.desc()
        )
        .first()
    )

    heartbeat_recent = False

    if heartbeat:
        heartbeat_recent = (
            now - heartbeat.heartbeat_timestamp
        ) <= timedelta(
            minutes=facility.expected_sync_gap_min
        )

    # -----------------------------
    # Decision logic
    # -----------------------------

    if attendance and attendance.event_type == "CHECK_IN":
        classification = "PRESENT"
        confidence = 0.98

        reason = (
            f"{staff.full_name} has a recorded check-in "
            f"for the facility."
        )

    elif attendance and attendance.event_type == "CHECK_OUT":
        classification = "OFF_SHIFT"
        confidence = 0.98

        reason = (
            f"{staff.full_name} has checked out and is currently off-shift."
        )

    elif approved_leave:
        classification = "APPROVED_ABSENCE"
        confidence = 0.99

        reason = (
            f"{staff.full_name} is on approved leave."
        )

    elif not heartbeat_recent:
        classification = "REPORTING_DELAY"
        confidence = 0.82

        reason = (
            "Facility heartbeat is stale. "
            "The missing check-in may be caused by "
            "delayed reporting or connectivity."
        )

    else:
        classification = "POSSIBLE_STAFFING_GAP"
        confidence = 0.86

        reason = (
            f"No check-in found for {staff.full_name}, "
            "no approved leave found, and facility "
            "heartbeat is recent."
        )

    return {
        "facility_id": facility.id,
        "facility": facility.name,
        "staff_id": staff.id,
        "staff": staff.full_name,
        "role": staff.role,
        "shift_id": shift.id,
        "classification": classification,
        "confidence": confidence,
        "heartbeat_recent": heartbeat_recent,
        "has_check_in": attendance is not None,
        "has_approved_leave": approved_leave is not None,
        "reason": reason,
        "evaluated_at": now.isoformat(),
    }