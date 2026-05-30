"""Dynamic Charging Orchestrator endpoints."""
from fastapi import APIRouter, Query
from app.services.ai.charging_optimizer import charging_optimizer
from app.services.telemetry.simulator import TelemetrySimulator

router = APIRouter()


@router.get("/optimize/{vehicle_id}")
async def optimize_charging(
    vehicle_id: str,
    target_soc: float = Query(80, ge=50, le=100),
    scenario: str = Query("healthy"),
):
    sim = TelemetrySimulator(vehicle_id=vehicle_id, scenario=scenario)
    t = sim.tick()
    params = {
        "chemistry": t["chemistry"],
        "soh_pct": t["state_of_health"],
        "soc_start_pct": t["state_of_charge"],
        "temperature_c": t["temperature_avg"],
        "capacity_kwh": t["capacity_kwh"],
        "target_soc_pct": target_soc,
    }
    return {
        "vehicle_id": vehicle_id,
        "battery_state": {
            "soc": t["state_of_charge"],
            "soh": t["state_of_health"],
            "temperature": t["temperature_avg"],
        },
        "charging_plan": charging_optimizer.generate_charging_curve(params),
    }
