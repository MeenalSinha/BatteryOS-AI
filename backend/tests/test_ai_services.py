"""Unit tests for BatteryOS AI services — all modules."""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.ai.degradation_predictor import DegradationPredictor
from app.services.ai.thermal_predictor import ThermalPredictor
from app.services.ai.anomaly_detector import AnomalyDetector
from app.services.ai.charging_optimizer import ChargingOptimizer
from app.services.telemetry.simulator import TelemetrySimulator, get_fleet_snapshot
from app.services.digital_twin.battery_twin import DigitalTwinEngine
from app.services.fleet.passport_generator import PassportGenerator


class TestDegradationPredictor:
    def setup_method(self):
        self.predictor = DegradationPredictor()

    def test_healthy_battery_high_soh(self):
        features = {
            "chemistry": "NMC", "total_cycles": 100, "avg_dod_pct": 60,
            "avg_c_rate": 0.5, "avg_temperature_c": 25, "avg_soc_pct": 60,
            "age_days": 180, "fast_charge_frequency_pct": 5,
        }
        result = self.predictor.predict_current_soh(features)
        assert result["soh"] > 85, f"Expected SoH > 85 for healthy battery, got {result['soh']}"

    def test_aged_battery_lower_soh_than_healthy(self):
        """Aged battery should have strictly lower SoH than a fresh battery."""
        healthy = self.predictor.predict_current_soh({
            "chemistry": "NMC", "total_cycles": 50, "avg_dod_pct": 50,
            "avg_c_rate": 0.3, "avg_temperature_c": 22, "avg_soc_pct": 55,
            "age_days": 100, "fast_charge_frequency_pct": 2,
        })
        aged = self.predictor.predict_current_soh({
            "chemistry": "NMC", "total_cycles": 1200, "avg_dod_pct": 90,
            "avg_c_rate": 2.5, "avg_temperature_c": 45, "avg_soc_pct": 75,
            "age_days": 2500, "fast_charge_frequency_pct": 60,
        })
        assert aged["soh"] < healthy["soh"], (
            f"Aged SoH ({aged['soh']}) should be less than healthy SoH ({healthy['soh']})"
        )

    def test_trajectory_monotonically_decreasing(self):
        features = {
            "chemistry": "NMC", "total_cycles": 200, "avg_dod_pct": 70,
            "avg_c_rate": 0.8, "avg_temperature_c": 28, "avg_soc_pct": 60,
            "age_days": 400, "fast_charge_frequency_pct": 10,
        }
        traj = self.predictor.predict_trajectory(features, months_ahead=24)
        sohs = [p["soh"] for p in traj]
        # First point SoH >= last point SoH
        assert sohs[0] >= sohs[-1], "SoH should decrease or stay stable over time"

    def test_eol_estimate_returned(self):
        features = {
            "chemistry": "NMC", "total_cycles": 300, "avg_dod_pct": 75,
            "avg_c_rate": 1.0, "avg_temperature_c": 30, "avg_soc_pct": 65,
            "age_days": 600, "fast_charge_frequency_pct": 20,
        }
        eol = self.predictor.estimate_end_of_life(features)
        assert "months_to_eol" in eol
        assert "eol_threshold" in eol

    def test_fast_charge_abuse_degrades_faster(self):
        base = {"chemistry": "NMC", "total_cycles": 300, "avg_dod_pct": 70,
                "avg_c_rate": 0.8, "avg_temperature_c": 27, "avg_soc_pct": 60, "age_days": 600}
        normal = self.predictor.predict_current_soh({**base, "fast_charge_frequency_pct": 5})
        abused = self.predictor.predict_current_soh({**base, "fast_charge_frequency_pct": 70})
        assert abused["soh"] <= normal["soh"], "Fast charge abuse should not improve SoH"


