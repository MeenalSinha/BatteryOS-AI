"""Pydantic request/response schemas — full validation layer."""
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ChemistryEnum(str, Enum):
    NMC = "NMC"
    LFP = "LFP"
    NCA = "NCA"
    LTO = "LTO"


class ScenarioEnum(str, Enum):
    healthy = "healthy"
    degraded = "degraded"
    thermal_runaway = "thermal_runaway"
    aggressive = "aggressive"
    fast_charge_abuse = "fast_charge_abuse"


# ─── Request schemas ─────────────────────────────────────────────────────────

class VehicleCreateRequest(BaseModel):
    vin: str = Field(..., min_length=17, max_length=17, description="Vehicle Identification Number")
    make: str = Field(..., max_length=100)
    model: str = Field(..., max_length=100)
    year: int = Field(..., ge=2010, le=2035)
    battery_capacity_kwh: float = Field(..., gt=0, le=300)
    chemistry: ChemistryEnum
    fleet_id: Optional[str] = None
    owner_id: Optional[str] = None


class DegradationFeaturesRequest(BaseModel):
    chemistry: ChemistryEnum = ChemistryEnum.NMC
    total_cycles: int = Field(..., ge=0, le=10000)
    avg_dod_pct: float = Field(..., ge=0, le=100)
    avg_c_rate: float = Field(..., ge=0, le=10)
    avg_temperature_c: float = Field(..., ge=-40, le=80)
    avg_soc_pct: float = Field(..., ge=0, le=100)
    age_days: int = Field(..., ge=0)
    fast_charge_frequency_pct: float = Field(default=0, ge=0, le=100)


class ThermalPredictionRequest(BaseModel):
    chemistry: ChemistryEnum = ChemistryEnum.NMC
    current_temp_c: float = Field(..., ge=-40, le=120)
    ambient_temp_c: float = Field(..., ge=-40, le=60)
    current_a: float = Field(..., ge=0, le=1000)
    voltage_v: float = Field(..., ge=100, le=1000)
    soc: float = Field(..., ge=0, le=100)
    internal_resistance_mohm: float = Field(default=10, ge=0.1, le=500)
    cooling_power_w: float = Field(default=800, ge=0, le=10000)


class ChargingOptimizeRequest(BaseModel):
    chemistry: ChemistryEnum = ChemistryEnum.NMC
    soh_pct: float = Field(..., ge=50, le=100)
    soc_start_pct: float = Field(..., ge=0, le=100)
    temperature_c: float = Field(..., ge=-40, le=60)
    capacity_kwh: float = Field(..., gt=0, le=300)
    target_soc_pct: float = Field(default=80, ge=50, le=100)


class TwinCreateRequest(BaseModel):
    chemistry: ChemistryEnum = ChemistryEnum.NMC
    capacity_kwh: float = Field(default=75.0, gt=0, le=300)
    num_cells: int = Field(default=96, ge=4, le=1000)


class TwinSimulateRequest(BaseModel):
    scenario: str = Field(default="normal")
    steps: int = Field(default=60, ge=5, le=300)
    dt_seconds: float = Field(default=60, ge=1, le=3600)


# ─── Response schemas ─────────────────────────────────────────────────────────

class SoHPredictionResponse(BaseModel):
    soh: float
    calendar_loss_pct: Optional[float] = None
    cycle_loss_pct: Optional[float] = None
    fast_charge_penalty_pct: Optional[float] = None
    method: str
    confidence: float


class TrajectoryPoint(BaseModel):
    month: int
    soh: float
    label: str


class EoLEstimate(BaseModel):
    months_to_eol: Any  # int or ">120"
    eol_soh: float
    eol_threshold: float


class CellImbalanceResult(BaseModel):
    imbalance_detected: bool
    delta_v: float
    threshold_v: float
    mean_voltage: float
    min_voltage: float
    max_voltage: float
    weak_cells: List[Dict[str, Any]]
    severity: str


class AnomalyResult(BaseModel):
    anomaly_score: float
    is_anomaly: bool
    severity: str
    rules_triggered: List[str]
    confidence: float


class ThermalRiskPoint(BaseModel):
    minute: int
    temperature_c: float
    risk_score: float
    risk_level: str
    heat_gen_w: float


class ThermalRiskResponse(BaseModel):
    runaway_probability: float
    risk_level: str
    minutes_to_onset: Optional[int]
    peak_temperature_c: float
    recommended_action: str
    temperature_profile: List[ThermalRiskPoint]


class ChargingPoint(BaseModel):
    time_min: int
    soc_pct: float
    current_a: float
    power_kw: float


class ChargingCurve(BaseModel):
    points: List[ChargingPoint]
    total_time_min: int
    stress_index: float
    efficiency: float


class ChargingOptimizationSummary(BaseModel):
    time_savings_min: int
    degradation_reduction_pct: float
    energy_efficiency_gain_pct: float


class ChargingPlanResponse(BaseModel):
    chemistry: str
    temperature_zone: str
    max_c_rate: float
    max_current_a: float
    soh_derating_factor: float
    standard_curve: ChargingCurve
    optimized_curve: ChargingCurve
    optimization_summary: ChargingOptimizationSummary


class FleetSummary(BaseModel):
    avg_soh: float
    min_soh: float
    max_soh: float
    avg_temperature: float
    critical_count: int
    healthy_count: int
    degraded_count: int


class RiskDistribution(BaseModel):
    low: int
    medium: int
    high: int


class PassportResponse(BaseModel):
    certificate_id: str
    vehicle_id: str
    issued_at: str
    valid_until: str
    chemistry: str
    overall_health_score: float
    capacity_retention_pct: float
    total_cycles: int
    fast_charge_events: int
    thermal_events: int
    deep_discharge_events: int
    predicted_lifespan_months: float
    resale_confidence_score: float
    ai_risk_rating: str
    blockchain_hash: str
    ipfs_cid: str
    dna_fingerprint: Dict[str, Any]
    verification_url: str
    qr_data: str


class ExplainabilityFeature(BaseModel):
    feature: str
    importance: float
    direction: str  # "increasing" | "decreasing"
    description: str


class ExplainabilityResponse(BaseModel):
    model: str
    prediction: float
    features: List[ExplainabilityFeature]
    confidence: float
    interpretation: str


class AlertResponse(BaseModel):
    id: str
    vehicle_id: str
    alert_type: str
    severity: str
    title: str
    message: str
    probability: float
    created_at: str


class HealthCheckResponse(BaseModel):
    status: str
    service: str
    version: str
    uptime_seconds: float
    models_loaded: Dict[str, bool]
    database_connected: bool
    redis_connected: bool
