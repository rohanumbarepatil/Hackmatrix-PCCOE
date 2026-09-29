from fastapi import FastAPI

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
    return {
        "status": "healthy"
    }