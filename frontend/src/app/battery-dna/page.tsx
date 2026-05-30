"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Dna, Award, TrendingDown, Clock, RefreshCw } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import ScenarioSelector from "@/components/ui/ScenarioSelector";
import ArcGauge from "@/components/charts/ArcGauge";
import DegradationChart from "@/components/charts/DegradationChart";
import { useBatteryStore } from "@/store/batteryStore";
import { batteryApi } from "@/lib/api";
import { useLiveTelemetry } from "@/hooks/useTelemetry";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl ${className}`} style={{ background: "rgba(255,255,255,0.05)" }} />;
}

function CardHeader({ icon, title, badge, color = "#a855f7", onRefresh, loading }: {
  icon: React.ReactNode; title: string; badge?: string;
  color?: string; onRefresh?: () => void; loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20`, color }}>
          {icon}
        </div>
        <h3 className="font-display font-semibold text-sm text-white">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span className="pill text-xs" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", borderColor: "rgba(255,255,255,0.1)", fontSize: 11 }}>
            {badge}
          </span>
        )}
        {onRefresh && (
          <button onClick={onRefresh} disabled={loading} className="side-btn w-7 h-7 rounded-lg">
            <RefreshCw style={{ width: 13, height: 13, ...(loading ? { animation: "spin 1s linear infinite" } : {}) }} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function BatteryDNAPage() {
  const { activeVehicleId, activeScenario, latestTelemetry } = useBatteryStore();
  useLiveTelemetry(activeVehicleId, activeScenario);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [health, traj] = await Promise.all([
        batteryApi.getHealth(activeVehicleId, activeScenario),
        batteryApi.getDegradationTrajectory(activeVehicleId, 36, activeScenario),
      ]);
      setData({ health: health.data, trajectory: traj.data });
    } catch {
      setError("Backend unavailable");
    } finally { setLoading(false); }
  }, [activeVehicleId, activeScenario]);

  useEffect(() => { load(); }, [load]);

  const soh = data?.health?.soh_prediction?.soh ?? latestTelemetry?.state_of_health ?? 90;
  const eol = data?.health?.end_of_life;
  const calLoss = data?.health?.soh_prediction?.calendar_loss_pct ?? 0;
  const cycLoss = data?.health?.soh_prediction?.cycle_loss_pct ?? 0;

  const riskColor = soh >= 85 ? "#a855f7" : soh >= 75 ? "#f59e0b" : "#ef4444";

  // DNA bars — deterministic from vehicleId hash
  const dnaPattern = Array.from({ length: 52 }, (_, i) => {
    const seed = (activeVehicleId.charCodeAt(i % activeVehicleId.length) * 17 + i * 31) % 100;
    const colors = ["#7c3aed", "#a855f7", "#ec4899", "#22d3ee", "#f59e0b"];
    return { h: 12 + seed * 0.58, color: colors[i % colors.length] };
  });

  return (
    <div className="p-6 space-y-5">
      <ScenarioSelector />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Health Score" value={loading ? "--" : soh} unit="%" icon={<Dna style={{ width: 14, height: 14 }} />} accent={riskColor} glow sub={data?.health?.soh_prediction?.method ?? ""} />
        <KPICard label="Calendar Loss" value={loading ? "--" : calLoss} unit="%" icon={<Clock style={{ width: 14, height: 14 }} />} accent="#f59e0b" sub="SEI growth aging" />
        <KPICard label="Cycle Loss" value={loading ? "--" : cycLoss} unit="%" icon={<TrendingDown style={{ width: 14, height: 14 }} />} accent="#ec4899" sub="Electrode fatigue" />
        <KPICard label="Months to EoL" value={loading ? "--" : (eol?.months_to_eol ?? "--")} icon={<Award style={{ width: 14, height: 14 }} />} accent={eol?.months_to_eol < 24 ? "#ef4444" : "#22d3ee"} sub="At 80% threshold" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* DNA Fingerprint */}
        <motion.div className="card p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <CardHeader icon={<Dna style={{ width: 16, height: 16 }} />} title="Battery Genomic Fingerprint"
            badge={activeVehicleId} color="#a855f7" onRefresh={load} loading={loading} />
          {/* DNA bars */}
          <div className="flex items-end gap-[2px] mb-5" style={{ height: 72 }}>
            {dnaPattern.map((d, i) => (
              <motion.div key={i} className="flex-1 rounded-sm"
                style={{ height: d.h, background: d.color, opacity: 0.75 }}
                animate={{ height: [d.h, d.h * 0.68, d.h] }}
                transition={{ duration: 2.2 + (i % 6) * 0.25, repeat: Infinity, delay: i * 0.025 }} />
            ))}
          </div>
          {/* Metrics grid */}
          {loading ? (
            <div className="grid grid-cols-3 gap-3">{[...Array(6)].map((_,i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Charge Pattern",   value: soh >= 90 ? "CONSERVATIVE" : "MODERATE",    color: "#f59e0b" },
                { label: "Thermal Exposure", value: activeScenario === "thermal_runaway" ? "HIGH" : "LOW", color: activeScenario === "thermal_runaway" ? "#ef4444" : "#22d3ee" },
                { label: "Cycle Depth",      value: `${(calLoss * 8 + 60).toFixed(1)}%`,          color: "#a855f7" },
                { label: "Fast Charge Freq", value: activeScenario === "fast_charge_abuse" ? "HIGH" : "LOW", color: activeScenario === "fast_charge_abuse" ? "#ec4899" : "#10b981" },
                { label: "Deep Discharge",   value: "7 events",                                    color: "#f59e0b" },
                { label: "Cell Balance",     value: soh > 85 ? "EXCELLENT" : soh > 75 ? "FAIR" : "POOR", color: riskColor },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs mb-1.5 font-body" style={{ color: "rgba(255,255,255,0.4)" }}>{item.label}</p>
                  <p className="text-xs font-display font-bold" style={{ color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Health Certificate */}
        <motion.div className="card p-6 relative overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          style={{ borderColor: `${riskColor}30` }}>
          <div className="absolute top-0 right-0 w-48 h-48 rounded-bl-full opacity-[0.04] pointer-events-none" style={{ background: riskColor }} />
          <CardHeader icon={<Award style={{ width: 16, height: 16 }} />} title="Battery Health Certificate" color={riskColor} />

          {/* Gauge center piece */}
          <div className="flex justify-center mb-5">
            {loading ? <Skeleton className="w-40 h-40 rounded-full" /> : (
              <ArcGauge value={soh} size={155} strokeWidth={14} color={riskColor}
                label={`${soh.toFixed(0)}%`} sublabel="Overall Score" />
            )}
          </div>

          {loading ? (
            <div className="space-y-2">{[...Array(6)].map((_,i) => (
              <div key={i} className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <Skeleton className="w-28 h-3" /><Skeleton className="w-20 h-3" />
              </div>
            ))}</div>
          ) : (
            <div className="space-y-0">
              {[
                { label: "AI Risk Rating",      value: soh >= 85 ? "LOW" : soh >= 75 ? "MEDIUM" : "HIGH", color: riskColor },
                { label: "Resale Confidence",   value: `${Math.min(98, soh * 0.95 + 2).toFixed(1)}%`,     color: "#22d3ee" },
                { label: "Predicted Life Left", value: `${eol?.months_to_eol ?? "--"} months`             },
                { label: "Prediction Method",   value: data?.health?.soh_prediction?.method ?? "--"        },
                { label: "Model Confidence",    value: `${((data?.health?.soh_prediction?.confidence ?? 0.87) * 100).toFixed(0)}%` },
                { label: "Chemistry",           value: latestTelemetry?.chemistry ?? "NMC"                 },
                { label: "Total Cycles",        value: String(latestTelemetry?.cycle_count ?? "--")        },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-2.5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-xs font-body" style={{ color: "rgba(255,255,255,0.4)" }}>{row.label}</span>
                  <span className="text-xs font-mono font-semibold" style={{ color: (row as any).color ?? "white" }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Degradation trajectory */}
      <motion.div className="card p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <CardHeader icon={<TrendingDown style={{ width: 16, height: 16 }} />}
          title="36-Month SoH Degradation Trajectory" color="#a855f7" />
        {loading ? <Skeleton className="h-56 w-full" /> : data?.trajectory?.trajectory ? (
          <DegradationChart trajectory={data.trajectory.trajectory} eolThreshold={80} height={220} />
        ) : (
          <div className="h-56 flex items-center justify-center text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
            NO DATA — CONNECT BACKEND
          </div>
        )}
      </motion.div>
    </div>
  );
}
