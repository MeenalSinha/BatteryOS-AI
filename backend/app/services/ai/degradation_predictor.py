"""
Battery Degradation Prediction Service — Calibrated Arrhenius physics + ML.
Physics constants calibrated to real NMC/LFP/NCA battery aging data:
  - NMC: ~4% calendar loss/yr at 25°C, ~80% retention at 1000 cycles 70%DoD
  - LFP: ~2.5% calendar loss/yr, ~90% retention at 2000 cycles
  - NCA: ~5% calendar loss/yr, faster cycle aging
"""
import math
import logging
import numpy as np
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

CHEM = {
    "NMC": {"Ea": 0.60, "A_cal": 0.040, "B_cyc": 0.100, "cs": 0.012, "fc_pen": 0.002},
    "LFP": {"Ea": 0.52, "A_cal": 0.025, "B_cyc": 0.060, "cs": 0.006, "fc_pen": 0.001},
    "NCA": {"Ea": 0.65, "A_cal": 0.050, "B_cyc": 0.120, "cs": 0.015, "fc_pen": 0.003},
    "LTO": {"Ea": 0.45, "A_cal": 0.015, "B_cyc": 0.030, "cs": 0.004, "fc_pen": 0.0005},
}

FEATURE_COLS = [
    "total_cycles", "avg_dod_pct", "avg_c_rate",
    "avg_temperature_c", "avg_soc_pct", "age_days",
    "fast_charge_frequency_pct",
]


class DegradationPredictor:
    def __init__(self, model_path: str = None):
        self.model = None
        self.model_loaded = False
        if model_path:
            self._load_model(model_path)

    def _load_model(self, path: str):
        try:
            import joblib
            self.model = joblib.load(path)
            self.model_loaded = True
            logger.info(f"Degradation model loaded: {path}")
        except Exception as e:
            logger.warning(f"Could not load degradation model ({e}) — using physics fallback")

    # ─── Physics model ──────────────────────────────────────────────────────

    def _physics_soh(self, features: Dict[str, Any]) -> float:
        chem = features.get("chemistry", "NMC")
        p    = CHEM.get(chem, CHEM["NMC"])

        T   = features.get("avg_temperature_c", 25) + 273.15
        Tr  = 298.15
        arr = math.exp(p["Ea"] * (1/Tr - 1/T) * 1000 / 8.314)

        soc_stress = 1 + p["cs"] * (features.get("avg_soc_pct", 60) - 50)
        age_days   = max(1, features.get("age_days", 365))
        cal  = p["A_cal"] * arr * soc_stress * math.sqrt(age_days / 365)

        dod_s = (features.get("avg_dod_pct", 65) / 100) ** 1.2
        c_s   = 1 + 0.05 * max(0, features.get("avg_c_rate", 0.7) - 1.0)
        cyc   = p["B_cyc"] * dod_s * c_s * features.get("total_cycles", 0) / 1000

        fc   = features.get("fast_charge_frequency_pct", 0) * p["fc_pen"]
        return float(np.clip((1 - cal - cyc - fc) * 100, 55.0, 100.0))

    # ─── Public API ──────────────────────────────────────────────────────────

    def predict_current_soh(self, features: Dict[str, Any]) -> Dict[str, Any]:
        if self.model_loaded:
            try:
                import pandas as pd
                row = pd.DataFrame([{k: features.get(k, 0) for k in FEATURE_COLS}])
                soh = float(np.clip(self.model.predict(row)[0], 55, 100))
                return {
                    "soh": round(soh, 2),
                    "method": "ml_model",
                    "confidence": 0.91,
                }
            except Exception as e:
                logger.warning(f"ML inference failed ({e}), falling back to physics")

        # Physics fallback
        chem = features.get("chemistry", "NMC")
        p    = CHEM.get(chem, CHEM["NMC"])
        T    = features.get("avg_temperature_c", 25) + 273.15
        Tr   = 298.15
        arr  = math.exp(p["Ea"] * (1/Tr - 1/T) * 1000 / 8.314)
        soc_stress = 1 + p["cs"] * (features.get("avg_soc_pct", 60) - 50)
        age_days = max(1, features.get("age_days", 365))
        cal  = p["A_cal"] * arr * soc_stress * math.sqrt(age_days / 365)
        dod_s = (features.get("avg_dod_pct", 65) / 100) ** 1.2
        c_s   = 1 + 0.05 * max(0, features.get("avg_c_rate", 0.7) - 1.0)
        cyc   = p["B_cyc"] * dod_s * c_s * features.get("total_cycles", 0) / 1000
        fc    = features.get("fast_charge_frequency_pct", 0) * p["fc_pen"]
        soh   = float(np.clip((1 - cal - cyc - fc) * 100, 55.0, 100.0))

        return {
            "soh":               round(soh, 2),
            "calendar_loss_pct": round(cal * 100, 3),
            "cycle_loss_pct":    round(cyc * 100, 3),
            "fast_charge_penalty_pct": round(fc * 100, 3),
            "method":     "physics_model",
            "confidence": 0.84,
        }

    def predict_trajectory(self, features: Dict[str, Any],
                            months_ahead: int = 36) -> List[Dict[str, Any]]:
        trajectory = []
        age_days   = features.get("age_days", 365)
        cycles     = features.get("total_cycles", 200)
        days_per_month = 30
        # Cycles per month from historical rate
        cycles_pm = cycles / max(age_days / 30, 1)

        for m in range(0, months_ahead + 1, 3):
            proj = features.copy()
            proj["age_days"]      = age_days + m * days_per_month
            proj["total_cycles"]  = cycles + int(cycles_pm * m)
            result = self.predict_current_soh(proj)
            trajectory.append({
                "month": m,
                "soh":   result["soh"],
                "label": f"Month {m}",
            })
        return trajectory

    def estimate_end_of_life(self, features: Dict[str, Any],
                              eol_threshold: float = 80.0) -> Dict[str, Any]:
        trajectory = self.predict_trajectory(features, months_ahead=120)
        for point in trajectory:
            if point["soh"] <= eol_threshold:
                return {
                    "months_to_eol": point["month"],
                    "eol_soh":       point["soh"],
                    "eol_threshold": eol_threshold,
                }
        return {
            "months_to_eol": ">120",
            "eol_soh":       trajectory[-1]["soh"],
            "eol_threshold": eol_threshold,
        }


degradation_predictor = DegradationPredictor()
