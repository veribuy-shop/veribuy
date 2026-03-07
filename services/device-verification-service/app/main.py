from fastapi import FastAPI
from app.config import settings
from app.routers import verification
from app.tracing import instrument_app

app = FastAPI(
    title="VeriBuy Device Verification Service",
    description="IMEI/serial validation via imeicheck.com & ifreeicloud.com",
    version="0.1.0",
)

# Instrument with OpenTelemetry
instrument_app(app)

app.include_router(verification.router, prefix="/device-verification", tags=["verification"])


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "device-verification-service",
        "version": "0.1.0",
    }
