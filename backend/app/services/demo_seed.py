from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.district import District
from app.models.facility import Facility
from app.models.staff import Staff
from app.models.service import Service
from app.models.facility_service import FacilityService
from app.models.shift_assignment import ShiftAssignment
from app.models.attendance import AttendanceEvent
from app.models.leave import LeaveRequest
from app.models.heartbeat import FacilityHeartbeat


def seed_demo_data(db: Session):

    # -------------------------------------------------
    # 1. District
    # -------------------------------------------------

    district = (
        db.query(District)
        .filter(District.name == "Kolhapur")
        .first()
    )

    if not district:
        district = District(name="Kolhapur")
        db.add(district)
        db.flush()

    # -------------------------------------------------
    # 2. Facility
    # -------------------------------------------------

    facility = (
        db.query(Facility)
        .filter(Facility.name == "PHC Karveer")
        .first()
    )

    if not facility:
        facility = Facility(
            district_id=district.id,
            name="PHC Karveer",
            facility_type="PHC",
            block="Karveer",
            latitude=16.7050,
            longitude=74.2433,
            expected_sync_gap_min=30,
            is_active=True,
        )

        db.add(facility)
        db.flush()

    # -------------------------------------------------
    # 3. Services
    # -------------------------------------------------

    service_names = [
        ("Immunization", "ANM"),
        ("ANC", "ANM"),
        ("OPD", "Medical Officer"),
        ("Diagnostics", "Lab Technician"),
        ("Pharmacy", "Pharmacist"),
    ]

    services = {}

    for service_name, required_role in service_names:

        service = (
            db.query(Service)
            .filter(Service.name == service_name)
            .first()
        )

        if not service:
            service = Service(
                name=service_name,
                description=f"{service_name} service",
                required_role=required_role,
                is_active=True,
            )

            db.add(service)
            db.flush()

        services[service_name] = service

    # -------------------------------------------------
    # 4. Facility services
    # -------------------------------------------------

    for service in services.values():

        existing = (
            db.query(FacilityService)
            .filter(
                FacilityService.facility_id == facility.id,
                FacilityService.service_id == service.id,
            )
            .first()
        )

        if not existing:
            db.add(
                FacilityService(
                    facility_id=facility.id,
                    service_id=service.id,
                    is_available=True,
                )
            )

    # -------------------------------------------------
    # 5. Staff
    # -------------------------------------------------

    staff_data = [
        ("STF001", "Sunita Patil", "ANM"),
        ("STF002", "Rahul Jadhav", "ANM"),
        ("STF003", "Amit Shinde", "ANM"),
        ("STF004", "Priya More", "ANM"),
    ]

    staff_members = {}

    for code, name, role in staff_data:

        staff = (
            db.query(Staff)
            .filter(Staff.employee_code == code)
            .first()
        )

        if not staff:
            staff = Staff(
                facility_id=facility.id,
                employee_code=code,
                full_name=name,
                role=role,
                phone=None,
                is_active=True,
            )

            db.add(staff)
            db.flush()

        staff_members[code] = staff

    # -------------------------------------------------
    # 6. Shift assignments
    # -------------------------------------------------

    now = datetime.now()

    for code, staff in staff_members.items():

        existing_shift = (
            db.query(ShiftAssignment)
            .filter(
                ShiftAssignment.facility_id == facility.id,
                ShiftAssignment.staff_id == staff.id,
            )
            .first()
        )

        if not existing_shift:

            db.add(
                ShiftAssignment(
                    facility_id=facility.id,
                    staff_id=staff.id,
                    service_id=services["Immunization"].id,
                    shift_date=now,
                    start_time=now.replace(
                        hour=9,
                        minute=0,
                        second=0,
                        microsecond=0,
                    ),
                    end_time=now.replace(
                        hour=17,
                        minute=0,
                        second=0,
                        microsecond=0,
                    ),
                    status="SCHEDULED",
                )
            )

    db.flush()

    # -------------------------------------------------
    # 7. PRESENT scenario
    # -------------------------------------------------

    sunita = staff_members["STF001"]

    existing_attendance = (
        db.query(AttendanceEvent)
        .filter(
            AttendanceEvent.staff_id == sunita.id,
            AttendanceEvent.event_type == "CHECK_IN",
        )
        .first()
    )

    if not existing_attendance:

        db.add(
            AttendanceEvent(
                staff_id=sunita.id,
                facility_id=facility.id,
                client_timestamp=now - timedelta(minutes=10),
                received_timestamp=now - timedelta(minutes=9),
                event_type="CHECK_IN",
                sync_status="SYNCED",
                source="PWA",
            )
        )

    # -------------------------------------------------
    # 8. APPROVED ABSENCE scenario
    # -------------------------------------------------

    rahul = staff_members["STF002"]

    existing_leave = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.staff_id == rahul.id,
            LeaveRequest.status == "APPROVED",
        )
        .first()
    )

    if not existing_leave:

        db.add(
            LeaveRequest(
                staff_id=rahul.id,
                facility_id=facility.id,
                start_datetime=now - timedelta(hours=2),
                end_datetime=now + timedelta(hours=6),
                status="APPROVED",
                reason="Approved personal leave",
                approved_by="Block Medical Officer",
            )
        )

    # -------------------------------------------------
    # 9. Recent heartbeat
    # -------------------------------------------------

    existing_heartbeat = (
        db.query(FacilityHeartbeat)
        .filter(
            FacilityHeartbeat.facility_id == facility.id
        )
        .first()
    )

    if not existing_heartbeat:

        db.add(
            FacilityHeartbeat(
                facility_id=facility.id,
                heartbeat_timestamp=now - timedelta(minutes=5),
                received_timestamp=now - timedelta(minutes=4),
                connectivity_status="ONLINE",
                latitude=facility.latitude,
                longitude=facility.longitude,
                source="SIMULATOR",
            )
        )

    db.commit()

    return {
        "status": "success",
        "message": "PHC Pulse demo data created",
        "facility_id": facility.id,
        "facility": facility.name,
        "staff": [
            {
                "id": staff.id,
                "employee_code": staff.employee_code,
                "name": staff.full_name,
                "role": staff.role,
            }
            for staff in staff_members.values()
        ],
    }