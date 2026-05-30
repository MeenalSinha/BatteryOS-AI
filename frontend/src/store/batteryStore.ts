/**
 * Zustand global store for BatteryOS AI state management.
 */
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type DemoScenario =
  | "healthy"
  | "degraded"
  | "thermal_runaway"
  | "aggressive"
  | "fast_charge_abuse";

interface TelemetryFrame {
  vehicle_id: string;
  timestamp: string;
  state_of_charge: number;
  state_of_health: number;
  voltage: number;
  current: number;
  power_kw: number;
  temperature_avg: number;
  temperature_max: number;
  temperature_min: number;
  temperature_gradient: number;
  cell_voltages: number[];
  cell_temperatures: number[];
  is_charging: boolean;
  charging_rate_kw: number;
  charger_type: string | null;
  degradation_index: number;
  thermal_risk_score: number;
  anomaly_score: number;
  cycle_count: number;
  chemistry: string;
  capacity_kwh: number;
  scenario: string;
  scenario_label: string;
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  timestamp: string;
}

interface BatteryStore {
  // Active state
  activeVehicleId: string;
  activeScenario: DemoScenario;
  isDemoMode: boolean;

  // Live telemetry
  latestTelemetry: TelemetryFrame | null;
  telemetryHistory: TelemetryFrame[];

  // Fleet
  fleetVehicles: TelemetryFrame[];

  // Alerts
  alerts: Alert[];
  unreadAlertCount: number;

  // Loading
  isLoading: boolean;

  // Actions
  setActiveVehicle: (id: string) => void;
  setScenario: (scenario: DemoScenario) => void;
  toggleDemoMode: () => void;
  updateTelemetry: (frame: TelemetryFrame) => void;
  updateFleet: (vehicles: TelemetryFrame[]) => void;
  addAlert: (alert: Omit<Alert, "id" | "timestamp">) => void;
  clearAlerts: () => void;
  setLoading: (loading: boolean) => void;
}

export const useBatteryStore = create<BatteryStore>()(
  subscribeWithSelector((set, get) => ({
    activeVehicleId: "VH-0001",
    activeScenario: "healthy",
    isDemoMode: false,
    latestTelemetry: null,
    telemetryHistory: [],
    fleetVehicles: [],
    alerts: [],
    unreadAlertCount: 0,
    isLoading: false,

    setActiveVehicle: (id) => set({ activeVehicleId: id }),

    setScenario: (scenario) => set({ activeScenario: scenario }),

    toggleDemoMode: () => set((s) => ({ isDemoMode: !s.isDemoMode })),

    updateTelemetry: (frame) =>
      set((s) => ({
        latestTelemetry: frame,
        telemetryHistory: [...s.telemetryHistory.slice(-99), frame],
      })),

    updateFleet: (vehicles) => set({ fleetVehicles: vehicles }),

    addAlert: (alert) =>
      set((s) => ({
        alerts: [
          {
            ...alert,
            id: `alert_${Date.now()}`,
            timestamp: new Date().toISOString(),
          },
          ...s.alerts.slice(0, 49),
        ],
        unreadAlertCount: s.unreadAlertCount + 1,
      })),

    clearAlerts: () => set({ alerts: [], unreadAlertCount: 0 }),

    setLoading: (loading) => set({ isLoading: loading }),
  }))
);
