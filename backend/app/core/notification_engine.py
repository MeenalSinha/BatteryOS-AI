"""
Real-Time Notification Engine
Generates, persists, and broadcasts alerts for battery anomalies.
Integrates with WebSocket manager for live push notifications.
"""
import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field, asdict

logger = logging.getLogger(__name__)


@dataclass
class Notification:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: str = ""
    alert_type: str = ""     # THERMAL_RISK | ANOMALY | DEGRADATION | CELL_IMBALANCE | MAINTENANCE
    severity: str = ""       # INFO | WARNING | HIGH | CRITICAL
    title: str = ""
    message: str = ""
    probability: float = 0.0
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    acknowledged: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class NotificationEngine:
    """
    Central notification manager.
    Evaluates telemetry frames → generates alerts → broadcasts via WebSocket.
    """

    # Thresholds for auto-alert generation
    THRESHOLDS = {
        "thermal_risk_critical": 0.85,
        "thermal_risk_high": 0.55,
        "anomaly_critical": 0.85,
        "anomaly_high": 0.60,
        "soh_critical": 70.0,
        "soh_warning": 78.0,
        "temperature_critical": 65.0,
        "temperature_warning": 50.0,
        "cell_delta_critical": 0.08,
        "cell_delta_warning": 0.05,
    }

    # Cooldown: don't re-alert the same vehicle+type within N seconds
    COOLDOWN_SECONDS = 120

    def __init__(self):
        self._recent_alerts: Dict[str, float] = {}   # key → timestamp
        self._notification_history: List[Notification] = []
        self._max_history = 500

    def _cooldown_key(self, vehicle_id: str, alert_type: str) -> str:
        return f"{vehicle_id}:{alert_type}"

    def _is_cooled_down(self, vehicle_id: str, alert_type: str) -> bool:
        import time
        key = self._cooldown_key(vehicle_id, alert_type)
        last = self._recent_alerts.get(key, 0)
        return (time.time() - last) > self.COOLDOWN_SECONDS

    def _mark_alerted(self, vehicle_id: str, alert_type: str):
        import time
        self._recent_alerts[self._cooldown_key(vehicle_id, alert_type)] = time.time()

    def evaluate_telemetry(self, telemetry: Dict[str, Any]) -> List[Notification]:
        """
        Evaluate a telemetry frame and return any triggered notifications.
        This is called on every incoming telemetry tick.
        """
        alerts = []
        vid = telemetry.get("vehicle_id", "unknown")
        thermal = telemetry.get("thermal_risk_score", 0)
        anomaly = telemetry.get("anomaly_score", 0)
        soh = telemetry.get("state_of_health", 100)
        temp = telemetry.get("temperature_avg", 25)
        cell_voltages = telemetry.get("cell_voltages", [])

        # Thermal runaway risk
        if thermal >= self.THRESHOLDS["thermal_risk_critical"]:
            if self._is_cooled_down(vid, "THERMAL_RISK_CRITICAL"):
                alerts.append(Notification(
                    vehicle_id=vid,
                    alert_type="THERMAL_RISK",
                    severity="CRITICAL",
                    title="Critical Thermal Runaway Risk",
                    message=f"Thermal risk score {thermal:.2f} — Initiate emergency cooling immediately.",
                    probability=thermal,
                    metadata={"temperature_avg": temp, "scenario": telemetry.get("scenario")},
                ))
                self._mark_alerted(vid, "THERMAL_RISK_CRITICAL")

        elif thermal >= self.THRESHOLDS["thermal_risk_high"]:
            if self._is_cooled_down(vid, "THERMAL_RISK_HIGH"):
                alerts.append(Notification(
                    vehicle_id=vid,
                    alert_type="THERMAL_RISK",
                    severity="HIGH",
                    title="Elevated Thermal Risk Detected",
                    message=f"Thermal risk {thermal:.2f} — Reduce charge rate and increase cooling.",
                    probability=thermal,
                    metadata={"temperature_avg": temp},
                ))
                self._mark_alerted(vid, "THERMAL_RISK_HIGH")

        # Temperature threshold
        if temp >= self.THRESHOLDS["temperature_critical"]:
            if self._is_cooled_down(vid, "TEMP_CRITICAL"):
                alerts.append(Notification(
                    vehicle_id=vid,
                    alert_type="TEMPERATURE",
                    severity="CRITICAL",
                    title="Critical Cell Temperature",
                    message=f"Cell temperature {temp:.1f}°C exceeds safe limit (65°C). Emergency stop advised.",
                    probability=min(1.0, (temp - 65) / 20 + 0.8),
                    metadata={"temperature_avg": temp, "temperature_max": telemetry.get("temperature_max")},
                ))
                self._mark_alerted(vid, "TEMP_CRITICAL")

        elif temp >= self.THRESHOLDS["temperature_warning"]:
            if self._is_cooled_down(vid, "TEMP_WARNING"):
                alerts.append(Notification(
                    vehicle_id=vid,
                    alert_type="TEMPERATURE",
                    severity="WARNING",
                    title="High Battery Temperature",
                    message=f"Cell temperature {temp:.1f}°C is above recommended 50°C threshold.",
                    probability=0.55,
                    metadata={"temperature_avg": temp},
                ))
                self._mark_alerted(vid, "TEMP_WARNING")

        # Anomaly detection
        if anomaly >= self.THRESHOLDS["anomaly_critical"]:
            if self._is_cooled_down(vid, "ANOMALY_CRITICAL"):
                alerts.append(Notification(
                    vehicle_id=vid,
                    alert_type="ANOMALY",
                    severity="CRITICAL",
                    title="Critical Anomaly Detected",
                    message=f"AI anomaly score {anomaly:.2f} — Immediate inspection required.",
                    probability=anomaly,
                    metadata={"anomaly_score": anomaly},
                ))
                self._mark_alerted(vid, "ANOMALY_CRITICAL")
        elif anomaly >= self.THRESHOLDS["anomaly_high"]:
            if self._is_cooled_down(vid, "ANOMALY_HIGH"):
                alerts.append(Notification(
                    vehicle_id=vid,
                    alert_type="ANOMALY",
                    severity="HIGH",
                    title="Anomaly Pattern Detected",
                    message=f"AI anomaly score {anomaly:.2f} — Schedule inspection within 7 days.",
                    probability=anomaly,
                    metadata={"anomaly_score": anomaly},
                ))
                self._mark_alerted(vid, "ANOMALY_HIGH")

        # SoH degradation
        if soh <= self.THRESHOLDS["soh_critical"]:
            if self._is_cooled_down(vid, "SOH_CRITICAL"):
                alerts.append(Notification(
                    vehicle_id=vid,
                    alert_type="DEGRADATION",
                    severity="CRITICAL",
                    title="Critical Battery Degradation",
                    message=f"State of Health {soh:.1f}% — Battery near end-of-life. Replace within 60 days.",
                    probability=0.90,
                    metadata={"soh": soh},
                ))
                self._mark_alerted(vid, "SOH_CRITICAL")
        elif soh <= self.THRESHOLDS["soh_warning"]:
            if self._is_cooled_down(vid, "SOH_WARNING"):
                alerts.append(Notification(
                    vehicle_id=vid,
                    alert_type="DEGRADATION",
                    severity="WARNING",
                    title="Battery Degradation Warning",
                    message=f"State of Health {soh:.1f}% — Plan battery reconditioning.",
                    probability=0.70,
                    metadata={"soh": soh},
                ))
                self._mark_alerted(vid, "SOH_WARNING")

        # Cell imbalance
        if len(cell_voltages) > 10:
            delta = max(cell_voltages) - min(cell_voltages)
            if delta >= self.THRESHOLDS["cell_delta_critical"]:
                if self._is_cooled_down(vid, "CELL_IMBALANCE_CRITICAL"):
                    alerts.append(Notification(
                        vehicle_id=vid,
                        alert_type="CELL_IMBALANCE",
                        severity="CRITICAL",
                        title="Critical Cell Voltage Imbalance",
                        message=f"Cell delta {delta*1000:.0f}mV exceeds 80mV — Risk of cell reversal.",
                        probability=0.88,
                        metadata={"delta_v": delta, "cell_count": len(cell_voltages)},
                    ))
                    self._mark_alerted(vid, "CELL_IMBALANCE_CRITICAL")
            elif delta >= self.THRESHOLDS["cell_delta_warning"]:
                if self._is_cooled_down(vid, "CELL_IMBALANCE_WARNING"):
                    alerts.append(Notification(
                        vehicle_id=vid,
                        alert_type="CELL_IMBALANCE",
                        severity="WARNING",
                        title="Cell Voltage Imbalance Detected",
                        message=f"Cell delta {delta*1000:.0f}mV — Run cell balancing cycle.",
                        probability=0.60,
                        metadata={"delta_v": delta},
                    ))
                    self._mark_alerted(vid, "CELL_IMBALANCE_WARNING")

        # Store alerts
        for alert in alerts:
            self._notification_history.insert(0, alert)
        if len(self._notification_history) > self._max_history:
            self._notification_history = self._notification_history[:self._max_history]

        return alerts

    async def broadcast_alerts(self, alerts: List[Notification], ws_manager=None):
        """Broadcast alerts via WebSocket to all connected clients."""
        if not alerts or not ws_manager:
            return
        for alert in alerts:
            await ws_manager.broadcast("alerts", {
                "type": "ALERT",
                "data": alert.to_dict(),
            })

    def get_recent_alerts(self, vehicle_id: Optional[str] = None,
                           limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve recent notifications, optionally filtered by vehicle."""
        alerts = self._notification_history
        if vehicle_id:
            alerts = [a for a in alerts if a.vehicle_id == vehicle_id]
        return [a.to_dict() for a in alerts[:limit]]

    def acknowledge_alert(self, alert_id: str) -> bool:
        for alert in self._notification_history:
            if alert.id == alert_id:
                alert.acknowledged = True
                return True
        return False

    def get_stats(self) -> Dict[str, Any]:
        total = len(self._notification_history)
        by_severity = {}
        for a in self._notification_history:
            by_severity[a.severity] = by_severity.get(a.severity, 0) + 1
        return {
            "total_alerts": total,
            "by_severity": by_severity,
            "active_vehicles": len(set(a.vehicle_id for a in self._notification_history)),
        }


# Global singleton
notification_engine = NotificationEngine()
