"""
Synthetic Battery Telemetry Simulator
Generates realistic battery telemetry for demo/development purposes.
"""
import random
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import uuid


SCENARIOS = {
    "healthy": {
        "soh_range": (88, 98),
        "temp_range": (22, 35),
        "soc_range": (20, 90),
        "anomaly_probability": 0.02,
        "label": "Healthy Battery — Normal Operation",
    },
    "degraded": {
        "soh_range": (65, 78),
        "temp_range": (30, 48),
        "soc_range": (20, 80),
        "anomaly_probability": 0.18,
        "label": "Degraded Battery — Aging Detected",
    },
    "thermal_runaway": {
        "soh_range": (80, 90),
        "temp_range": (55, 95),
        "soc_range": (50, 90),
        "anomaly_probability": 0.80,
        "label": "Thermal Runaway Risk — CRITICAL",
    },
    "aggressive": {
        "soh_range": (78, 92),
        "temp_range": (38, 58),
        "soc_range": (10, 95),
        "anomaly_probability": 0.25,
        "label": "Aggressive Driving — High Stress",
    },
    "fast_charge_abuse": {
        "soh_range": (72, 85),
        "temp_range": (40, 65),
        "soc_range": (10, 100),
        "anomaly_probability": 0.40,
        "label": "Fast Charge Abuse — Accelerated Degradation",
    },
}


_simulators = {}


class TelemetrySimulator:
    def __new__(cls, vehicle_id: str = None, scenario: str = "healthy", *args, **kwargs):
        vid = vehicle_id or "unknown"
        key = f"{vid}_{scenario}"
        if key not in _simulators:
            instance = super().__new__(cls)
            instance._initialized = False
            _simulators[key] = instance
        return _simulators[key]

    def __init__(self, vehicle_id: str = None, scenario: str = "healthy",
                 chemistry: str = "NMC", capacity_kwh: float = 75.0):
        if getattr(self, "_initialized", False):
            return

        self.vehicle_id = vehicle_id or "unknown"
        self.scenario = SCENARIOS.get(scenario, SCENARIOS["healthy"])
        self.scenario_name = scenario
        self.chemistry = chemistry
        self.capacity_kwh = capacity_kwh

        self._initialized = True

        # Mutable state
        self.soc = random.uniform(*self.scenario["soc_range"])
        self.soh = random.uniform(*self.scenario["soh_range"])
        self.temp = random.uniform(*self.scenario["temp_range"])
        self.cycle_count = random.randint(50, 500)
        self.is_charging = random.random() < 0.3

        # Cell count based on capacity
        self.num_cells = int(capacity_kwh * 10)

    def _generate_cell_voltages(self) -> List[float]:
        """Generate per-cell voltages with realistic spread."""
        base_v = 3.6 + (self.soc - 50) / 100
        spread = 0.02 + random.random() * 0.03
        if self.scenario_name in ("degraded", "fast_charge_abuse"):
            spread *= 2.5
        cells = [round(base_v + random.gauss(0, spread / 3), 3)
                 for _ in range(min(self.num_cells, 96))]
        # Inject a weak cell in non-healthy scenarios
        if self.scenario_name != "healthy" and random.random() < 0.3:
            weak_idx = random.randint(0, len(cells) - 1)
            cells[weak_idx] -= random.uniform(0.08, 0.15)
        return cells

    def _generate_cell_temperatures(self) -> List[float]:
        cells = len(self._generate_cell_voltages())
        return [round(self.temp + random.gauss(0, 2), 1) for _ in range(cells)]

    def tick(self) -> Dict[str, Any]:
        """Advance simulation by one tick and return telemetry frame."""
        # Initialize velocity if missing
        if not hasattr(self, "temp_velocity"):
            self.temp_velocity = 0.0

        # Smooth momentum for temperature (Ornstein-Uhlenbeck style)
        self.temp_velocity = self.temp_velocity * 0.85 + random.gauss(0, 0.15)

        # If in thermal runaway, force temperature up
        if self.scenario_name == "thermal_runaway":
            self.temp_velocity += 0.4

        self.temp += self.temp_velocity

        temp_min, temp_max = self.scenario["temp_range"]
        self.temp = max(temp_min - 5, min(temp_max + 15, self.temp))

        if self.is_charging:
            self.soc = min(100, self.soc + random.uniform(0.3, 0.8))
            current = random.uniform(50, 150) if self.scenario_name == "fast_charge_abuse" else random.uniform(20, 80)
        else:
            self.soc = max(5, self.soc - random.uniform(0.1, 0.4))
            current = -random.uniform(30, 90)

        # Flip charge/drive state
        if self.soc >= 95 and self.is_charging:
            self.is_charging = False
        if self.soc <= 15 and not self.is_charging:
            self.is_charging = True

        voltage = 350 + (self.soc / 100) * 50 + random.gauss(0, 2)
        power_kw = abs(current) * voltage / 1000

        anomaly_score = (
            random.uniform(0.6, 0.95)
            if random.random() < self.scenario["anomaly_probability"]
            else random.uniform(0.0, 0.2)
        )

        thermal_risk = 0.0
        if self.temp > 50:
            thermal_risk = min(1.0, (self.temp - 50) / 40)

        return {
            "vehicle_id": self.vehicle_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "scenario": self.scenario_name,
            "scenario_label": self.scenario["label"],
            "state_of_charge": round(self.soc, 1),
            "state_of_health": round(self.soh, 2),
            "voltage": round(voltage, 2),
            "current": round(current, 2),
            "power_kw": round(power_kw, 2),
            "temperature_avg": round(self.temp, 1),
            "temperature_max": round(self.temp + random.uniform(2, 6), 1),
            "temperature_min": round(self.temp - random.uniform(1, 4), 1),
            "temperature_gradient": round(random.uniform(1, 8 if self.scenario_name != "healthy" else 3), 2),
            "cell_voltages": self._generate_cell_voltages(),
            "cell_temperatures": self._generate_cell_temperatures(),
            "is_charging": self.is_charging,
            "charging_rate_kw": round(power_kw if self.is_charging else 0, 2),
            "charger_type": "DC_FAST" if self.scenario_name == "fast_charge_abuse" else
                            "L2" if self.is_charging else None,
            "speed_kmh": 0 if self.is_charging else round(random.uniform(0, 130), 1),
            "elevation_m": round(random.uniform(-50, 500), 0),
            "ambient_temp": round(self.temp - random.uniform(5, 15), 1),
            "regenerative_braking_w": round(random.uniform(0, 30000) if not self.is_charging else 0, 0),
            "degradation_index": round(1 - self.soh / 100, 4),
            "thermal_risk_score": round(thermal_risk, 4),
            "anomaly_score": round(anomaly_score, 4),
            "cycle_count": self.cycle_count,
            "chemistry": self.chemistry,
            "capacity_kwh": self.capacity_kwh,
        }


def get_fleet_snapshot(num_vehicles: int = 10,
                       scenarios: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Generate a snapshot of fleet telemetry."""
    if scenarios is None:
        scenarios = ["healthy"] * 6 + ["degraded"] * 2 + ["aggressive"] * 1 + ["thermal_runaway"] * 1
    fleet = []
    for i in range(num_vehicles):
        scenario = scenarios[i % len(scenarios)]
        sim = TelemetrySimulator(
            vehicle_id=f"VH-{1000 + i:04d}",
            scenario=scenario,
            chemistry=random.choice(["NMC", "LFP", "NCA"]),
            capacity_kwh=random.choice([60, 75, 82, 100]),
        )
        fleet.append(sim.tick())
    return fleet
