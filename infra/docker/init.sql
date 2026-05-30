-- BatteryOS AI — TimescaleDB Initialization
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Convert telemetry_records to hypertable for time-series performance
SELECT create_hypertable('telemetry_records', 'timestamp', if_not_exists => TRUE);

-- Continuous aggregate: hourly battery health stats
CREATE MATERIALIZED VIEW IF NOT EXISTS battery_health_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
    vehicle_id,
    AVG(state_of_charge) AS avg_soc,
    AVG(state_of_health) AS avg_soh,
    MAX(temperature_max) AS peak_temp,
    MAX(thermal_risk_score) AS max_thermal_risk,
    AVG(anomaly_score) AS avg_anomaly_score,
    COUNT(*) AS sample_count
FROM telemetry_records
GROUP BY bucket, vehicle_id
WITH NO DATA;

-- Index for fast vehicle + time queries
CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_time
    ON telemetry_records (vehicle_id, timestamp DESC);

-- Retention policy: keep raw data 90 days
SELECT add_retention_policy('telemetry_records', INTERVAL '90 days', if_not_exists => TRUE);
