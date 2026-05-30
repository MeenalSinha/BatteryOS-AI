"""
BatteryOS AI — IoT Telemetry Generator
Simulates CAN Bus / OBD-II telemetry streams for N vehicles.
Publishes to MQTT and backend REST API.
"""
import os
import sys
import time
import json
import random
import argparse
import logging
import threading
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SCENARIOS = ["healthy", "healthy", "healthy", "healthy",
             "degraded", "aggressive", "fast_charge_abuse", "thermal_runaway"]


def generate_telemetry(vehicle_id: str, scenario: str, state: dict) -> dict:
    """Generate one telemetry frame for a vehicle."""
    base = {
        "healthy": {"soh": 94, "temp": 27, "risk": 0.05, "anomaly": 0.08},
        "degraded": {"soh": 73, "temp": 42, "risk": 0.25, "anomaly": 0.45},
        "thermal_runaway": {"soh": 86, "temp": 72, "risk": 0.88, "anomaly": 0.82},
        "aggressive": {"soh": 84, "temp": 52, "risk": 0.45, "anomaly": 0.35},
        "fast_charge_abuse": {"soh": 78, "temp": 58, "risk": 0.55, "anomaly": 0.62},
    }.get(scenario, {"soh": 94, "temp": 27, "risk": 0.05, "anomaly": 0.08})

    state["soc"] = max(5, min(100, state.get("soc", 50) + random.uniform(-0.5, 0.5)))
    state["temp"] = max(base["temp"] - 10, min(base["temp"] + 20,
                        state.get("temp", base["temp"]) + random.gauss(0, 0.8)))

    return {
        "vehicle_id": vehicle_id,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "scenario": scenario,
        "state_of_charge": round(state["soc"], 1),
        "state_of_health": round(base["soh"] + random.gauss(0, 1), 2),
        "voltage": round(350 + state["soc"] * 0.5, 2),
        "current": round(random.uniform(-50, 150), 2),
        "temperature_avg": round(state["temp"], 1),
        "temperature_max": round(state["temp"] + random.uniform(2, 6), 1),
        "thermal_risk_score": round(base["risk"] + random.gauss(0, 0.05), 4),
        "anomaly_score": round(base["anomaly"] + random.gauss(0, 0.05), 4),
        "is_charging": random.random() < 0.3,
        "cycle_count": random.randint(100, 600),
        "chemistry": random.choice(["NMC", "LFP", "NCA"]),
        "capacity_kwh": 75.0,
    }


def publish_mqtt(client, vehicle_id: str, data: dict):
    try:
        topic = f"batteryos/{vehicle_id}/telemetry"
        client.publish(topic, json.dumps(data), qos=0)
    except Exception as e:
        logger.error(f"MQTT publish error: {e}")


def vehicle_thread(vehicle_id: str, scenario: str, mqtt_client, interval: float):
    state = {"soc": random.uniform(20, 90), "temp": 25.0}
    logger.info(f"[{vehicle_id}] Starting — scenario: {scenario}")
    while True:
        data = generate_telemetry(vehicle_id, scenario, state)
        publish_mqtt(mqtt_client, vehicle_id, data)
        time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="BatteryOS AI Telemetry Generator")
    parser.add_argument("--vehicles", type=int, default=10)
    parser.add_argument("--scenario", default="mixed")
    parser.add_argument("--interval", type=float, default=1.0)
    parser.add_argument("--mqtt-host", default=os.getenv("MQTT_HOST", "localhost"))
    parser.add_argument("--mqtt-port", type=int, default=int(os.getenv("MQTT_PORT", 1883)))
    args = parser.parse_args()

    try:
        import paho.mqtt.client as mqtt
        client = mqtt.Client(client_id="batteryos-generator")
        client.connect(args.mqtt_host, args.mqtt_port, 60)
        client.loop_start()
        logger.info(f"MQTT connected to {args.mqtt_host}:{args.mqtt_port}")
    except Exception as e:
        logger.warning(f"MQTT unavailable: {e} — logging only mode")
        client = None

    threads = []
    for i in range(args.vehicles):
        vid = f"VH-{1000 + i:04d}"
        sc = args.scenario if args.scenario != "mixed" else SCENARIOS[i % len(SCENARIOS)]
        t = threading.Thread(target=vehicle_thread, args=(vid, sc, client, args.interval), daemon=True)
        t.start()
        threads.append(t)

    logger.info(f"Generating telemetry for {args.vehicles} vehicles. Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(10)
    except KeyboardInterrupt:
        logger.info("Telemetry generator stopped.")


if __name__ == "__main__":
    main()
