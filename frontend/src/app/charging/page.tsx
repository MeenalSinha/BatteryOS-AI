"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Zap, TrendingUp, Award, Clock, RefreshCw } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import ScenarioSelector from "@/components/ui/ScenarioSelector";
import ChargingCurveChart from "@/components/charts/ChargingCurveChart";
import ArcGauge from "@/components/charts/ArcGauge";
import { useBatteryStore } from "@/store/batteryStore";
import { chargingApi } from "@/lib/api";
import { useLiveTelemetry } from "@/hooks/useTelemetry";

function CardHeader({ icon, title, color = "#a855f7", onRefresh, loading }: any) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:`${color}20`,color }}>{icon}</div>
        <h3 className="font-display font-semibold text-sm text-white">{title}</h3>
      </div>
      {onRefresh && (
        <button onClick={onRefresh} disabled={loading} className="side-btn w-7 h-7 rounded-lg">
          <RefreshCw style={{ width:13,height:13 }} className={loading ? "animate-spin" : ""} />
        </button>
      )}
    </div>
  );
}

export default function ChargingPage() {
  const { activeVehicleId, activeScenario, latestTelemetry } = useBatteryStore();
  useLiveTelemetry(activeVehicleId, activeScenario);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [targetSoc, setTargetSoc] = useState(80);
  const t = latestTelemetry;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chargingApi.optimize(activeVehicleId, targetSoc, activeScenario);
      setData(res.data.charging_plan);
    } catch {}
    setLoading(false);
  }, [activeVehicleId, activeScenario, targetSoc]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.optimization_summary;
  const zoneColors: Record<string,string> = { cold:"#22d3ee",cool:"#22d3ee",optimal:"#a855f7",warm:"#f59e0b",hot:"#ef4444" };
  const zoneColor = zoneColors[data?.temperature_zone ?? "optimal"] ?? "#a855f7";

  const STAGES = [
    { n:"01", name:"Thermal Pre-conditioning",  range:"0–5 min",    desc:"Ramp-up phase — protects cells from cold-start lithium plating",              color:"#22d3ee" },
    { n:"02", name:"Constant Current — Peak",    range:"5–40% SoC",  desc:`Max safe C-rate (${data?.max_c_rate ?? "—"}C) chemistry-aware for ${t?.chemistry ?? "NMC"}`, color:"#a855f7" },
    { n:"03", name:"Adaptive Taper",             range:"40–80% SoC", desc:"Gradual current reduction based on real-time cell impedance feedback",         color:"#f59e0b" },
    { n:"04", name:"Constant Voltage Phase",     range:"80–100% SoC",desc:"Exponential taper — prevents lithium plating and electrolyte oxidation",       color:"#ec4899" },
  ];

  return (
    <div className="p-6 space-y-5">
      <ScenarioSelector />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Max C-Rate"      value={loading ? "--" : data?.max_c_rate ?? "--"} unit="C" icon={<Zap style={{ width:14,height:14 }} />} accent="#f59e0b" sub="Chemistry-limited" />
        <KPICard label="Temp Zone"       value={loading ? "--" : (data?.temperature_zone?.toUpperCase() ?? "--")} icon={<TrendingUp style={{ width:14,height:14 }} />} accent={zoneColor} sub="Operating zone" />
        <KPICard label="SoH Derating"    value={loading ? "--" : (data?.soh_derating_factor ? (data.soh_derating_factor * 100).toFixed(0) : "--")} unit="%" icon={<Award style={{ width:14,height:14 }} />} accent="#22d3ee" sub="Current multiplier" />
        <KPICard label="Efficiency Gain" value={loading ? "--" : (summary?.energy_efficiency_gain_pct?.toFixed(1) ?? "--")} unit="%" icon={<Clock style={{ width:14,height:14 }} />} accent="#a855f7" glow sub="vs standard" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Gauge + target slider */}
        <motion.div className="card p-6 flex flex-col items-center" initial={{ opacity:0 }} animate={{ opacity:1 }}>
          <CardHeader icon={<Zap style={{ width:16,height:16 }} />} title="Charge Target" color="#a855f7" />
          <ArcGauge value={targetSoc} size={170} strokeWidth={14} color="#a855f7"
            label={`${targetSoc}%`} sublabel="Target SoC" />
          <div className="w-full mt-5">
            <input type="range" min={50} max={100} value={targetSoc}
              onChange={e => setTargetSoc(Number(e.target.value))}
              className="w-full accent-purple-3" style={{ accentColor:"#a855f7" }} />
            <div className="flex justify-between text-xs font-mono mt-1"
              style={{ color:"rgba(255,255,255,0.3)" }}>
              <span>50% — Preserve</span><span>100% — Max range</span>
            </div>
          </div>
          {t && (
            <div className="w-full grid grid-cols-2 gap-2 mt-4">
              {[
                { label:"Current SoC", val:`${t.state_of_charge?.toFixed(1)}%`, color:"#a855f7" },
                { label:"Temperature", val:`${t.temperature_avg?.toFixed(1)}°C`, color:"#f59e0b" },
                { label:"SoH",         val:`${t.state_of_health?.toFixed(1)}%`,  color:"#22d3ee" },
                { label:"Status",      val:t.is_charging ? t.charger_type ?? "CHARGING" : "IDLE", color:t.is_charging ? "#a855f7" : "rgba(255,255,255,0.4)" },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-2.5"
                  style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs font-body" style={{ color:"rgba(255,255,255,0.35)" }}>{item.label}</p>
                  <p className="text-xs font-display font-bold mt-0.5" style={{ color:item.color }}>{item.val}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Charging curves */}
        <motion.div className="card p-6 lg:col-span-2" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}>
          <CardHeader icon={<TrendingUp style={{ width:16,height:16 }} />}
            title="Adaptive Charging Curve — Standard vs AI Optimized"
            color="#a855f7" onRefresh={load} loading={loading} />
          {loading ? (
            <div className="h-56 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor:"rgba(168,85,247,0.3)",borderTopColor:"#a855f7" }} />
            </div>
          ) : data ? (
            <ChargingCurveChart standardCurve={data.standard_curve?.points ?? []} optimizedCurve={data.optimized_curve?.points ?? []} height={220} />
          ) : (
            <div className="h-56 flex items-center justify-center rounded-2xl text-xs font-mono"
              style={{ background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.2)" }}>
              CONNECT BACKEND TO SEE CURVES
            </div>
          )}

          {summary && !loading && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { title:"Degradation Reduction", val:`${summary.degradation_reduction_pct?.toFixed(1) ?? 0}%`, color:"#a855f7" },
                { title:"Efficiency Gain",        val:`${summary.energy_efficiency_gain_pct?.toFixed(1) ?? 0}%`, color:"#22d3ee" },
                { title:"Time Delta",             val:`${Math.abs(summary.time_savings_min ?? 0)} min`,          color:"#f59e0b" },
              ].map(item => (
                <div key={item.title} className="rounded-xl p-3 text-center"
                  style={{ background:"rgba(255,255,255,0.04)",border:`1px solid ${item.color}20` }}>
                  <p className="text-xs font-body mb-1" style={{ color:"rgba(255,255,255,0.4)" }}>{item.title}</p>
                  <p className="font-display font-bold" style={{ color:item.color,fontSize:"1.2rem" }}>{item.val}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Protocol stages */}
      <motion.div className="card p-6" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}>
        <CardHeader icon={<Zap style={{ width:16,height:16 }} />} title="AI Charging Protocol — 4 Stages" color="#a855f7" />
        <div className="space-y-3">
          {STAGES.map(s => (
            <div key={s.n} className="flex items-start gap-4 p-3.5 rounded-2xl"
              style={{ background:`${s.color}08`,border:`1px solid ${s.color}18` }}>
              <span className="font-display font-bold text-xs flex-shrink-0 mt-0.5" style={{ color:s.color }}>STAGE {s.n}</span>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-0.5">
                  <p className="text-sm font-display font-medium text-white">{s.name}</p>
                  <span className="text-xs font-mono" style={{ color:"rgba(255,255,255,0.35)" }}>{s.range}</span>
                </div>
                <p className="text-xs font-body leading-relaxed" style={{ color:"rgba(255,255,255,0.45)" }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
