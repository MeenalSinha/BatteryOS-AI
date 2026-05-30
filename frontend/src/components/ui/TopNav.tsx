"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Radio, Thermometer, Dna,
  Box, AlertTriangle, Users, Shield, Rocket,
  Bell, Search, Settings, ChevronDown, Zap
} from "lucide-react";
import { useBatteryStore, type DemoScenario } from "@/store/batteryStore";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard",  icon: LayoutDashboard },
  { href: "/fleet",        label: "Fleet Intel", icon: Users },
  { href: "/battery-dna",  label: "BatteryDNA",  icon: Dna },
  { href: "/thermal",      label: "Thermal",     icon: Thermometer },
];

const MORE_ITEMS = [
  { href: "/charging",      label: "Charging",       icon: Zap },
  { href: "/digital-twin",  label: "Digital Twin",   icon: Box },
  { href: "/failure-intel", label: "Failure Intel",  icon: AlertTriangle },
  { href: "/passport",      label: "Passport",       icon: Shield },
];

const SCENARIO_CONFIG: Record<string, { label: string; color: string }> = {
  healthy:           { label: "Healthy",       color: "#a855f7" },
  degraded:          { label: "Degraded",      color: "#f59e0b" },
  thermal_runaway:   { label: "Thermal Risk",  color: "#ef4444" },
  aggressive:        { label: "Aggressive",    color: "#f97316" },
  fast_charge_abuse: { label: "Fast Charge",   color: "#ec4899" },
};

export default function TopNav() {
  const pathname = usePathname();
  const { activeScenario, setScenario, isDemoMode, toggleDemoMode, unreadAlertCount } = useBatteryStore();
  const [showMore, setShowMore] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const scenarioCfg = SCENARIO_CONFIG[activeScenario] ?? SCENARIO_CONFIG["healthy"];

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3"
      style={{
        background: "rgba(10,8,24,0.88)",
        backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(139,92,246,0.12)",
      }}>

      {/* Logo */}
      <Link href="/landing">
        <div className="flex items-center gap-2.5 cursor-pointer">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
            <Radio className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-sm text-white tracking-wide">BatteryOS</span>
        </div>
      </Link>

      {/* Center pill nav */}
      <nav className="flex items-center gap-0.5 rounded-full px-2 py-1.5"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div className={`nav-pill ${active ? "active" : ""}`}>
                <Icon style={{ width: 14, height: 14 }} />
                {item.label}
              </div>
            </Link>
          );
        })}
        {/* More dropdown */}
        <div className="relative">
          <button className={`nav-pill ${MORE_ITEMS.some(i => isActive(i.href)) ? "active" : ""}`}
            onClick={() => setShowMore(v => !v)}>
            More <ChevronDown style={{ width: 12, height: 12 }} />
          </button>
          <AnimatePresence>
            {showMore && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-10 w-44 rounded-2xl overflow-hidden z-50"
                style={{
                  background: "#1a1635",
                  border: "1px solid rgba(139,92,246,0.28)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                }}>
                {MORE_ITEMS.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-body transition-colors hover:bg-white/5 cursor-pointer"
                        style={{ color: active ? "#c084fc" : "rgba(255,255,255,0.55)" }}
                        onClick={() => setShowMore(false)}>
                        <Icon style={{ width: 14, height: 14 }} />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-1.5">
        {/* Scenario selector in demo mode */}
        {isDemoMode && (
          <div className="relative">
            <button
              onClick={() => setShowScenarios(v => !v)}
              className="pill flex items-center gap-1.5"
              style={{
                background: `${scenarioCfg.color}18`,
                color: scenarioCfg.color,
                borderColor: `${scenarioCfg.color}45`,
              }}>
              <span className="w-1.5 h-1.5 rounded-full status-blink" style={{ background: scenarioCfg.color }} />
              <span className="text-xs">{scenarioCfg.label}</span>
              <ChevronDown style={{ width: 11, height: 11 }} />
            </button>
            <AnimatePresence>
              {showScenarios && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  className="absolute right-0 top-9 w-44 rounded-2xl overflow-hidden z-50"
                  style={{
                    background: "#1a1635",
                    border: "1px solid rgba(139,92,246,0.28)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                  }}>
                  {Object.entries(SCENARIO_CONFIG).map(([id, cfg]) => (
                    <button key={id}
                      onClick={() => { setScenario(id as DemoScenario); setShowScenarios(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-body hover:bg-white/5 transition-colors"
                      style={{ color: activeScenario === id ? cfg.color : "rgba(255,255,255,0.5)" }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                      {cfg.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <button className="side-btn relative" onClick={useBatteryStore.getState().clearAlerts}>
          <Bell style={{ width: 17, height: 17 }} />
          {unreadAlertCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full"
              style={{ background: "#e040fb" }} />
          )}
        </button>
        <button className="side-btn" onClick={() => {
          const t = document.getElementById('global-toast');
          if(t) { t.innerText = 'Search feature coming in v2.0'; t.style.opacity = '1'; t.style.transform = 'translateY(0)'; setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-10px)'; }, 2000); }
        }}><Search style={{ width: 17, height: 17 }} /></button>
        <button className="side-btn" onClick={() => {
          const t = document.getElementById('global-toast');
          if(t) { t.innerText = 'Settings module locked in prototype'; t.style.opacity = '1'; t.style.transform = 'translateY(0)'; setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-10px)'; }, 2000); }
        }}><Settings style={{ width: 17, height: 17 }} /></button>

        <button
          onClick={toggleDemoMode}
          className="pill flex items-center gap-1.5 ml-1 text-xs"
          style={isDemoMode
            ? { background: "rgba(236,72,153,0.18)", color: "#f472b6", borderColor: "rgba(236,72,153,0.35)" }
            : { background: "rgba(139,92,246,0.14)", color: "#c084fc", borderColor: "rgba(139,92,246,0.3)" }
          }>
          <Rocket style={{ width: 12, height: 12 }} />
          {isDemoMode ? "Exit Demo" : "Demo"}
        </button>

        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-display font-bold ml-1"
          style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
          AI
        </div>
      </div>

      {/* Global Toast Placeholder */}
      <div id="global-toast" className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-2xl text-sm font-display font-medium text-white pointer-events-none transition-all duration-300 shadow-2xl"
        style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", opacity: 0, transform: "translateY(-10px)", backdropFilter: "blur(12px)" }}>
      </div>
    </header>
  );
}
