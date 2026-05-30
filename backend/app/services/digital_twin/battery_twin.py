"""
Digital Twin Battery Simulator — Physically accurate, numerically stable.
Uses exact analytical solution for thermal model (avoids Forward Euler instability).
Cell model: single-cell lumped thermal with liquid-cooling R_th = 0.5 K/W, C_th = 45 J/K.
At typical pack currents (50-200A), steady-state temps are physically realistic (25-70°C).
"""
import math
import random
import logging
from typing import Dict, Any, List
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class BatteryCell:
    """
    Single NMC cell (5Ah, 18650-class) with liquid-cooled thermal model.
    Thermal: exact exponential solution — numerically stable at any dt.
    Electrical: simplified OCV with resistive IR drop.
    """
    cell_id: int
    voltage: float = 3.65        # V
    temperature: float = 25.0    # °C
    internal_resistance: float = 0.002   # Ω (2 mΩ)
    capacity_ah: float = 5.0
    soh: float = 1.0
    # Thermal parameters (NMC 18650, liquid cooled)
    R_th: float = 0.5            # K/W — thermal resistance cell to coolant
    C_th: float = 45.0           # J/K  — thermal capacitance

    def update(self, current_a: float, dt_s: float, ambient_temp: float):
        """
        Exact analytical thermal update:
          T(t+dt) = T_ss + (T(t) - T_ss) * exp(-dt/tau)
        where T_ss = T_amb + Q_joule * R_th,  tau = R_th * C_th
        """
        Q_joule = (current_a ** 2) * self.internal_resistance   # W
        T_ss = ambient_temp + Q_joule * self.R_th             # steady-state
        tau = self.R_th * self.C_th                          # 22.5s
        alpha = math.exp(-dt_s / tau)
        self.temperature = T_ss + (self.temperature - T_ss) * alpha
        self.temperature = max(-20.0, min(200.0, self.temperature))

        # Voltage: simplified OCV drift + IR drop
        dv = (current_a / self.capacity_ah) * (dt_s / 3600) * 0.02
        self.voltage = max(2.5, min(4.25, self.voltage - dv))

        # SEI degradation (Arrhenius-scaled, per Ah throughput)
        T_k = self.temperature + 273.15
        Ea = 0.60   # eV
        R_gas = 8.314
        Tr = 298.15
        arr = math.exp(Ea * (1 / Tr - 1 / T_k) * 1000 / R_gas)
        deg = 1e-5 * abs(current_a) * (dt_s / 3600) * arr
        self.soh = max(0.5, self.soh - deg)


@dataclass
class BatteryPack:
    num_cells: int = 96
    chemistry: str = "NMC"
    nominal_capacity_kwh: float = 75.0
    ambient_temp: float = 25.0
    cells: List[BatteryCell] = field(default_factory=list)

    def __post_init__(self):
        if not self.cells:
            rng = random.Random(42)
            # Cell-to-cell variation: ±3% R_int, ±1% capacity
            self.cells = [
                BatteryCell(
                    cell_id=i,
                    temperature=self.ambient_temp + rng.uniform(-0.5, 0.5),
                    internal_resistance=0.002 * (1 + rng.uniform(-0.03, 0.12)),
                    capacity_ah=5.0 * (1 + rng.uniform(-0.01, 0.01)),
                )
                for i in range(self.num_cells)
            ]

    def apply_current(self, pack_current_a: float, dt_s: float):
        rng = random.Random()
        for cell in self.cells:
            cell_current = pack_current_a * (1 + rng.uniform(-0.02, 0.02))
            cell.update(cell_current, dt_s, self.ambient_temp)

    def get_state(self) -> Dict[str, Any]:
        voltages = [c.voltage for c in self.cells]
        temps = [c.temperature for c in self.cells]
        sohs = [c.soh for c in self.cells]
        n = len(self.cells)
        avg_v = sum(voltages) / n

        return {
            "pack_voltage": round(avg_v * self.num_cells / 10, 2),
            "avg_cell_voltage": round(avg_v, 4),
            "max_cell_voltage": round(max(voltages), 4),
            "min_cell_voltage": round(min(voltages), 4),
            "cell_voltage_delta": round(max(voltages) - min(voltages), 4),
            "avg_temperature": round(sum(temps) / n, 2),
            "max_temperature": round(max(temps), 2),
            "min_temperature": round(min(temps), 2),
            "avg_soh": round(sum(sohs) / n * 100, 2),
            "min_soh": round(min(sohs) * 100, 2),
            "cell_voltages": [round(v, 4) for v in voltages],
            "cell_temperatures": [round(t, 2) for t in temps],
        }


