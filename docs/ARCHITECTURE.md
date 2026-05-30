# BatteryOS AI — System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      BatteryOS AI Platform                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    Frontend (Next.js 15)                  │   │
│   │  Dashboard │ BatteryDNA │ Thermal │ Charging │ Twin      │   │
│   │  Fleet     │ Passport   │ Failure │ Landing              │   │
│   └─────────────────────┬───────────────────────────────────┘   │
│                          │ REST + WebSocket                       │
│   ┌─────────────────────▼───────────────────────────────────┐   │
│   │                   Backend (FastAPI)                       │   │
│   │  /api/v1/battery  │ /api/v1/thermal  │ /api/v1/charging │   │
│   │  /api/v1/fleet    │ /api/v1/passport │ /api/v1/demo     │   │
│   │  /ws/telemetry    │ /ws/fleet                            │   │
│   └──┬──────────┬─────────────────┬────────────────────────-┘   │
│      │          │                 │                               │
│   ┌──▼──┐  ┌───▼────┐  ┌────────▼──────────────────────────┐   │
│   │Redis│  │InfluxDB│  │           AI/ML Services              │   │
│   │Cache│  │TimeSeries  │  DegradationPredictor               │   │
│   └─────┘  └────────┘  │  ThermalPredictor                  │   │
│                         │  AnomalyDetector                   │   │
│   ┌─────────────┐       │  ChargingOptimizer                 │   │
│   │ PostgreSQL  │       │  DigitalTwinEngine                 │   │
│   │+TimescaleDB │       └────────────────────────────────────┘   │
│   └─────────────┘                                                 │
│                                                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                   IoT Layer                               │   │
│   │  MQTT Broker  │  CAN Bus Simulator  │  Telemetry Gen    │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
Vehicle Sensors (CAN Bus)
        │
        ▼
IoT Telemetry Generator (MQTT publish)
        │
        ▼
MQTT Broker (Mosquitto)
        │
        ├──► Backend MQTT Subscriber
        │           │
        │           ├──► AI/ML Pipeline
        │           │    ├── Degradation Prediction
        │           │    ├── Thermal Risk Scoring
        │           │    └── Anomaly Detection
        │           │
        │           ├──► TimescaleDB (time-series storage)
        │           ├──► InfluxDB (metrics)
        │           └──► WebSocket broadcast to clients
        │
        └──► Direct REST API queries from Frontend
                    │
                    ▼
              Frontend Dashboard
              (Recharts, Three.js, Framer Motion)
```

## Module Details

### Backend Services

| Service | File | Description |
|---|---|---|
| DegradationPredictor | `services/ai/degradation_predictor.py` | Physics + ML SoH forecasting |
| ThermalPredictor | `services/ai/thermal_predictor.py` | Lumped thermal model + runaway risk |
| AnomalyDetector | `services/ai/anomaly_detector.py` | Isolation Forest + rule-based |
| ChargingOptimizer | `services/ai/charging_optimizer.py` | Adaptive CC-CV curve generation |
| TelemetrySimulator | `services/telemetry/simulator.py` | Synthetic telemetry for demo |
| DigitalTwinEngine | `services/digital_twin/battery_twin.py` | Physics-based pack simulation |
| FleetAnalyticsEngine | `services/fleet/fleet_analytics.py` | Fleet-wide intelligence |
| PassportGenerator | `services/fleet/passport_generator.py` | Blockchain-anchored certificates |

### Frontend Pages

| Route | Module | Key Features |
|---|---|---|
| `/landing` | Landing | Hero, stats, features, CTA |
| `/dashboard` | Command Center | Live telemetry, KPIs, heatmaps |
| `/battery-dna` | BatteryDNA | Fingerprint, certificates, trajectory |
| `/thermal` | VoltGuard | Thermal profile, runaway risk |
| `/charging` | Orchestrator | Adaptive curves, optimization |
| `/digital-twin` | Digital Twin | Scenario simulation, timeline |
| `/failure-intel` | Failure Intel | Anomaly scores, cell imbalance |
| `/fleet` | Fleet Intel | Risk distribution, leaderboard |
| `/passport` | Passport | Trust certificate, blockchain |

## Scalability

- **Horizontal scaling**: FastAPI behind Nginx, k8s HPA up to 20 replicas
- **Time-series performance**: TimescaleDB hypertables with 90-day retention
- **Caching**: Redis for hot telemetry and computed AI scores
- **Streaming**: WebSocket for real-time, MQTT for IoT ingestion
- **Edge AI**: Model inference runs inside FastAPI (no external ML server required)
