"""WebSocket endpoint — live telemetry with real notification engine + InfluxDB writes."""
import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.websocket_manager import ws_manager
from app.core.notification_engine import notification_engine
from app.core.influx_writer import write_telemetry
from app.core.cache import cache_set
from app.services.telemetry.simulator import TelemetrySimulator
from app.services.ai.anomaly_detector import anomaly_detector

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/telemetry/{vehicle_id}")
async def telemetry_stream(
    websocket: WebSocket,
    vehicle_id: str,
    scenario: str = Query("healthy"),
    interval_ms: int = Query(1000, ge=200, le=10000),
):
    """
    Stream live telemetry for a vehicle.
    Each frame: runs anomaly detection, generates alerts, writes to InfluxDB, caches latest.
    """
    await ws_manager.connect(websocket, f"vehicle_{vehicle_id}")
    sim = TelemetrySimulator(vehicle_id=vehicle_id, scenario=scenario)

    try:
        while True:
            # Generate telemetry
            data = sim.tick()

            # Run real-time anomaly scoring
            anomaly_result = anomaly_detector.score_telemetry(data)
            data["anomaly_score"] = anomaly_result["anomaly_score"]
            data["anomaly_severity"] = anomaly_result["severity"]
            data["rules_triggered"] = anomaly_result["rules_triggered"]

            # Evaluate for notifications
            alerts = notification_engine.evaluate_telemetry(data)

            # Write to InfluxDB (non-blocking best-effort)
            try:
                write_telemetry(data)
            except Exception:
                pass

            # Cache latest frame (TTL = 10s)
            await cache_set(
                f"batteryos:latest:{vehicle_id}:telemetry",
                data,
                ttl_seconds=10,
            )

            # Broadcast telemetry frame
            await websocket.send_text(json.dumps({
                "type": "TELEMETRY",
                "data": data,
                "alerts": [a.to_dict() for a in alerts],
            }))

            # Broadcast alerts to all alert subscribers
            if alerts:
                await ws_manager.broadcast("alerts", {
                    "type": "ALERTS",
                    "data": [a.to_dict() for a in alerts],
                })

            await asyncio.sleep(interval_ms / 1000)

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, f"vehicle_{vehicle_id}")
    except Exception as e:
        logger.error(f"WebSocket telemetry error [{vehicle_id}]: {e}")
        ws_manager.disconnect(websocket, f"vehicle_{vehicle_id}")


@router.websocket("/ws/fleet")
async def fleet_stream(
    websocket: WebSocket,
    num_vehicles: int = Query(5, ge=1, le=30),
):
    """Stream fleet-wide telemetry with aggregated health scores."""
    await ws_manager.connect(websocket, "fleet")
    from app.services.telemetry.simulator import get_fleet_snapshot
    from app.core.influx_writer import write_fleet_metrics

    try:
        tick = 0
        while True:
            vehicles = get_fleet_snapshot(num_vehicles)

            # Score each vehicle
            for v in vehicles:
                score = anomaly_detector.score_telemetry(v)
                v["anomaly_score"] = score["anomaly_score"]
                v["anomaly_severity"] = score["severity"]

            # Fleet summary
            sohs = [v["state_of_health"] for v in vehicles]
            fleet_data = {
                "type": "FLEET_TELEMETRY",
                "tick": tick,
                "vehicles": vehicles,
                "summary": {
                    "avg_soh": round(sum(sohs) / len(sohs), 2),
                    "critical_count": sum(1 for v in vehicles if v["anomaly_score"] > 0.7),
                    "vehicle_count": len(vehicles),
                },
            }

            # Write fleet metrics to InfluxDB every 5 ticks
            if tick % 5 == 0:
                try:
                    write_fleet_metrics({"fleet_id": "FLEET-001", "summary": fleet_data["summary"]})
                except Exception:
                    pass

            await websocket.send_text(json.dumps(fleet_data, default=str))
            tick += 1
            await asyncio.sleep(2.0)

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, "fleet")
    except Exception as e:
        logger.error(f"Fleet WebSocket error: {e}")
        ws_manager.disconnect(websocket, "fleet")


@router.websocket("/ws/alerts")
async def alerts_stream(websocket: WebSocket):
    """Subscribe to real-time alert notifications across all vehicles."""
    await ws_manager.connect(websocket, "alerts")
    try:
        # Send recent alert history on connect
        recent = notification_engine.get_recent_alerts(limit=20)
        await websocket.send_text(json.dumps({
            "type": "ALERT_HISTORY",
            "data": recent,
        }))
        # Keep alive — alerts are pushed via broadcast
        while True:
            await asyncio.sleep(30)
            await websocket.send_text(json.dumps({"type": "PING"}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, "alerts")
