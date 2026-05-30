"""Central API router."""
from fastapi import APIRouter
from app.api.v1.endpoints import (
    battery, telemetry, thermal, charging,
    digital_twin, fleet, passport, demo, metrics
)

api_router = APIRouter()

api_router.include_router(battery.router, prefix="/battery", tags=["Battery"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["Telemetry"])
api_router.include_router(thermal.router, prefix="/thermal", tags=["Thermal"])
api_router.include_router(charging.router, prefix="/charging", tags=["Charging"])
api_router.include_router(digital_twin.router, prefix="/digital-twin", tags=["Digital Twin"])
api_router.include_router(fleet.router, prefix="/fleet", tags=["Fleet"])
api_router.include_router(passport.router, prefix="/passport", tags=["Passport"])
api_router.include_router(demo.router, prefix="/demo", tags=["Demo"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["Metrics"])
