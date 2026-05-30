"""Battery health, degradation, and explainability endpoints — cache-aware."""
from fastapi import APIRouter, Query, HTTPException
from app.services.ai.degradation_predictor import degradation_predictor
from app.services.ai.anomaly_detector import anomaly_detector
from app.services.ai.explainability import explain_degradation_prediction, explain_anomaly_score
from app.services.telemetry.simulator import TelemetrySimulator
from app.core.cache import cache_get, cache_set
from app.core.notification_engine import notification_engine

router = APIRouter()


@router.get("/health/{vehicle_id}")
async def get_battery_health(
    vehicle_id: str,
    scenario: str = Query("healthy"),
):
    cache_key = f"batteryos:health:{vehicle_id}:{scenario}"
    cached = await cache_get(cache_key)
    if cached:
        cached["_cached"] = True
        return cached

    sim = TelemetrySimulator(vehicle_id=vehicle_id, scenario=scenario)
    telemetry = sim.tick()

    features = {
        "chemistry": telemetry["chemistry"],
        "total_cycles": telemetry["cycle_count"],
        "avg_dod_pct": 65,
        "avg_c_rate": 0.7 if scenario == "healthy" else 1.4,
        "avg_temperature_c": telemetry["temperature_avg"],
        "avg_soc_pct": telemetry["state_of_charge"],
        "age_days": 500,
        "fast_charge_frequency_pct": 10 if scenario == "healthy" else 35,
    }
    soh_result = degradation_predictor.predict_current_soh(features)
    anomaly = anomaly_detector.score_telemetry(telemetry)
    eol = degradation_predictor.estimate_end_of_life(features)

    result = {
        "vehicle_id": vehicle_id,
        "scenario": scenario,
        "telemetry": telemetry,
        "soh_prediction": soh_result,
        "anomaly_detection": anomaly,
        "end_of_life": eol,
        "_cached": False,
    }
    await cache_set(cache_key, result, ttl_seconds=5)
    return result


@router.get("/degradation/{vehicle_id}/trajectory")
async def get_degradation_trajectory(
    vehicle_id: str,
    months: int = Query(36, ge=1, le=120),
    scenario: str = Query("healthy"),
):
    cache_key = f"batteryos:trajectory:{vehicle_id}:{scenario}:{months}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    sim = TelemetrySimulator(vehicle_id=vehicle_id, scenario=scenario)
    t = sim.tick()
    features = {
        "chemistry": t["chemistry"],
        "total_cycles": t["cycle_count"],
        "avg_dod_pct": 65,
        "avg_c_rate": 0.7 if scenario == "healthy" else 1.2,
        "avg_temperature_c": t["temperature_avg"],
        "avg_soc_pct": t["state_of_charge"],
        "age_days": 400,
        "fast_charge_frequency_pct": 10 if scenario == "healthy" else 35,
    }
    trajectory = degradation_predictor.predict_trajectory(features, months_ahead=months)
    eol = degradation_predictor.estimate_end_of_life(features)
    result = {
        "vehicle_id": vehicle_id,
        "trajectory": trajectory,
        "end_of_life_estimate": eol,
        "chemistry": t["chemistry"],
        "scenario": scenario,
    }
    await cache_set(cache_key, result, ttl_seconds=30)
    return result


@router.get("/cell-analysis/{vehicle_id}")
async def get_cell_analysis(vehicle_id: str, scenario: str = Query("healthy")):
    sim = TelemetrySimulator(vehicle_id=vehicle_id, scenario=scenario)
    t = sim.tick()
    imbalance = anomaly_detector.detect_cell_imbalance(t["cell_voltages"], t["chemistry"])
    return {
        "vehicle_id": vehicle_id,
        "cell_count": len(t["cell_voltages"]),
        "chemistry": t["chemistry"],
        "imbalance_analysis": imbalance,
        "cell_voltages": t["cell_voltages"],
        "cell_temperatures": t["cell_temperatures"],
        "scenario": scenario,
    }


@router.get("/explain/{vehicle_id}/degradation")
async def explain_degradation(
    vehicle_id: str,
    scenario: str = Query("healthy"),
):
    """Explainable AI — feature importance for degradation prediction."""
    sim = TelemetrySimulator(vehicle_id=vehicle_id, scenario=scenario)
    t = sim.tick()

    if not degradation_predictor.model_loaded:
        raise HTTPException(
            status_code=503,
            detail="ML model not loaded — run ml/training/train_degradation_model.py first",
        )

    features = {
        "chemistry": t["chemistry"],
        "total_cycles": t["cycle_count"],
        "avg_dod_pct": 65,
        "avg_c_rate": 0.7 if scenario == "healthy" else 1.4,
        "avg_temperature_c": t["temperature_avg"],
        "avg_soc_pct": t["state_of_charge"],
        "age_days": 500,
        "fast_charge_frequency_pct": 10 if scenario == "healthy" else 40,
    }
    explanation = explain_degradation_prediction(degradation_predictor.model, features)
    return {"vehicle_id": vehicle_id, "scenario": scenario, "explanation": explanation}


@router.get("/explain/{vehicle_id}/anomaly")
async def explain_anomaly(
    vehicle_id: str,
    scenario: str = Query("healthy"),
):
    """Explainable AI — anomaly score interpretation."""
    sim = TelemetrySimulator(vehicle_id=vehicle_id, scenario=scenario)
    t = sim.tick()
    anomaly = anomaly_detector.score_telemetry(t)
    explanation = explain_anomaly_score(
        anomaly["anomaly_score"], t, anomaly["rules_triggered"]
    )
    return {"vehicle_id": vehicle_id, "scenario": scenario, "explanation": explanation}


@router.get("/alerts/{vehicle_id}")
async def get_vehicle_alerts(
    vehicle_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    """Return recent alerts for a vehicle from the notification engine."""
    alerts = notification_engine.get_recent_alerts(vehicle_id=vehicle_id, limit=limit)
    return {"vehicle_id": vehicle_id, "alerts": alerts, "count": len(alerts)}


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Acknowledge an alert."""
    ok = notification_engine.acknowledge_alert(alert_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"alert_id": alert_id, "acknowledged": True}


@router.get("/alerts/stats/summary")
async def get_alert_stats():
    return notification_engine.get_stats()
