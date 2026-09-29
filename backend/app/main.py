from fastapi import FastAPI
from sqlalchemy import text
from app.db.database import engine
from app.models.base import Base

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