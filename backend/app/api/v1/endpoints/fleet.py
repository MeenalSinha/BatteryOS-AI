"""Fleet Intelligence endpoints — cache-aware with InfluxDB metrics."""
from fastapi import APIRouter, Query
from app.services.fleet.fleet_analytics import fleet_engine
from app.core.cache import cache_get, cache_set
from app.core.influx_writer import write_fleet_metrics
from app.core.notification_engine import notification_engine

router = APIRouter()


@router.get("/dashboard")
async def fleet_dashboard(
    fleet_id: str = Query("FLEET-001"),
    num_vehicles: int = Query(10, ge=1, le=50),
):
    cache_key = f"batteryos:fleet:dashboard:{fleet_id}:{num_vehicles}"
    cached = await cache_get(cache_key)
    if cached:
        cached["_cached"] = True
        return cached

    data = fleet_engine.get_fleet_dashboard(fleet_id, num_vehicles)

    # Write aggregate fleet metrics to InfluxDB
    try:
        write_fleet_metrics(data)
    except Exception:
        pass

    await cache_set(cache_key, data, ttl_seconds=5)
    data["_cached"] = False
    return data


@router.get("/summary/{fleet_id}")
async def fleet_summary(fleet_id: str, num_vehicles: int = Query(10)):
    data = fleet_engine.get_fleet_dashboard(fleet_id, num_vehicles)
    return {
        "fleet_id": fleet_id,
        "summary": data["summary"],
        "risk": data["risk_distribution"],
        "thermal_hotspots": data["thermal_hotspots"],
    }


@router.get("/alerts")
async def fleet_alerts(limit: int = Query(30, ge=1, le=200)):
    """All active alerts across the fleet from the notification engine."""
    alerts = notification_engine.get_recent_alerts(limit=limit)
    stats = notification_engine.get_stats()
    return {"alerts": alerts, "stats": stats}


@router.get("/compare")
async def compare_vehicles(
    vehicle_ids: str = Query(..., description="Comma-separated vehicle IDs"),
    scenario: str = Query("mixed"),
):
    """
    Compare multiple vehicles side-by-side.
    Accepts comma-separated vehicle_ids, returns per-vehicle breakdown.
    """
    from app.services.telemetry.simulator import TelemetrySimulator, SCENARIOS
    from app.services.ai.degradation_predictor import degradation_predictor
    from app.services.ai.anomaly_detector import anomaly_detector
    import random

    ids = [v.strip() for v in vehicle_ids.split(",") if v.strip()][:10]
    scenarios = list(SCENARIOS.keys())

    results = []
    for i, vid in enumerate(ids):
        sc = scenario if scenario in SCENARIOS else scenarios[i % len(scenarios)]
        sim = TelemetrySimulator(vehicle_id=vid, scenario=sc)
        t = sim.tick()

        features = {
            "chemistry": t["chemistry"],
            "total_cycles": t["cycle_count"],
            "avg_dod_pct": 65,
            "avg_c_rate": 0.8,
            "avg_temperature_c": t["temperature_avg"],
            "avg_soc_pct": t["state_of_charge"],
            "age_days": 400 + (sum(ord(c) for c in vid) % 800),  # deterministic from vehicle ID
            "fast_charge_frequency_pct": 15,
        }
        soh = degradation_predictor.predict_current_soh(features)
        anomaly = anomaly_detector.score_telemetry(t)
        eol = degradation_predictor.estimate_end_of_life(features)

        results.append({
            "vehicle_id": vid,
            "scenario": sc,
            "chemistry": t["chemistry"],
            "capacity_kwh": t["capacity_kwh"],
            "state_of_charge": t["state_of_charge"],
            "state_of_health": soh["soh"],
            "temperature_avg": t["temperature_avg"],
            "anomaly_score": anomaly["anomaly_score"],
            "anomaly_severity": anomaly["severity"],
            "months_to_eol": eol["months_to_eol"],
            "cycle_count": t["cycle_count"],
            "thermal_risk_score": t["thermal_risk_score"],
            "is_charging": t["is_charging"],
        })

    # Rank by health
    results.sort(key=lambda x: x["state_of_health"], reverse=True)
    for i, r in enumerate(results):
        r["health_rank"] = i + 1

    return {
        "vehicle_count": len(results),
        "vehicles": results,
        "best_vehicle": results[0]["vehicle_id"] if results else None,
        "worst_vehicle": results[-1]["vehicle_id"] if results else None,
    }


@router.get("/maintenance-schedule")
async def maintenance_schedule(
    fleet_id: str = Query("FLEET-001"),
    num_vehicles: int = Query(10, ge=1, le=50),
):
    """Priority-ordered maintenance schedule for the entire fleet."""
    data = fleet_engine.get_fleet_dashboard(fleet_id, num_vehicles)
    schedule = data.get("maintenance_predictions", [])
    return {
        "fleet_id": fleet_id,
        "generated_at": data.get("generated_at"),
        "schedule": schedule,
        "total_vehicles": data["total_vehicles"],
        "vehicles_requiring_maintenance": len(schedule),
    }
