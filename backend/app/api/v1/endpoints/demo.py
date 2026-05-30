"""Hackathon Demo Mode endpoints — preloaded scenarios for judges."""
from fastapi import APIRouter
from app.services.telemetry.simulator import TelemetrySimulator
from app.services.ai.thermal_predictor import thermal_predictor
from app.services.ai.degradation_predictor import degradation_predictor
from app.services.ai.anomaly_detector import anomaly_detector

router = APIRouter()

DEMO_SCENARIOS = [
    "healthy", "degraded", "thermal_runaway", "aggressive", "fast_charge_abuse"
]


@router.get("/scenarios")
async def list_demo_scenarios():
    return {
        "scenarios": [
            {"id": "healthy", "label": "Healthy Battery", "color": "#00ff88", "icon": "check"},
            {"id": "degraded", "label": "Degraded Battery", "color": "#ffaa00", "icon": "warning"},
            {"id": "thermal_runaway", "label": "Thermal Runaway Risk", "color": "#ff3333", "icon": "fire"},
            {"id": "aggressive", "label": "Aggressive Driving", "color": "#ff6600", "icon": "speed"},
            {"id": "fast_charge_abuse", "label": "Fast Charge Abuse", "color": "#cc00ff", "icon": "bolt"},
        ]
    }


@router.get("/run/{scenario}")
async def run_demo_scenario(scenario: str):
    """Run a complete demo scenario with all AI modules active."""
    if scenario not in DEMO_SCENARIOS:
        return {"error": f"Unknown scenario. Choose from: {DEMO_SCENARIOS}"}

    sim = TelemetrySimulator(vehicle_id=f"DEMO-{scenario.upper()}", scenario=scenario)
    telemetry = sim.tick()

    # Run all AI modules
    features = {
        "chemistry": telemetry["chemistry"],
        "total_cycles": telemetry["cycle_count"],
        "avg_dod_pct": 70,
        "avg_c_rate": 0.8,
        "avg_temperature_c": telemetry["temperature_avg"],
        "avg_soc_pct": telemetry["state_of_charge"],
        "age_days": 500,
        "fast_charge_frequency_pct": 30 if scenario == "fast_charge_abuse" else 10,
    }

    soh = degradation_predictor.predict_current_soh(features)
    trajectory = degradation_predictor.predict_trajectory(features, months_ahead=24)
    anomaly = anomaly_detector.score_telemetry(telemetry)
    imbalance = anomaly_detector.detect_cell_imbalance(
        telemetry["cell_voltages"], telemetry["chemistry"]
    )

    thermal_params = {
        "chemistry": telemetry["chemistry"],
        "current_temp_c": telemetry["temperature_avg"],
        "ambient_temp_c": telemetry["ambient_temp"],
        "current_a": abs(telemetry["current"]),
        "voltage_v": telemetry["voltage"],
        "soc": telemetry["state_of_charge"],
        "internal_resistance_mohm": 10,
        "cooling_power_w": 800,
    }
    thermal = thermal_predictor.predict_runaway_risk(thermal_params)

    return {
        "scenario": scenario,
        "telemetry": telemetry,
        "ai_results": {
            "degradation": soh,
            "trajectory": trajectory,
            "anomaly": anomaly,
            "cell_imbalance": imbalance,
            "thermal_risk": thermal,
        },
        "alerts": _generate_alerts(scenario, anomaly, thermal, soh),
    }


def _generate_alerts(scenario, anomaly, thermal, soh):
    alerts = []
    if anomaly["anomaly_score"] > 0.6:
        alerts.append({
            "type": "ANOMALY",
            "severity": anomaly["severity"],
            "message": f"Anomaly detected — score {anomaly['anomaly_score']:.2f}",
        })
    if thermal["runaway_probability"] > 0.4:
        alerts.append({
            "type": "THERMAL_RISK",
            "severity": thermal["risk_level"],
            "message": thermal["recommended_action"],
        })
    if soh["soh"] < 80:
        alerts.append({
            "type": "DEGRADATION",
            "severity": "WARNING",
            "message": f"Battery SoH at {soh['soh']:.1f}% — schedule inspection",
        })
    return alerts
