"use client";
import { motion } from "framer-motion";
import { Activity, Wifi } from "lucide-react";
import { useBatteryStore } from "@/store/batteryStore";
import NotificationPanel from "./NotificationPanel";

const SCENARIO_LABELS: Record<string, string> = {
  healthy: "HEALTHY OPERATION",
  degraded: "DEGRADED BATTERY",
  thermal_runaway: "THERMAL RUNAWAY RISK",
  aggressive: "AGGRESSIVE DRIVING",
  fast_charge_abuse: "FAST CHARGE ABUSE",
};

const SCENARIO_COLORS: Record<string, string> = {
  healthy: "#00ff88",
  degraded: "#ffaa00",
  thermal_runaway: "#ff2244",
  aggressive: "#ff6600",
  fast_charge_abuse: "#cc00ff",
};

export default function TopBar({ title }: { title: string }) {
  const { activeScenario, activeVehicleId, latestTelemetry } = useBatteryStore();
  const color = SCENARIO_COLORS[activeScenario] ?? "#00ff88";
  const label = SCENARIO_LABELS[activeScenario] ?? "OPERATIONAL";

  return (
    <header className="h-16 border-b border-surface-border bg-surface-card/50 backdrop-blur flex items-center px-6 gap-4 sticky top-0 z-40">
      <div className="flex-1">
        <h1 className="font-display text-base font-semibold text-white">{title}</h1>
        <p className="text-xs text-gray-500 font-mono">{activeVehicleId}</p>
      </div>

      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs"
        style={{ borderColor: `${color}40`, background: `${color}10`, color }}
      >
        <span className="w-2 h-2 rounded-full status-blink" style={{ background: color }} />
        <span className="font-display hidden sm:block">{label}</span>
      </div>

      {latestTelemetry && (
        <div className="hidden md:flex items-center gap-4 text-xs font-mono text-gray-400">
          <span>SOC <span className="text-volt-cyan">{latestTelemetry.state_of_charge.toFixed(1)}%</span></span>
          <span>SOH <span className="text-volt-green">{latestTelemetry.state_of_health.toFixed(1)}%</span></span>
          <span>T <span className="text-volt-orange">{latestTelemetry.temperature_avg.toFixed(1)}°C</span></span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <NotificationPanel />
        <div className="p-2 rounded-lg">
          <Wifi className="w-4 h-4 text-volt-green" />
        </div>
      </div>
    </header>
  );
}