class DigitalTwinEngine:
    """Physics-accurate digital twin with analytical thermal stability."""

    SCENARIOS = {
        "normal": {"current_a": 50, "ambient_temp": 25, "description": "Normal highway driving at 50A discharge"},
        "fast_charge": {"current_a": -180, "ambient_temp": 30, "description": "DC fast charging at 180A"},
        "aggressive": {"current_a": 150, "ambient_temp": 35, "description": "Aggressive acceleration at 150A"},
        "cold_weather": {"current_a": 40, "ambient_temp": -10, "description": "Cold weather operation at −10°C"},
        "thermal_stress": {"current_a": 180, "ambient_temp": 50, "description": "Thermal stress: 180A at 50°C ambient"},
        "cell_failure": {"current_a": 80, "ambient_temp": 30, "description": "Single cell failure (R×5) injection"},
    }

    def __init__(self):
        self.packs: Dict[str, BatteryPack] = {}

    def create_twin(self, twin_id: str, chemistry: str = "NMC",
                    capacity_kwh: float = 75.0, num_cells: int = 96) -> str:
        self.packs[twin_id] = BatteryPack(
            num_cells=num_cells,
            chemistry=chemistry,
            nominal_capacity_kwh=capacity_kwh,
        )
        return twin_id

    def simulate_scenario(self, twin_id: str, scenario_name: str,
                          steps: int = 60, dt_s: float = 60) -> Dict[str, Any]:
        if twin_id not in self.packs:
            self.create_twin(twin_id)

        pack = self.packs[twin_id]
        scen = self.SCENARIOS.get(scenario_name, self.SCENARIOS["normal"])
        pack.ambient_temp = scen["ambient_temp"]

        if scenario_name == "cell_failure":
            fail_idx = random.randint(0, pack.num_cells - 1)
            pack.cells[fail_idx].internal_resistance *= 5.0
            pack.cells[fail_idx].soh = 0.45

        timeline = []
        for step in range(steps):
            current = scen["current_a"] * (1 + random.uniform(-0.03, 0.03))
            pack.apply_current(current, dt_s)
            state = pack.get_state()
            state.update({
                "step": step,
                "time_min": round(step * dt_s / 60, 1),
                "scenario": scenario_name,
                "current_a": round(current, 1),
            })
            timeline.append(state)

        t_start = timeline[0]["avg_temperature"] if timeline else 0
        t_end = timeline[-1]["avg_temperature"] if timeline else 0

        return {
            "twin_id": twin_id,
            "scenario": scenario_name,
            "description": scen["description"],
            "steps": steps,
            "dt_seconds": dt_s,
            "total_duration_min": round(steps * dt_s / 60, 1),
            "timeline": timeline,
            "final_state": timeline[-1] if timeline else {},
            "summary": {
                "max_temperature": max(s["max_temperature"] for s in timeline),
                "min_soh_reached": min(s["min_soh"] for s in timeline),
                "max_cell_delta": max(s["cell_voltage_delta"] for s in timeline),
                "thermal_events": sum(1 for s in timeline if s["max_temperature"] > 45),
                "start_temp": round(t_start, 2),
                "end_temp": round(t_end, 2),
                "temp_delta": round(t_end - t_start, 2),
            },
        }

    def get_twin_state(self, twin_id: str) -> Dict[str, Any]:
        if twin_id not in self.packs:
            return {"error": "Twin not found", "twin_id": twin_id}
        return self.packs[twin_id].get_state()


digital_twin_engine = DigitalTwinEngine()
