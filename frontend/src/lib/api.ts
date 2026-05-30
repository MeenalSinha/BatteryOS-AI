/**
 * BatteryOS AI — API Client
 * Centralized Axios instance with typed request helpers.
 */
import axios from "axios";

let BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
let WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

if (typeof window !== "undefined") {
  const protocol = window.location.protocol;
  const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
  let host = window.location.hostname;
  if (host === "localhost") host = "127.0.0.1";
  
  BASE_URL = `${protocol}//${host}:8000`;
  WS_URL = `${wsProtocol}//${host}:8000`;
}

// ─── Security: Enterprise JWT Token ──────────────────────────────────────────
const MOCK_JWT = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vX3VzZXIiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MTY5ODAwMDB9.batteryos_demo_sig";

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 15000,
  headers: { 
    "Content-Type": "application/json",
    "Authorization": MOCK_JWT
  },
});

// Re-apply dynamic base URL before every request (handles SSR edge cases)
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    let host = window.location.hostname;
    if (host === "localhost") host = "127.0.0.1";
    config.baseURL = `${protocol}//${host}:8000/api/v1`;
  }
  config.headers["Authorization"] = MOCK_JWT; // Ensure token is always injected
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || 'unknown URL';
    const method = err.config?.method?.toUpperCase() || 'UNKNOWN';
    const errorData = err.response?.data;
    
    // Format a readable error message instead of an empty object
    let errorMessage = err.message;
    if (errorData && Object.keys(errorData).length > 0) {
      errorMessage = JSON.stringify(errorData);
    } else if (err.code === 'ERR_CANCELED') {
      errorMessage = 'Request canceled by frontend';
    }
    
    console.error(`[BatteryOS API Error] ${method} ${url} - ${errorMessage}`);
    return Promise.reject(err);
  }
);

// ─── Battery ────────────────────────────────────────────────────────────────
export const batteryApi = {
  getHealth: (vehicleId: string, scenario = "healthy") =>
    api.get(`/battery/health/${vehicleId}`, { params: { scenario } }),
  getDegradationTrajectory: (vehicleId: string, months = 36, scenario = "healthy") =>
    api.get(`/battery/degradation/${vehicleId}/trajectory`, { params: { months, scenario } }),
  getCellAnalysis: (vehicleId: string, scenario = "healthy") =>
    api.get(`/battery/cell-analysis/${vehicleId}`, { params: { scenario } }),
};

// ─── Telemetry ───────────────────────────────────────────────────────────────
export const telemetryApi = {
  getLive: (vehicleId: string, scenario = "healthy") =>
    api.get(`/telemetry/live/${vehicleId}`, { params: { scenario } }),
  getBatch: (vehicleId: string, count = 10, scenario = "healthy") =>
    api.get(`/telemetry/stream/${vehicleId}/batch`, { params: { count, scenario } }),
  getFleetSnapshot: (numVehicles = 10) =>
    api.get(`/telemetry/fleet/snapshot`, { params: { num_vehicles: numVehicles } }),
};

// ─── Thermal ─────────────────────────────────────────────────────────────────
export const thermalApi = {
  predict: (vehicleId: string, scenario = "healthy") =>
    api.get(`/thermal/predict/${vehicleId}`, { params: { scenario } }),
  getHeatmap: (vehicleId: string, scenario = "healthy") =>
    api.get(`/thermal/heatmap/${vehicleId}`, { params: { scenario } }),
};

// ─── Charging ────────────────────────────────────────────────────────────────
export const chargingApi = {
  optimize: (vehicleId: string, targetSoc = 80, scenario = "healthy") =>
    api.get(`/charging/optimize/${vehicleId}`, { params: { target_soc: targetSoc, scenario } }),
};

// ─── Digital Twin ────────────────────────────────────────────────────────────
export const digitalTwinApi = {
  create: (twinId: string, chemistry = "NMC", capacityKwh = 75) =>
    api.post(`/digital-twin/create/${twinId}`, null, { params: { chemistry, capacity_kwh: capacityKwh } }),
  simulate: (twinId: string, scenario = "normal", steps = 60) =>
    api.get(`/digital-twin/simulate/${twinId}`, { params: { scenario, steps } }),
  getScenarios: () => api.get("/digital-twin/scenarios"),
  getState: (twinId: string) => api.get(`/digital-twin/state/${twinId}`),
};

// ─── Fleet ───────────────────────────────────────────────────────────────────
export const fleetApi = {
  getDashboard: (fleetId = "FLEET-001", numVehicles = 10) =>
    api.get("/fleet/dashboard", { params: { fleet_id: fleetId, num_vehicles: numVehicles } }),
};

// ─── Passport ────────────────────────────────────────────────────────────────
export const passportApi = {
  generate: (vehicleId: string, scenario = "healthy") =>
    api.get(`/passport/generate/${vehicleId}`, { params: { scenario } }),
  verify: (certificateId: string) => api.get(`/passport/verify/${certificateId}`),
};

// ─── Demo ────────────────────────────────────────────────────────────────────
export const demoApi = {
  getScenarios: () => api.get("/demo/scenarios"),
  runScenario: (scenario: string) => api.get(`/demo/run/${scenario}`),
};

// ─── WebSocket ───────────────────────────────────────────────────────────────
export const createTelemetrySocket = (
  vehicleId: string,
  scenario = "healthy",
  onMessage: (data: unknown) => void
) => {
  const token = MOCK_JWT.split(" ")[1];
  const url = `${WS_URL}/ws/telemetry/${vehicleId}?scenario=${scenario}&interval_ms=1000&token=${token}`;
  const ws = new WebSocket(url);
  ws.onmessage = (evt) => {
    try {
      onMessage(JSON.parse(evt.data));
    } catch {}
  };
  ws.onerror = (e) => console.error("WS error:", e);
  return ws;
};

export const createFleetSocket = (
  numVehicles = 5,
  onMessage: (data: unknown) => void
) => {
  const token = MOCK_JWT.split(" ")[1];
  const url = `${WS_URL}/ws/fleet?num_vehicles=${numVehicles}&token=${token}`;
  const ws = new WebSocket(url);
  ws.onmessage = (evt) => {
    try {
      onMessage(JSON.parse(evt.data));
    } catch {}
  };
  return ws;
};
