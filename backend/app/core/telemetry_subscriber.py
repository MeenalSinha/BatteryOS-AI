"""MQTT subscriber that ingests IoT telemetry and pushes via WebSocket."""
import json
import logging
import asyncio
import threading
from app.core.config import settings

logger = logging.getLogger(__name__)


def start_mqtt_subscriber():
    """Start MQTT subscriber in a background thread."""
    try:
        import paho.mqtt.client as mqtt
        from app.core.websocket_manager import ws_manager

        def on_connect(client, userdata, flags, rc):
            logger.info(f"MQTT connected with result code {rc}")
            client.subscribe("batteryos/+/telemetry")
            client.subscribe("batteryos/+/alerts")

        def on_message(client, userdata, msg):
            try:
                data = json.loads(msg.payload.decode())
                asyncio.run(ws_manager.broadcast("telemetry", data))
            except Exception as e:
                logger.error(f"MQTT message error: {e}")

        client = mqtt.Client()
        client.on_connect = on_connect
        client.on_message = on_message
        client.connect(settings.MQTT_HOST, settings.MQTT_PORT, 60)

        t = threading.Thread(target=client.loop_forever, daemon=True)
        t.start()
        logger.info("MQTT subscriber started")
    except Exception as e:
        logger.warning(f"MQTT subscriber not started: {e}")
