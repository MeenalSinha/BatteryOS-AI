"""Live telemetry endpoints — cache-aware with InfluxDB writes and real anomaly scoring."""
from fastapi import APIRouter, Query
from app.services.telemetry.simulator import TelemetrySimulator, get_fleet_snapshot
from app.services.ai.anomaly_detector import anomaly_detector
from app.core.cache import cache_get, cache_set
from app.core.influx_writer import write_telemetry
from app.core.notification_engine import notification_engine

router = APIRouter()


@router.get("/live/{vehicle_id}")
async def get_live_telemetry(
    vehicle_id: str,
    scenario: str = Query("healthy"),
):
    """Single live telemetry frame with real anomaly scoring."""
    # Check cache first (max 2s stale)
    cache_key = f"batteryos:latest:{vehicle_id}:telemetry"
    cached = await cache_get(cache_key)
    if cached and cached.get("scenario") == scenario:
        cached["_source"] = "cache"
        return cached

    sim = TelemetrySimulator(vehicle_id=vehicle_id, scenario=scenario)
    data = sim.tick()

    # Real anomaly scoring
    anomaly = anomaly_detector.score_telemetry(data)
    data["anomaly_score"] = anomaly["anomaly_score"]
    data["anomaly_severity"] = anomaly["severity"]
    data["rules_triggered"] = anomaly["rules_triggered"]

    # Generate notifications
    alerts = notification_engine.evaluate_telemetry(data)
    data["active_alerts"] = [a.to_dict() for a in alerts]

    # Write to InfluxDB
    try:
        write_telemetry(data)
    except Exception:
        pass

    # Cache
    await cache_set(cache_key, data, ttl_seconds=2)
    data["_source"] = "live"
    return data


@router.get("/stream/{vehicle_id}/batch")
async def get_telemetry_batch(
    vehicle_id: str,
    count: int = Query(10, ge=1, le=100),
    scenario: str = Query("healthy"),
):
    """Batch of telemetry frames — each scored by anomaly detector."""
    sim = TelemetrySimulator(vehicle_id=vehicle_id, scenario=scenario)
    records = []
    for _ in range(count):
        frame = sim.tick()
        score = anomaly_detector.score_telemetry(frame)
        frame["anomaly_score"] = score["anomaly_score"]
        frame["anomaly_severity"] = score["severity"]
        records.append(frame)
    return {
        "vehicle_id": vehicle_id,
        "scenario": scenario,
        "count": len(records),
        "records": records,
    }


@router.get("/fleet/snapshot")
async def get_fleet_telemetry(
    num_vehicles: int = Query(10, ge=1, le=50),
):
    """Fleet snapshot — all vehicles with anomaly scores."""
    cache_key = f"batteryos:fleet:snapshot:{num_vehicles}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    vehicles = get_fleet_snapshot(num_vehicles)
    for v in vehicles:
        score = anomaly_detector.score_telemetry(v)
        v["anomaly_score"] = score["anomaly_score"]
        v["anomaly_severity"] = score["severity"]

    result = {"vehicle_count": len(vehicles), "vehicles": vehicles}
    await cache_set(cache_key, result, ttl_seconds=3)
    return result


@router.get("/history/{vehicle_id}")
async def get_telemetry_history(
    vehicle_id: str,
    scenario: str = Query("healthy"),
    points: int = Query(60, ge=10, le=500),
):
    """
    Simulated historical telemetry — generates a realistic time-series
    for charting without requiring a running database.
    """
    import math
    import random
    from datetime import datetime, timedelta, timezone

    random.seed(hash(vehicle_id) % 1000)
    base_configs = {
        "healthy":           {"soh": 94, "temp": 27, "anomaly": 0.06},
        "degraded":          {"soh": 73, "temp": 40, "anomaly": 0.42},
        "thermal_runaway":   {"soh": 86, "temp": 72, "anomaly": 0.85},
        "aggressive":        {"soh": 84, "temp": 50, "anomaly": 0.38},
        "fast_charge_abuse": {"soh": 78, "temp": 56, "anomaly": 0.58},
    }
    cfg = base_configs.get(scenario, base_configs["healthy"])
    now = datetime.now(timezone.utc)

    records = []
    soc = 50.0
    temp = cfg["temp"]
    for i in range(points):
        t = now - timedelta(seconds=(points - i) * 5)
        soc = max(5, min(100, soc + random.gauss(0, 0.8)))
        temp = max(cfg["temp"] - 8, min(cfg["temp"] + 15,
                    temp + random.gauss(0, 0.6)))
        anomaly = max(0, min(1, cfg["anomaly"] + random.gauss(0, 0.05)))
        records.append({
            "timestamp": t.isoformat(),
            "state_of_charge": round(soc, 1),
            "state_of_health": round(cfg["soh"] + random.gauss(0, 0.3), 2),
            "temperature_avg": round(temp, 1),
            "anomaly_score": round(anomaly, 4),
            "thermal_risk_score": round(max(0, (temp - 40) / 50), 4),
            "voltage": round(350 + soc * 0.5 + random.gauss(0, 1), 2),
            "current": round(random.gauss(50, 20), 1),
            "power_kw": round(abs(random.gauss(20, 10)), 2),
            "is_charging": soc < 30,
        })
    return {
        "vehicle_id": vehicle_id,
        "scenario": scenario,
        "points": len(records),
        "records": records,
    }
