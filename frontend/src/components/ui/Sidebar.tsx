"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Dna, Thermometer, Zap,
  Box, AlertTriangle, Users, Shield, Rocket, Radio, GitCompare
} from "lucide-react";
import { useBatteryStore, type DemoScenario } from "@/store/batteryStore";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Command Center", icon: LayoutDashboard, color: "#00ff88" },
  { href: "/battery-dna", label: "BatteryDNA", icon: Dna, color: "#00e5ff" },
  { href: "/thermal", label: "VoltGuard Thermal", icon: Thermometer, color: "#ff4444" },
  { href: "/charging", label: "Charging Orchestrator", icon: Zap, color: "#ffaa00" },
  { href: "/digital-twin", label: "Digital Twin", icon: Box, color: "#9900ff" },
  { href: "/failure-intel", label: "Failure Intel", icon: AlertTriangle, color: "#ff6600" },
  { href: "/fleet", label: "Fleet Intelligence", icon: Users, color: "#00e5ff" },
  { href: "/fleet/compare", label: "Vehicle Compare", icon: GitCompare, color: "#00e5ff" },
  { href: "/passport", label: "Battery Passport", icon: Shield, color: "#00ff88" },
];

const SCENARIO_COLORS: Record<string, string> = {
  healthy: "#00ff88",
  degraded: "#ffaa00",
  thermal_runaway: "#ff2244",
  aggressive: "#ff6600",
  fast_charge_abuse: "#cc00ff",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { activeScenario, isDemoMode, toggleDemoMode, unreadAlertCount, setScenario } = useBatteryStore();
  const accentColor = SCENARIO_COLORS[activeScenario] ?? "#00ff88";

  return (
    <aside className="w-64 min-h-screen bg-surface-card border-r border-surface-border flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-surface-border">
        <Link href="/landing">
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="relative w-9 h-9">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-volt-green to-volt-cyan flex items-center justify-center glow-green">
                <Radio className="w-4 h-4 text-black" />
              </div>
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full status-blink"
                style={{ background: accentColor }} />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-white">BatteryOS</p>
              <p className="text-xs" style={{ color: accentColor }}>AI v1.0</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-3 mt-3 px-3 py-2 rounded-lg border text-xs font-display text-center"
          style={{ borderColor: accentColor, color: accentColor, background: `${accentColor}10` }}
        >
          DEMO MODE ACTIVE
        </motion.div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 mt-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href) && item.href !== "/fleet" );
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 3 }}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer",
                  active
                    ? "bg-surface-hover text-white"
                    : "text-gray-400 hover:text-white hover:bg-surface-hover/60"
                )}
                style={active ? { borderLeft: `2px solid ${item.color}`, paddingLeft: "10px" } : {}}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? item.color : undefined }} />
                <span className={clsx("font-body text-sm", active && "font-medium")}>{item.label}</span>
                {item.href === "/failure-intel" && unreadAlertCount > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-full text-xs bg-volt-red text-white font-display">
                    {Math.min(unreadAlertCount, 99)}
                  </span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Demo Scenario Selector (visible in demo mode) */}
      {isDemoMode && (
        <div className="px-3 pb-2">
          <p className="text-xs text-gray-600 font-display px-1 mb-1">SCENARIO</p>
          <div className="space-y-0.5">
            {(["healthy", "degraded", "thermal_runaway", "aggressive", "fast_charge_abuse"] as DemoScenario[]).map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={clsx(
                  "w-full text-left text-xs px-3 py-1.5 rounded-lg transition-all font-display",
                  activeScenario === s ? "text-black" : "text-gray-500 hover:text-white"
                )}
                style={activeScenario === s
                  ? { background: SCENARIO_COLORS[s] }
                  : { borderLeft: `2px solid ${SCENARIO_COLORS[s]}40` }
                }
              >
                {s.replace(/_/g, " ").toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Demo Toggle */}
      <div className="p-3 border-t border-surface-border">
        <button
          onClick={toggleDemoMode}
          className={clsx(
            "w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-display transition-all",
            isDemoMode
              ? "bg-volt-orange/20 text-volt-orange border border-volt-orange/30"
              : "bg-volt-green/10 text-volt-green border border-volt-green/20 hover:bg-volt-green/20"
          )}
        >
          <Rocket className="w-4 h-4" />
          {isDemoMode ? "EXIT DEMO MODE" : "HACKATHON DEMO MODE"}
        </button>
      </div>
    </aside>
  );
}
