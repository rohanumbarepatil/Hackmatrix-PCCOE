from datetime import datetime

from sqlalchemy.orm import Session

from app.models.alert import Alert


def generate_alert(
    db: Session,
    facility_id: int,
    staff_id: int | None,
    classification: str,
    staff_name: str | None = None,
):
    """
    Create an alert only for conditions that require attention.
    """

    if classification == "REPORTING_DELAY":
        alert_type = "REPORTING_DELAY"
        severity = "MEDIUM"

        title = "Facility reporting delay"

        message = (
            f"Facility reporting appears delayed"
            f"{f' for {staff_name}' if staff_name else ''}. "
            "The latest facility heartbeat is stale."
        )

    elif classification == "POSSIBLE_STAFFING_GAP":
        alert_type = "STAFFING_GAP"
        severity = "HIGH"

        title = "Possible staffing gap"

        message = (
            f"No check-in was found for "
            f"{staff_name or 'assigned staff'}, "
            "no approved leave was found, and the "
            "facility heartbeat is recent."
        )

    else:
        return None

    alert = Alert(
        facility_id=facility_id,
        staff_id=staff_id,
        alert_type=alert_type,
        severity=severity,
        title=title,
        message=message,
        status="OPEN",
        created_at=datetime.utcnow(),
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    return alert


def get_open_alerts(
    db: Session,
    facility_id: int | None = None,
):
    query = db.query(Alert).filter(
        Alert.status == "OPEN"
    )

    if facility_id is not None:
        query = query.filter(
            Alert.facility_id == facility_id
        )

    return query.order_by(
        Alert.created_at.desc()
    ).all()


def resolve_alert(
    db: Session,
    alert_id: int,
    resolution_note: str,
):
    alert = (
        db.query(Alert)
        .filter(Alert.id == alert_id)
        .first()
    )

    if not alert:
        return None

    alert.status = "RESOLVED"
    alert.resolved_at = datetime.utcnow()
    alert.resolution_note = resolution_note

    db.commit()
    db.refresh(alert)

    return alert