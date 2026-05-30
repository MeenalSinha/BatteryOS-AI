"""SQLAlchemy ORM models for battery entities."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean, JSON, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vin = Column(String(17), unique=True, nullable=False, index=True)
    make = Column(String(100))
    model = Column(String(100))
    year = Column(Integer)
    battery_capacity_kwh = Column(Float)
    chemistry = Column(String(50))  # NMC, LFP, NCA, LTO
    fleet_id = Column(String(100), index=True)
    owner_id = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    telemetry_records = relationship("TelemetryRecord", back_populates="vehicle")
    battery_passport = relationship("BatteryPassport", back_populates="vehicle", uselist=False)


class TelemetryRecord(Base):
    __tablename__ = "telemetry_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Battery state
    state_of_charge = Column(Float)       # 0-100 %
    state_of_health = Column(Float)       # 0-100 %
    voltage = Column(Float)               # V
    current = Column(Float)               # A (+ charge, - discharge)
    power_kw = Column(Float)
    temperature_avg = Column(Float)       # Celsius
    temperature_max = Column(Float)
    temperature_min = Column(Float)
    temperature_gradient = Column(Float)  # Max cell-to-cell delta

    # Cell-level data (JSON array of cell voltages)
    cell_voltages = Column(JSON)
    cell_temperatures = Column(JSON)

    # Drive data
    speed_kmh = Column(Float)
    elevation_m = Column(Float)
    ambient_temp = Column(Float)
    regenerative_braking_w = Column(Float)

    # Charging state
    is_charging = Column(Boolean, default=False)
    charging_rate_kw = Column(Float)
    charger_type = Column(String(20))     # L1, L2, DC_FAST, ULTRA_FAST

    # Computed metrics
    degradation_index = Column(Float)
    thermal_risk_score = Column(Float)    # 0-1
    anomaly_score = Column(Float)

    vehicle = relationship("Vehicle", back_populates="telemetry_records")


class BatteryPassport(Base):
    __tablename__ = "battery_passports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), unique=True)
    certificate_id = Column(String(64), unique=True)
    issued_at = Column(DateTime, default=datetime.utcnow)
    valid_until = Column(DateTime)

    # Health summary
    overall_health_score = Column(Float)
    capacity_retention_pct = Column(Float)
    total_cycles = Column(Integer)
    fast_charge_events = Column(Integer)
    thermal_events = Column(Integer)
    deep_discharge_events = Column(Integer)

    # AI predictions
    predicted_lifespan_months = Column(Float)
    resale_confidence_score = Column(Float)
    ai_risk_rating = Column(String(20))  # LOW, MEDIUM, HIGH, CRITICAL

    # Blockchain
    blockchain_hash = Column(String(128))
    ipfs_cid = Column(String(128))

    raw_data = Column(JSON)

    vehicle = relationship("Vehicle", back_populates="battery_passport")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    alert_type = Column(String(50))      # THERMAL_RISK, DEGRADATION, ANOMALY, CELL_IMBALANCE
    severity = Column(String(20))        # INFO, WARNING, CRITICAL
    title = Column(String(200))
    message = Column(Text)
    probability = Column(Float)
    acknowledged = Column(Boolean, default=False)
    resolved = Column(Boolean, default=False)
    metadata = Column(JSON)
