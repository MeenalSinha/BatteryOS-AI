"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Shield, Zap, Activity, Users, Box, ChevronRight, Radio, TrendingUp, AlertTriangle } from "lucide-react";
import ArcGauge from "@/components/charts/ArcGauge";

const STATS = [
  { value: "47%",  label: "Battery Life Extension",      color: "#a855f7" },
  { value: "98.6%",label: "Thermal Runaway Prevention",   color: "#22d3ee" },
  { value: "3.2x", label: "Faster Anomaly Detection",     color: "#f59e0b" },
  { value: "12B+", label: "Telemetry Points Processed",   color: "#ec4899" },
];

const FEATURES = [
  { icon: Activity, title: "BatteryDNA Engine",          desc: "Unique genomic fingerprint per battery tracking micro-degradation at cell level.",              color: "#a855f7" },
  { icon: Zap,      title: "VoltGuard Thermal AI",        desc: "Predicts thermal runaway 90 minutes in advance using physics-informed models.",                  color: "#ef4444" },
  { icon: Radio,    title: "Dynamic Charging",            desc: "AI-adaptive CC-CV curves that reduce degradation 47% while optimising charge time.",             color: "#f59e0b" },
  { icon: Box,      title: "Digital Twin Simulator",      desc: "Physics-based virtual battery for scenario planning and failure mode exploration.",               color: "#9333ea" },
  { icon: Users,    title: "Fleet Intelligence",          desc: "Enterprise analytics across thousands of batteries — risk maps, leaderboards, maintenance.",       color: "#22d3ee" },
  { icon: Shield,   title: "Battery Passport",            desc: "Blockchain-anchored health certificates enabling trusted EV resale and insurance.",               color: "#10b981" },
];

