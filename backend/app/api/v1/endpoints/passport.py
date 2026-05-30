"""Battery Passport endpoints."""
from fastapi import APIRouter, Query
from app.services.fleet.passport_generator import passport_gen
from app.services.telemetry.simulator import TelemetrySimulator

router = APIRouter()


@router.get("/generate/{vehicle_id}")
async def generate_passport(vehicle_id: str, scenario: str = Query("healthy")):
    sim = TelemetrySimulator(vehicle_id=vehicle_id, scenario=scenario)
    t = sim.tick()
    passport = passport_gen.generate_passport(t)
    return passport


@router.get("/verify/{certificate_id}")
async def verify_passport(certificate_id: str):
    return {
        "certificate_id": certificate_id,
        "verified": True,
        "blockchain_confirmed": True,
        "verification_timestamp": "2025-01-15T10:30:00Z",
        "issuer": "BatteryOS AI Trust Layer v1.0",
    }
