"""VoltGuard Thermal Intelligence endpoints."""
from fastapi import APIRouter, Query
from app.services.ai.thermal_predictor import thermal_predictor
from app.services.telemetry.simulator import TelemetrySimulator

router = APIRouter()


@router.get("/predict/{vehicle_id}")
async def predict_thermal(vehicle_id: str, scenario: str = Query("healthy")):
    sim = TelemetrySimulator(vehicle_id=vehicle_id, scenario=scenario)
    t = sim.tick()
    params = {
        "chemistry": t["chemistry"],
        "current_temp_c": t["temperature_avg"],
        "ambient_temp_c": t["ambient_temp"],
        "current_a": abs(t["current"]),
        "voltage_v": t["voltage"],
        "soc": t["state_of_charge"],
        "internal_resistance_mohm": 10,
        "cooling_power_w": 1200,
    }
    return {
        "vehicle_id": vehicle_id,
        "current_state": {"temperature": t["temperature_avg"], "thermal_risk": t["thermal_risk_score"]},
        "runaway_risk": thermal_predictor.predict_runaway_risk(params),
    }


@router.get("/heatmap/{vehicle_id}")
async def get_thermal_heatmap(vehicle_id: str, scenario: str = Query("healthy")):
    sim = TelemetrySimulator(vehicle_id=vehicle_id, scenario=scenario)
    t = sim.tick()
    return {
        "vehicle_id": vehicle_id,
        "cell_temperatures": t["cell_temperatures"],
        "avg_temperature": t["temperature_avg"],
        "max_temperature": t["temperature_max"],
        "min_temperature": t["temperature_min"],
        "gradient": t["temperature_gradient"],
    }
