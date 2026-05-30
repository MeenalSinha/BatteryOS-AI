"""InfluxDB writer — persists telemetry time-series to InfluxDB bucket."""
import logging
from datetime import datetime, timezone
from typing import Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)
_influx_client = None
_write_api = None
_influx_unavailable = False


def get_influx_write_api():
    global _influx_client, _write_api, _influx_unavailable

    if _influx_unavailable:
        return None

    if _write_api is None:
        try:
            from influxdb_client import InfluxDBClient
            from influxdb_client.client.write_api import ASYNCHRONOUS
            _influx_client = InfluxDBClient(
                url=settings.INFLUX_URL,
                token=settings.INFLUX_TOKEN,
                org=settings.INFLUX_ORG,
                timeout=3000,
            )
            _write_api = _influx_client.write_api(write_options=ASYNCHRONOUS)
            logger.info("InfluxDB write API initialized")
        except Exception as e:
            logger.warning(f"InfluxDB unavailable: {e} — metrics disabled permanently for this session")
            _influx_unavailable = True
    return _write_api


def write_telemetry(telemetry: Dict[str, Any]) -> bool:
    """Write a single telemetry frame to InfluxDB."""
    try:
        api = get_influx_write_api()
        if not api:
            return False

        vehicle_id = telemetry.get("vehicle_id", "unknown")
        ts = datetime.now(timezone.utc)

        # Battery state measurement
        record = {
            "measurement": "battery_telemetry",
            "tags": {
                "vehicle_id": vehicle_id,
                "chemistry": telemetry.get("chemistry", "NMC"),
                "scenario": telemetry.get("scenario", "unknown"),
            },
            "fields": {
                "soc": float(telemetry.get("state_of_charge", 0)),
                "soh": float(telemetry.get("state_of_health", 0)),
                "voltage": float(telemetry.get("voltage", 0)),
                "current": float(telemetry.get("current", 0)),
                "power_kw": float(telemetry.get("power_kw", 0)),
                "temperature_avg": float(telemetry.get("temperature_avg", 0)),
                "temperature_max": float(telemetry.get("temperature_max", 0)),
                "thermal_risk": float(telemetry.get("thermal_risk_score", 0)),
                "anomaly_score": float(telemetry.get("anomaly_score", 0)),
                "degradation_index": float(telemetry.get("degradation_index", 0)),
                "is_charging": bool(telemetry.get("is_charging", False)),
            },
            "time": ts,
        }

        api.write(
            bucket=settings.INFLUX_BUCKET,
            org=settings.INFLUX_ORG,
            record=record,
        )
        return True
    except Exception as e:
        logger.debug(f"InfluxDB write error: {e}")
        return False


def write_fleet_metrics(fleet_summary: Dict[str, Any]) -> bool:
    """Write fleet-level aggregated metrics."""
    try:
        api = get_influx_write_api()
        if not api:
            return False
        record = {
            "measurement": "fleet_metrics",
            "tags": {"fleet_id": fleet_summary.get("fleet_id", "FLEET-001")},
            "fields": {
                "avg_soh": float(fleet_summary.get("summary", {}).get("avg_soh", 0)),
                "critical_count": int(fleet_summary.get("summary", {}).get("critical_count", 0)),
                "healthy_count": int(fleet_summary.get("summary", {}).get("healthy_count", 0)),
                "degraded_count": int(fleet_summary.get("summary", {}).get("degraded_count", 0)),
            },
            "time": datetime.now(timezone.utc),
        }
        api.write(bucket=settings.INFLUX_BUCKET, org=settings.INFLUX_ORG, record=record)
        return True
    except Exception as e:
        logger.debug(f"InfluxDB fleet write error: {e}")
        return False
