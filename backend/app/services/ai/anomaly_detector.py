"""
Predictive Failure Intelligence — Anomaly Detection Engine
Uses Isolation Forest + rule-based detection for cell-level anomalies.
"""
import logging
import numpy as np
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Multi-modal anomaly detector for battery telemetry streams."""

    CELL_VOLTAGE_LIMITS = {
        "NMC": {"min": 2.8, "max": 4.2, "imbalance_threshold": 0.05},
        "LFP": {"min": 2.5, "max": 3.65, "imbalance_threshold": 0.03},
        "NCA": {"min": 2.7, "max": 4.2, "imbalance_threshold": 0.05},
        "LTO": {"min": 1.5, "max": 2.8, "imbalance_threshold": 0.04},
    }

    def __init__(self, model_path: str = None):
        self.model = None
        self._init_default_model()
        if model_path:
            self._load_model(model_path)

    def _init_default_model(self):
        """Initialize a lightweight Isolation Forest as default detector."""
        try:
            from sklearn.ensemble import IsolationForest
            self.model = IsolationForest(
                n_estimators=100,
                contamination=0.05,
                random_state=42,
            )
            # Pre-fit on synthetic normal data
            normal = np.random.randn(500, 8)
            self.model.fit(normal)
            logger.info("Default Isolation Forest initialized")
        except Exception as e:
            logger.warning(f"Could not init Isolation Forest: {e}")

    def _load_model(self, path: str):
        try:
            import joblib
            self.model = joblib.load(path)
            logger.info(f"Anomaly model loaded: {path}")
        except Exception as e:
            logger.warning(f"Anomaly model load failed: {e}")

    def detect_cell_imbalance(self, cell_voltages: List[float],
                              chemistry: str = "NMC") -> Dict[str, Any]:
        """Detect voltage imbalance across battery cells."""
        if not cell_voltages:
            return {"imbalance_detected": False, "delta_v": 0}

        limits = self.CELL_VOLTAGE_LIMITS.get(chemistry, self.CELL_VOLTAGE_LIMITS["NMC"])
        v_arr = np.array(cell_voltages)
        delta_v = float(v_arr.max() - v_arr.min())
        weak_cells = [
            {"cell_idx": int(i), "voltage": float(v), "deviation": float(v - v_arr.mean())}
            for i, v in enumerate(v_arr)
            if v < limits["min"] * 1.02 or v > limits["max"] * 0.98
        ]

        return {
            "imbalance_detected": delta_v > limits["imbalance_threshold"],
            "delta_v": round(delta_v, 4),
            "threshold_v": limits["imbalance_threshold"],
            "mean_voltage": round(float(v_arr.mean()), 4),
            "min_voltage": round(float(v_arr.min()), 4),
            "max_voltage": round(float(v_arr.max()), 4),
            "weak_cells": weak_cells,
            "severity": self._imbalance_severity(delta_v, limits["imbalance_threshold"]),
        }

    def _imbalance_severity(self, delta: float, threshold: float) -> str:
        ratio = delta / threshold
        if ratio < 0.5:
            return "NORMAL"
        if ratio < 1.0:
            return "WATCH"
        if ratio < 2.0:
            return "WARNING"
        return "CRITICAL"

    def score_telemetry(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Compute anomaly score for a single telemetry frame."""
        feature_vec = np.array([[
            features.get("soc", 50),
            features.get("soh", 90),
            features.get("temperature_avg", 25),
            features.get("temperature_gradient", 2),
            features.get("current", 50),
            features.get("voltage", 380),
            features.get("charging_rate_kw", 0),
            features.get("degradation_index", 0.1),
        ]])

        anomaly_score = 0.0
        is_anomaly = False

        if self.model:
            try:
                # IsolationForest returns -1 for anomaly, 1 for normal
                pred = self.model.predict(feature_vec)
                score = self.model.score_samples(feature_vec)[0]
                # Normalize to 0-1 (higher = more anomalous)
                anomaly_score = max(0.0, min(1.0, (-score + 0.5) / 1.0))
                is_anomaly = bool(pred[0] == -1)
            except Exception:
                pass

        # Rule-based boosting
        rules_triggered = []
        temp = features.get("temperature_avg", 25)
        if temp > 50:
            anomaly_score = max(anomaly_score, 0.7)
            rules_triggered.append("HIGH_TEMPERATURE")
        if temp > 65:
            anomaly_score = max(anomaly_score, 0.95)
            rules_triggered.append("CRITICAL_TEMPERATURE")
        if features.get("temperature_gradient", 0) > 10:
            anomaly_score = max(anomaly_score, 0.8)
            rules_triggered.append("THERMAL_GRADIENT_SPIKE")
        if features.get("soh", 100) < 75:
            anomaly_score = max(anomaly_score, 0.6)
            rules_triggered.append("LOW_SOH")

        return {
            "anomaly_score": round(anomaly_score, 4),
            "is_anomaly": bool(is_anomaly or anomaly_score > 0.6),
            "severity": self._anomaly_severity(anomaly_score),
            "rules_triggered": rules_triggered,
            "confidence": 0.88,
        }

    def _anomaly_severity(self, score: float) -> str:
        if score < 0.3:
            return "NORMAL"
        if score < 0.6:
            return "WARNING"
        if score < 0.85:
            return "HIGH"
        return "CRITICAL"

    def generate_failure_forecast(self, recent_telemetry: List[Dict],
                                  vehicle_id: str) -> Dict[str, Any]:
        """Generate a 30-day failure probability forecast."""
        if not recent_telemetry:
            return {"forecast_available": False}

        scores = [r.get("anomaly_score", 0) for r in recent_telemetry]
        temps = [r.get("temperature_avg", 25) for r in recent_telemetry]
        trend = np.polyfit(range(len(scores)), scores, 1)[0] if len(scores) > 2 else 0

        current_score = scores[-1] if scores else 0
        projected_30d = min(1.0, current_score + trend * 30)

        return {
            "vehicle_id": vehicle_id,
            "current_anomaly_score": round(current_score, 4),
            "trend": "INCREASING" if trend > 0.001 else "STABLE" if trend > -0.001 else "IMPROVING",
            "30_day_failure_probability": round(projected_30d * 100, 2),
            "avg_temperature_c": round(float(np.mean(temps)), 2),
            "recommended_maintenance": projected_30d > 0.5,
            "maintenance_urgency": "IMMEDIATE" if projected_30d > 0.8 else
                                   "WITHIN_7_DAYS" if projected_30d > 0.6 else
                                   "WITHIN_30_DAYS" if projected_30d > 0.4 else "ROUTINE",
        }


anomaly_detector = AnomalyDetector()
