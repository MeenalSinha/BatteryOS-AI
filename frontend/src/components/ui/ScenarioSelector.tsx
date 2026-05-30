"use client";
import { motion } from "framer-motion";
import { useBatteryStore, type DemoScenario } from "@/store/batteryStore";

const SCENARIOS: { id: DemoScenario; label: string; color: string }[] = [
  { id: "healthy",           label: "Healthy",        color: "#a855f7" },
  { id: "degraded",          label: "Degraded",       color: "#f59e0b" },
  { id: "thermal_runaway",   label: "Thermal Risk",   color: "#ef4444" },
  { id: "aggressive",        label: "Aggressive",     color: "#f97316" },
  { id: "fast_charge_abuse", label: "Charge Abuse",   color: "#ec4899" },
];

export default function ScenarioSelector() {
  const { activeScenario, setScenario, isDemoMode } = useBatteryStore();
  if (!isDemoMode) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 mb-5 flex-wrap"
    >
      <span className="text-xs font-mono uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.35)" }}>
        Scenario:
      </span>
      {SCENARIOS.map(s => (
        <button
          key={s.id}
          onClick={() => setScenario(s.id)}
          className="pill transition-all text-xs"
          style={activeScenario === s.id
            ? { background: `${s.color}25`, color: s.color, borderColor: `${s.color}55` }
            : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }
          }
        >
          {activeScenario === s.id && (
            <span className="w-1.5 h-1.5 rounded-full status-blink" style={{ background: s.color }} />
          )}
          {s.label}
        </button>
      ))}
    </motion.div>
  );
}
