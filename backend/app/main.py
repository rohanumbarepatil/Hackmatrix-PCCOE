from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session

from app.db.database import engine, get_db
from app.models.base import Base
from app.services.readiness_engine import evaluate_staff_readiness
from app.services.demo_seed import seed_demo_data

app = FastAPI(
    title="PHC Pulse API",
    description="PHC Staffing & Service-Availability Monitoring",
    version="0.1.0",
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

@app.post("/setup/seed")
def seed_data():
    db = next(get_db())
    return seed_demo_data(db)