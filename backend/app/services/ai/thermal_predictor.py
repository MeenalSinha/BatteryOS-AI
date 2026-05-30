"""
VoltGuard Thermal Intelligence — Predictive Thermal Stress Engine
Predicts battery temperature trajectories and thermal runaway risk.
"""
import math
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class ThermalPredictor:
    """
    Predicts thermal behavior using a lumped thermal model + risk classification.
    Inputs: ambient temp, C-rate, SoC, thermal resistance, heat capacity.
    """

    # Thermal runaway onset temperatures (Celsius) by chemistry
    RUNAWAY_TEMPS = {
        "NMC": {"onset": 130, "propagation": 170, "critical": 200},
        "LFP": {"onset": 195, "propagation": 240, "critical": 270},
        "NCA": {"onset": 120, "propagation": 155, "critical": 185},
        "LTO": {"onset": 210, "propagation": 260, "critical": 300},
    }

    # Thermal resistance (K/W) and heat capacity (J/K) — pack-level defaults
    PACK_DEFAULTS = {
        "NMC": {"R_th": 0.12, "C_th": 4500},
        "LFP": {"R_th": 0.15, "C_th": 5200},
        "NCA": {"R_th": 0.10, "C_th": 4000},
        "LTO": {"R_th": 0.18, "C_th": 6000},
    }

    def __init__(self, model_path: str = None):
        self.model = None
        if model_path:
            self._load_model(model_path)

    def _load_model(self, path: str):
        try:
            import joblib
            self.model = joblib.load(path)
            logger.info(f"Thermal model loaded: {path}")
        except Exception as e:
            logger.warning(f"Thermal model load failed: {e}")

    def _heat_generation(self, current_a: float, voltage_v: float,
                         internal_resistance_ohm: float, soc: float) -> float:
        """Joule + entropic heat generation (W)."""
        joule = (current_a ** 2) * internal_resistance_ohm
        # Simplified entropic heat (negative during charge for NMC)
        entropic = 0.2 * abs(current_a) * (soc / 100 - 0.5)
        return joule + entropic

    def _lumped_thermal_step(self, T_cell: float, T_ambient: float,
                             Q_gen: float, R_th: float, C_th: float,
                             dt_s: float = 60) -> float:
        """Forward Euler step of lumped thermal model."""
        Q_cool = (T_cell - T_ambient) / R_th
        dT = (Q_gen - Q_cool) / C_th * dt_s
        return T_cell + dT

    def predict_temperature_profile(self, params: Dict[str, Any],
                                    horizon_min: int = 60) -> List[Dict[str, Any]]:
        """Predict cell temperature over next horizon_min minutes."""
        chemistry = params.get("chemistry", "NMC")
        T_cell = params.get("current_temp_c", 25.0)
        T_ambient = params.get("ambient_temp_c", 25.0)
        current_a = params.get("current_a", 50.0)
        voltage_v = params.get("voltage_v", 400.0)
        soc = params.get("soc", 50.0)
        r_int = params.get("internal_resistance_mohm", 10.0) / 1000.0
        cooling_power_w = params.get("cooling_power_w", 800.0)

        pack = self.PACK_DEFAULTS.get(chemistry, self.PACK_DEFAULTS["NMC"])
        profile = []

        for minute in range(horizon_min + 1):
            Q_gen = self._heat_generation(current_a, voltage_v, r_int, soc)
            Q_cool_active = cooling_power_w / 3600
            effective_Q = Q_gen - Q_cool_active
            T_cell = self._lumped_thermal_step(
                T_cell, T_ambient, max(0, effective_Q),
                pack["R_th"], pack["C_th"], dt_s=60
            )
            risk = self._thermal_risk_score(T_cell, chemistry)
            profile.append({
                "minute": minute,
                "temperature_c": round(T_cell, 2),
                "heat_gen_w": round(Q_gen, 2),
                "risk_score": round(risk, 3),
                "risk_level": self._risk_level(risk),
            })

        return profile

    def _thermal_risk_score(self, temp_c: float, chemistry: str = "NMC") -> float:
        """Sigmoid-based risk score from 0 (safe) to 1 (critical)."""
        thresholds = self.RUNAWAY_TEMPS.get(chemistry, self.RUNAWAY_TEMPS["NMC"])
        onset = thresholds["onset"]
        critical = thresholds["critical"]
        if temp_c < onset * 0.6:
            return 0.0
        x = (temp_c - onset * 0.6) / (critical - onset * 0.6)
        return round(min(1.0, 1 / (1 + math.exp(-10 * (x - 0.5)))), 4)

    def _risk_level(self, score: float) -> str:
        if score < 0.2:
            return "SAFE"
        if score < 0.5:
            return "ELEVATED"
        if score < 0.8:
            return "HIGH"
        return "CRITICAL"

    def predict_runaway_risk(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Assess thermal runaway probability and time-to-event."""
        profile = self.predict_temperature_profile(params, horizon_min=120)
        chemistry = params.get("chemistry", "NMC")
        thresholds = self.RUNAWAY_TEMPS[chemistry]

        critical_minute = None
        max_risk = 0.0
        for point in profile:
            if point["risk_score"] > max_risk:
                max_risk = point["risk_score"]
            if point["temperature_c"] >= thresholds["onset"] and critical_minute is None:
                critical_minute = point["minute"]

        return {
            "runaway_probability": round(max_risk, 4),
            "risk_level": self._risk_level(max_risk),
            "minutes_to_onset": critical_minute,
            "peak_temperature_c": max(p["temperature_c"] for p in profile),
            "recommended_action": self._recommend_action(max_risk, critical_minute),
            "temperature_profile": profile,
        }

    def _recommend_action(self, risk: float, minutes: int | None) -> str:
        if risk < 0.2:
            return "No action required. Battery operating within normal parameters."
        if risk < 0.5:
            return "Increase cooling flow. Reduce charging rate by 20%."
        if risk < 0.8:
            return "URGENT: Activate maximum cooling. Reduce C-rate to 0.5C immediately."
        return "CRITICAL: Initiate emergency shutdown. Alert operator immediately."


thermal_predictor = ThermalPredictor()
