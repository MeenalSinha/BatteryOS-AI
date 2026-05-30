# BatteryOS AI — API Reference

Base URL: `http://localhost:8000/api/v1`
Interactive Docs: `http://localhost:8000/docs`

## Battery Endpoints

### GET /battery/health/{vehicle_id}
Returns current battery health with AI predictions.

**Query Parameters:**
- `scenario` (string): `healthy | degraded | thermal_runaway | aggressive | fast_charge_abuse`

**Response:**
```json
{
  "vehicle_id": "VH-0001",
  "telemetry": { ... },
  "soh_prediction": {
    "soh": 94.2,
    "calendar_loss_pct": 1.8,
    "cycle_loss_pct": 2.3,
    "method": "physics_model",
    "confidence": 0.85
  },
  "anomaly_detection": { "anomaly_score": 0.12, "severity": "NORMAL" },
  "end_of_life": { "months_to_eol": 58, "eol_threshold": 80 }
}
```

### GET /battery/degradation/{vehicle_id}/trajectory
Returns SoH prediction trajectory.

### GET /battery/cell-analysis/{vehicle_id}
Returns per-cell voltage analysis and imbalance detection.

## Thermal Endpoints

### GET /thermal/predict/{vehicle_id}
Returns 60-minute thermal forecast and runaway risk.

### GET /thermal/heatmap/{vehicle_id}
Returns per-cell temperature distribution.

## Charging Endpoints

### GET /charging/optimize/{vehicle_id}
Returns AI-optimized charging curve vs standard curve.

**Query Parameters:**
- `target_soc` (float, 50-100): Target state of charge
- `scenario` (string): Battery condition scenario

## Digital Twin Endpoints

### POST /digital-twin/create/{twin_id}
Create a new digital twin instance.

### GET /digital-twin/simulate/{twin_id}
Run physics simulation for a scenario.

**Query Parameters:**
- `scenario` (string): `normal | fast_charge | aggressive | cold_weather | thermal_stress | cell_failure`
- `steps` (int, 5-300): Number of simulation steps (1 min each)

### GET /digital-twin/scenarios
List all available simulation scenarios.

## Fleet Endpoints

### GET /fleet/dashboard
Returns fleet-wide analytics dashboard.

**Query Parameters:**
- `fleet_id` (string): Fleet identifier
- `num_vehicles` (int): Number of vehicles to include

## Passport Endpoints

### GET /passport/generate/{vehicle_id}
Generate a Battery Health Certificate.

### GET /passport/verify/{certificate_id}
Verify a certificate on the blockchain.

## Demo Endpoints

### GET /demo/scenarios
List all hackathon demo scenarios.

### GET /demo/run/{scenario}
Execute a complete demo with all AI modules active.

## WebSocket Endpoints

### WS /ws/telemetry/{vehicle_id}
Stream live telemetry at configurable interval.

**Query Parameters:**
- `scenario` (string): Battery scenario
- `interval_ms` (int): Streaming interval in milliseconds

### WS /ws/fleet
Stream fleet-wide telemetry every 2 seconds.