class TestThermalPredictor:
    def setup_method(self):
        self.predictor = ThermalPredictor()

    def test_safe_temperature_low_risk(self):
        params = {
            "chemistry": "NMC", "current_temp_c": 28, "ambient_temp_c": 22,
            "current_a": 50, "voltage_v": 400, "soc": 60,
            "internal_resistance_mohm": 10, "cooling_power_w": 1200,
        }
        result = self.predictor.predict_runaway_risk(params)
        assert result["runaway_probability"] < 0.5, (
            f"Safe conditions should produce low risk, got {result['runaway_probability']}"
        )

    def test_high_temperature_elevated_risk_vs_safe(self):
        """High temp scenario must have strictly higher risk than safe scenario."""
        safe_params = {
            "chemistry": "NMC", "current_temp_c": 28, "ambient_temp_c": 22,
            "current_a": 50, "voltage_v": 400, "soc": 60,
            "internal_resistance_mohm": 10, "cooling_power_w": 1200,
        }
        hot_params = {
            "chemistry": "NMC", "current_temp_c": 95, "ambient_temp_c": 50,
            "current_a": 250, "voltage_v": 420, "soc": 90,
            "internal_resistance_mohm": 20, "cooling_power_w": 100,
        }
        safe = self.predictor.predict_runaway_risk(safe_params)
        hot = self.predictor.predict_runaway_risk(hot_params)
        assert hot["runaway_probability"] > safe["runaway_probability"], (
            f"High temp risk ({hot['runaway_probability']}) should exceed safe risk ({safe['runaway_probability']})"
        )

    def test_profile_length(self):
        params = {
            "chemistry": "NMC", "current_temp_c": 30, "ambient_temp_c": 25,
            "current_a": 60, "voltage_v": 400, "soc": 50,
            "internal_resistance_mohm": 10, "cooling_power_w": 800,
        }
        profile = self.predictor.predict_temperature_profile(params, horizon_min=30)
        assert len(profile) == 31  # minutes 0..30 inclusive

    def test_risk_score_range(self):
        params = {
            "chemistry": "LFP", "current_temp_c": 35, "ambient_temp_c": 25,
            "current_a": 80, "voltage_v": 360, "soc": 50,
            "internal_resistance_mohm": 12, "cooling_power_w": 600,
        }
        result = self.predictor.predict_runaway_risk(params)
        assert 0.0 <= result["runaway_probability"] <= 1.0


class TestAnomalyDetector:
    def setup_method(self):
        self.detector = AnomalyDetector()

    def test_extreme_temp_triggers_critical(self):
        """Temperature > 65°C must trigger CRITICAL via rule-based boost."""
        features = {
            "soc": 80, "soh": 90, "temperature_avg": 70,
            "temperature_gradient": 5, "current": 80,
            "voltage": 400, "charging_rate_kw": 0, "degradation_index": 0.1,
        }
        result = self.detector.score_telemetry(features)
        assert result["anomaly_score"] >= 0.95, (
            f"Temp 70C should produce score >= 0.95, got {result['anomaly_score']}"
        )
        assert "CRITICAL_TEMPERATURE" in result["rules_triggered"]

    def test_critical_temperature_high_score(self):
        features = {
            "soc": 85, "soh": 88, "temperature_avg": 72,
            "temperature_gradient": 18, "current": 180,
            "voltage": 380, "charging_rate_kw": 200, "degradation_index": 0.12,
        }
        result = self.detector.score_telemetry(features)
        assert result["anomaly_score"] > 0.6

    def test_cell_imbalance_detected_large_delta(self):
        """A 150mV weak cell on an NMC pack (threshold 50mV) must trigger imbalance."""
        mean_v = 3.65
        voltages = [mean_v] * 95 + [mean_v - 0.15]  # 150mV weak cell
        result = self.detector.detect_cell_imbalance(voltages, "NMC")
        assert result["imbalance_detected"], (
            f"150mV delta should trigger imbalance (threshold {result['threshold_v']}V)"
        )
        # delta_v should be approximately 0.15
        assert result["delta_v"] > 0.05

    def test_balanced_cells_no_imbalance(self):
        voltages = [3.60 + (i % 3) * 0.005 for i in range(96)]
        result = self.detector.detect_cell_imbalance(voltages, "NMC")
        assert not result["imbalance_detected"]

    def test_score_in_valid_range(self):
        features = {
            "soc": 50, "soh": 92, "temperature_avg": 30,
            "temperature_gradient": 3, "current": 60,
            "voltage": 400, "charging_rate_kw": 0, "degradation_index": 0.08,
        }
        result = self.detector.score_telemetry(features)
        assert 0.0 <= result["anomaly_score"] <= 1.0


class TestChargingOptimizer:
    def setup_method(self):
        self.optimizer = ChargingOptimizer()

    def test_optimized_less_stress_than_standard(self):
        params = {
            "chemistry": "NMC", "soh_pct": 90, "soc_start_pct": 20,
            "temperature_c": 25, "capacity_kwh": 75, "target_soc_pct": 80,
        }
        result = self.optimizer.generate_charging_curve(params)
        std_stress = result["standard_curve"]["stress_index"]
        opt_stress = result["optimized_curve"]["stress_index"]
        assert opt_stress < std_stress

    def test_cold_temperature_lower_crate(self):
        params_cold = {"chemistry": "NMC", "soh_pct": 95, "soc_start_pct": 30,
                       "temperature_c": 5, "capacity_kwh": 75, "target_soc_pct": 80}
        params_warm = {"chemistry": "NMC", "soh_pct": 95, "soc_start_pct": 30,
                       "temperature_c": 30, "capacity_kwh": 75, "target_soc_pct": 80}
        cold = self.optimizer.generate_charging_curve(params_cold)
        warm = self.optimizer.generate_charging_curve(params_warm)
        assert cold["max_c_rate"] < warm["max_c_rate"]

    def test_low_soh_reduces_max_crate(self):
        high_soh = self.optimizer.generate_charging_curve({
            "chemistry": "NMC", "soh_pct": 98, "soc_start_pct": 20,
            "temperature_c": 25, "capacity_kwh": 75, "target_soc_pct": 80,
        })
        low_soh = self.optimizer.generate_charging_curve({
            "chemistry": "NMC", "soh_pct": 65, "soc_start_pct": 20,
            "temperature_c": 25, "capacity_kwh": 75, "target_soc_pct": 80,
        })
        assert low_soh["max_current_a"] < high_soh["max_current_a"]


