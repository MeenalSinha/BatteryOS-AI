"""Digital Twin simulation endpoints."""
from fastapi import APIRouter, Query
from app.services.digital_twin.battery_twin import digital_twin_engine

router = APIRouter()


@router.post("/create/{twin_id}")
async def create_twin(twin_id: str, chemistry: str = Query("NMC"),
                      capacity_kwh: float = Query(75.0)):
    digital_twin_engine.create_twin(twin_id, chemistry=chemistry, capacity_kwh=capacity_kwh)
    return {"twin_id": twin_id, "status": "created", "chemistry": chemistry}


@router.get("/simulate/{twin_id}")
async def simulate_scenario(
    twin_id: str,
    scenario: str = Query("normal"),
    steps: int = Query(60, ge=5, le=300),
):
    if twin_id not in digital_twin_engine.packs:
        digital_twin_engine.create_twin(twin_id)
    result = digital_twin_engine.simulate_scenario(twin_id, scenario, steps=steps)
    return result


@router.get("/scenarios")
async def list_scenarios():
    return {"scenarios": list(digital_twin_engine.SCENARIOS.keys()),
            "descriptions": digital_twin_engine.SCENARIOS}


@router.get("/state/{twin_id}")
async def get_twin_state(twin_id: str):
    return digital_twin_engine.get_twin_state(twin_id)
