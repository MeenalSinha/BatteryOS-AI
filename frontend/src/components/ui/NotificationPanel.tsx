"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, CheckCheck, AlertTriangle, Thermometer, Activity, Zap } from "lucide-react";
import { useBatteryStore } from "@/store/batteryStore";

const ICON_MAP: Record<string, any> = {
  THERMAL_RISK: Thermometer, TEMPERATURE: Thermometer,
  ANOMALY: Activity, DEGRADATION: Zap, CELL_IMBALANCE: AlertTriangle,
};
const COLOR_MAP: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", WARNING: "#f59e0b", INFO: "#22d3ee",
};

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const { alerts, unreadAlertCount, clearAlerts } = useBatteryStore();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)} className="side-btn relative">
        <Bell style={{ width: 17, height: 17 }} />
        {unreadAlertCount > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
            style={{ background: "#e040fb" }} />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 w-80 rounded-2xl overflow-hidden z-50"
            style={{ background: "#1a1635", border: "1px solid rgba(139,92,246,0.25)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-sm font-display font-semibold text-white">Alert Center</p>
              <div className="flex items-center gap-2">
                {alerts.length > 0 && (
                  <button onClick={clearAlerts} className="flex items-center gap-1 text-xs font-body"
                    style={{ color: "rgba(255,255,255,0.35)" }}>
                    <CheckCheck style={{ width: 12, height: 12 }} />Clear
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="side-btn w-6 h-6 rounded-lg">
                  <X style={{ width: 13, height: 13 }} />
                </button>
              </div>
            </div>
            <div className="max-h-72 overflow-auto">
              {alerts.length === 0 ? (
                <div className="py-10 text-center text-xs font-display"
                  style={{ color: "rgba(255,255,255,0.2)" }}>NO ACTIVE ALERTS</div>
              ) : alerts.slice(0, 25).map((alert, i) => {
                const color = COLOR_MAP[alert.severity] ?? "#f59e0b";
                const Icon = ICON_MAP[alert.type] ?? AlertTriangle;
                return (
                  <div key={alert.id ?? i} className="flex items-start gap-3 px-4 py-3"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", borderLeft: `2px solid ${color}` }}>
                    <Icon style={{ width: 13, height: 13, marginTop: 1, flexShrink: 0, color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-display" style={{ color }}>{alert.severity}</span>
                        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : ""}
                        </span>
                      </div>
                      <p className="text-xs font-body truncate" style={{ color: "rgba(255,255,255,0.65)" }}>{alert.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