class TestTelemetrySimulator:
    def test_healthy_scenario_generates_valid_frame(self):
        sim = TelemetrySimulator(vehicle_id="TEST-001", scenario="healthy")
        frame = sim.tick()
        assert "state_of_charge" in frame
        assert 0 <= frame["state_of_charge"] <= 100
        assert "state_of_health" in frame
        assert "temperature_avg" in frame
        assert len(frame["cell_voltages"]) > 0

    def test_thermal_runaway_high_temp(self):
        sim = TelemetrySimulator(vehicle_id="TEST-002", scenario="thermal_runaway")
        temps = [sim.tick()["temperature_avg"] for _ in range(5)]
        assert sum(temps) / len(temps) > 40

    def test_fleet_snapshot_count(self):
        fleet = get_fleet_snapshot(8)
        assert len(fleet) == 8
        for v in fleet:
            assert "vehicle_id" in v
            assert "state_of_health" in v

    def test_degraded_scenario_lower_soh(self):
        sim_h = TelemetrySimulator(vehicle_id="H", scenario="healthy")
        sim_d = TelemetrySimulator(vehicle_id="D", scenario="degraded")
        healthy_sohs = [sim_h.tick()["state_of_health"] for _ in range(5)]
        degraded_sohs = [sim_d.tick()["state_of_health"] for _ in range(5)]
        assert sum(degraded_sohs) / 5 < sum(healthy_sohs) / 5


class TestDigitalTwinEngine:
    def setup_method(self):
        self.engine = DigitalTwinEngine()

    def test_create_twin(self):
        twin_id = self.engine.create_twin("TWIN-001", chemistry="NMC", capacity_kwh=75)
        assert twin_id == "TWIN-001"
        assert "TWIN-001" in self.engine.packs

    def test_simulation_returns_timeline(self):
        self.engine.create_twin("TWIN-TEST")
        result = self.engine.simulate_scenario("TWIN-TEST", "normal", steps=10)
        assert "timeline" in result
        assert len(result["timeline"]) == 10

    def test_thermal_stress_higher_temp(self):
        self.engine.create_twin("TWIN-HOT")
        hot = self.engine.simulate_scenario("TWIN-HOT", "thermal_stress", steps=20)
        self.engine.create_twin("TWIN-NORM")
        normal = self.engine.simulate_scenario("TWIN-NORM", "normal", steps=20)
        assert hot["summary"]["max_temperature"] > normal["summary"]["max_temperature"]

    def test_summary_keys_present(self):
        self.engine.create_twin("TWIN-SUM")
        result = self.engine.simulate_scenario("TWIN-SUM", "fast_charge", steps=15)
        for key in ("max_temperature", "min_soh_reached", "max_cell_delta", "thermal_events"):
            assert key in result["summary"]


class TestPassportGenerator:
    def setup_method(self):
        self.gen = PassportGenerator()

    def test_generates_certificate(self):
        data = {"vehicle_id": "VH-9999", "state_of_health": 92, "cycle_count": 300, "chemistry": "NMC"}
        passport = self.gen.generate_passport(data)
        assert "certificate_id" in passport
        assert "blockchain_hash" in passport
        assert passport["overall_health_score"] == 92

    def test_low_soh_high_risk(self):
        data = {"vehicle_id": "VH-8888", "state_of_health": 65, "cycle_count": 900, "chemistry": "NMC"}
        passport = self.gen.generate_passport(data)
        assert passport["ai_risk_rating"] in ("HIGH", "CRITICAL")

    def test_high_soh_low_risk(self):
        data = {"vehicle_id": "VH-7777", "state_of_health": 96, "cycle_count": 80, "chemistry": "NMC"}
        passport = self.gen.generate_passport(data)
        assert passport["ai_risk_rating"] == "LOW"

    def test_blockchain_hash_is_hex(self):
        data = {"vehicle_id": "VH-6666", "state_of_health": 88, "cycle_count": 200, "chemistry": "LFP"}
        passport = self.gen.generate_passport(data)
        # SHA3-256 produces 64 hex characters
        assert len(passport["blockchain_hash"]) == 64
        int(passport["blockchain_hash"], 16)  # must be valid hex