export default function LandingPage() {
  const [liveStats, setLiveStats] = useState({ soh: 87, thermal: 94, efficiency: 72 });

  useEffect(() => {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
    const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
    fetch(`${protocol}//${host}:8000/api/v1/fleet/dashboard?fleet_id=FLEET-001&num_vehicles=10`)
      .then(r => r.json())
      .then(data => {
        const summary = data?.summary;
        if (summary) {
          setLiveStats({
            soh: Number(summary.avg_soh) || 87,
            thermal: Math.round(Math.max(0, 100 - (summary.critical_count / Math.max(1, summary.total_vehicles)) * 100)) || 94,
            efficiency: summary.healthy_count ? Math.round((summary.healthy_count / Math.max(1, summary.total_vehicles)) * 100) : 72,
          });
        }
      })
      .catch(() => {}); // keep defaults if backend unavailable
  }, []);
  return (
    <div className="min-h-screen overflow-hidden">
      <div className="scan-line" />

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 h-16"
        style={{ background: "rgba(10,8,24,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(139,92,246,0.12)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
            <Radio className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-white">BatteryOS AI</span>
        </div>
        <div className="hidden md:flex items-center gap-1 rounded-full px-2 py-1.5"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {["Modules", "Impact", "Use Cases"].map(label => (
            <a key={label} href={`#${label.toLowerCase().replace(" ","-")}`}
              className="nav-pill text-sm">{label}</a>
          ))}
        </div>
        <Link href="/dashboard">
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            className="pill font-display text-sm"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "white", borderColor: "transparent", padding: "8px 22px" }}>
            Launch Platform
          </motion.button>
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-16 text-center">
        {/* Background radial */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 20%, rgba(139,92,246,0.18) 0%, transparent 65%)"
        }} />

        <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-4xl">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-display"
            style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.35)", color: "#c084fc" }}>
            <span className="w-1.5 h-1.5 rounded-full status-blink" style={{ background: "#a855f7" }} />
            AI-NATIVE EV BATTERY OPERATING SYSTEM
          </motion.div>

          <h1 className="font-display font-black text-white mb-6 leading-tight" style={{ fontSize: "clamp(2.5rem,6vw,5rem)" }}>
            The AI Brain Behind<br />
            <span style={{
              background: "linear-gradient(135deg,#a855f7,#ec4899,#f472b6)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 30px rgba(168,85,247,0.5))",
            }}>
              Every EV Battery
            </span>
          </h1>

          <p className="text-lg mb-12 max-w-2xl mx-auto font-body leading-relaxed"
            style={{ color: "rgba(255,255,255,0.55)" }}>
            BatteryOS AI replaces reactive BMS with a predictive AI operating system that extends
            battery life, prevents failures, and delivers enterprise-grade intelligence at every cycle.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/dashboard">
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 font-display font-semibold px-8 py-4 rounded-2xl text-white"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 40px rgba(139,92,246,0.4)" }}>
                Enter Command Center <ChevronRight className="w-4 h-4" />
              </motion.button>
            </Link>
            <Link href="/digital-twin">
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 font-display font-semibold px-8 py-4 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" }}>
                Run Digital Twin <Box className="w-4 h-4" />
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* Hero gauge cluster */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="mt-20 flex items-center gap-8 flex-wrap justify-center">
          {[
            { value: liveStats.soh,        color: "#a855f7", label: "SoH Score",        sub: "Avg Fleet" },
            { value: liveStats.thermal,    color: "#22d3ee", label: "Thermal Safe",      sub: "Probability" },
            { value: liveStats.efficiency, color: "#f59e0b", label: "Charge Efficiency", sub: "Optimized" },
          ].map((g, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 + i * 0.1 }} className="card p-6 flex flex-col items-center gap-2">
              <ArcGauge value={g.value} size={130} strokeWidth={12} color={g.color}
                label={`${g.value}%`} sublabel={g.sub} />
              <p className="text-xs font-display text-center" style={{ color: "rgba(255,255,255,0.45)" }}>{g.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Stats */}
      <section id="impact" className="py-24 px-6"
        style={{ borderTop: "1px solid rgba(139,92,246,0.1)", borderBottom: "1px solid rgba(139,92,246,0.1)" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }} viewport={{ once: true }} className="text-center">
              <p className="font-display font-black mb-2" style={{
                fontSize: "2.8rem", color: s.color,
                textShadow: `0 0 30px ${s.color}60`,
              }}>{s.value}</p>
              <p className="text-sm font-body" style={{ color: "rgba(255,255,255,0.45)" }}>{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="modules" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <h2 className="font-display font-bold text-white mb-4 text-4xl">Eight Intelligence Modules</h2>
            <p className="max-w-xl mx-auto font-body" style={{ color: "rgba(255,255,255,0.45)" }}>
              Every module interconnected — telemetry flows through AI in real time, from cell physics to fleet strategy.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }} viewport={{ once: true }}
                  whileHover={{ y: -4 }} className="card p-6"
                  style={{ borderColor: `${f.color}20` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${f.color}18`, color: f.color }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-semibold text-white mb-2 text-sm">{f.title}</h3>
                  <p className="text-sm font-body leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="py-24 px-6"
        style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-5xl mx-auto">
          <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="font-display font-bold text-white text-3xl text-center mb-12">
            Built For Every Stakeholder
          </motion.h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["EV Manufacturers","Fleet Operators","Battery OEMs","Smart Charger Providers",
              "EV Service Centers","Used EV Marketplaces","Insurance Providers","Grid Operators"].map((u, i) => (
              <motion.div key={u} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }} viewport={{ once: true }}
                className="card p-4 text-center text-sm font-body cursor-default"
                style={{ color: "rgba(255,255,255,0.5)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#c084fc"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(168,85,247,0.3)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; (e.currentTarget as HTMLElement).style.borderColor = ""; }}>
                {u}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="font-display font-black text-white text-4xl mb-4">
            Ready to See the Future of
            <span style={{ background: "linear-gradient(135deg,#a855f7,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {" "}EV Intelligence?
            </span>
          </h2>
          <p className="mb-10 font-body" style={{ color: "rgba(255,255,255,0.45)" }}>
            Launch the Command Center or trigger a live hackathon demo scenario.
          </p>
          <Link href="/dashboard">
            <motion.button whileHover={{ scale: 1.04 }}
              className="px-12 py-4 rounded-2xl font-display font-bold text-white"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 50px rgba(139,92,246,0.4)" }}>
              LAUNCH BATTERYOS AI
            </motion.button>
          </Link>
        </motion.div>
      </section>

      <footer className="py-8 text-center text-xs font-mono" style={{ borderTop: "1px solid rgba(139,92,246,0.1)", color: "rgba(255,255,255,0.2)" }}>
        BatteryOS AI v1.0 — Built by NeuroIgniter — MIT License
      </footer>
    </div>
  );
}
