"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Thermometer, AlertTriangle, Shield, RefreshCw, Zap } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import ScenarioSelector from "@/components/ui/ScenarioSelector";
import ThermalHeatmap from "@/components/charts/ThermalHeatmap";
import TelemetryChart from "@/components/charts/TelemetryChart";
import ArcGauge from "@/components/charts/ArcGauge";
import { useBatteryStore } from "@/store/batteryStore";
import { thermalApi } from "@/lib/api";
import { useLiveTelemetry } from "@/hooks/useTelemetry";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

function CardHeader({ icon, title, color = "#a855f7", onRefresh, loading }: any) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20`, color }}>
          {icon}
        </div>
        <h3 className="font-display font-semibold text-sm text-white">{title}</h3>
      </div>
      {onRefresh && (
        <button onClick={onRefresh} disabled={loading} className="side-btn w-7 h-7 rounded-lg">
          <RefreshCw style={{ width: 13, height: 13 }} className={loading ? "animate-spin" : ""} />
        </button>
      )}
    </div>
  );
}

export default function ThermalPage() {
  const { activeVehicleId, activeScenario, latestTelemetry } = useBatteryStore();
  useLiveTelemetry(activeVehicleId, activeScenario);
  const [thermal, setThermal] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await thermalApi.predict(activeVehicleId, activeScenario);
      setThermal(res.data);
    } catch { /* backend unavailable */ }
    setLoading(false);
  }, [activeVehicleId, activeScenario]);

  useEffect(() => { load(); }, [load]);

  const risk = thermal?.runaway_risk;
  const riskPct = risk ? Math.round(risk.runaway_probability * 100) : 0;
  const riskColor = riskPct > 70 ? "#ef4444" : riskPct > 40 ? "#f59e0b" : "#a855f7";
  const t = latestTelemetry;
  const temp = t?.temperature_avg ?? 25;
  const onsetTemp = t?.chemistry === "LFP" ? 195 : t?.chemistry === "NCA" ? 120 : 130;
  const profileData: any[] = risk?.temperature_profile ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <ScenarioSelector />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Runaway Risk"     value={riskPct} unit="%" icon={<AlertTriangle style={{ width:14,height:14 }} />} accent={riskColor} glow={riskPct > 60} sub={risk?.risk_level ?? "—"} />
        <KPICard label="Peak Temp (60 min)" value={risk?.peak_temperature_c?.toFixed(1) ?? "--"} unit="°C" icon={<Thermometer style={{ width:14,height:14 }} />} accent={riskColor} sub={`Onset: ${onsetTemp}°C`} />
        <KPICard label="Time to Onset"    value={risk?.minutes_to_onset ? `${risk.minutes_to_onset} min` : "N/A"} icon={<Zap style={{ width:14,height:14 }} />} accent="#f59e0b" sub="Projected" />
        <KPICard label="Cell Gradient"    value={t?.temperature_gradient?.toFixed(1) ?? "--"} unit="°C" icon={<Shield style={{ width:14,height:14 }} />} accent="#22d3ee" sub="Max delta" />
      </div>

      {/* Critical alert */}
      {riskPct > 50 && (
        <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }}
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background:`${riskColor}12`, border:`1px solid ${riskColor}40` }}>
          <AlertTriangle style={{ width:18,height:18,color:riskColor,flexShrink:0,marginTop:1 }} className="status-blink" />
          <div>
            <p className="font-display font-bold text-sm text-white mb-1">THERMAL WARNING — AI Intervention Active</p>
            <p className="text-xs font-body leading-relaxed" style={{ color:"rgba(255,255,255,0.6)" }}>
              {risk?.recommended_action ?? "Reduce charge rate and activate supplemental cooling."}
            </p>
          </div>
        </motion.div>
      )}

      {/* Main 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Temp forecast */}
        <motion.div className="card p-6" initial={{ opacity:0 }} animate={{ opacity:1 }}>
          <CardHeader icon={<Thermometer style={{ width:16,height:16 }} />}
            title={`60-Min Temperature Forecast (${t?.chemistry ?? "NMC"})`}
            color={riskColor} onRefresh={load} loading={loading} />
          {loading ? (
            <div className="h-52 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor:`${riskColor}40`, borderTopColor:riskColor }} />
            </div>
          ) : profileData.length > 0 ? (
            <div style={{ height:200 }}>
              <ResponsiveContainer>
                <AreaChart data={profileData} margin={{ top:5,right:5,bottom:5,left:0 }}>
                  <defs>
                    <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={riskColor} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={riskColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="minute" tick={{ fontSize:10,fill:"rgba(255,255,255,0.3)" }}
                    label={{ value:"Minutes",fill:"rgba(255,255,255,0.3)",fontSize:10,position:"insideBottom",offset:-2 }} />
                  <YAxis tick={{ fontSize:10,fill:"rgba(255,255,255,0.3)" }} width={36} />
                  <Tooltip contentStyle={{ background:"#1a1635",border:`1px solid ${riskColor}40`,borderRadius:12,fontSize:12 }}
                    labelStyle={{ color:"rgba(255,255,255,0.4)" }} itemStyle={{ color:riskColor }} />
                  <ReferenceLine y={onsetTemp} stroke="#ef4444" strokeDasharray="4 2" opacity={0.5}
                    label={{ value:"Onset",fill:"#ef4444",fontSize:9 }} />
                  <Area type="monotone" dataKey="temperature_c" stroke={riskColor} strokeWidth={2}
                    fill="url(#tGrad)" dot={false} name="Temp °C" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center rounded-2xl text-xs font-mono"
              style={{ background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.2)" }}>
              AWAITING PREDICTION...
            </div>
          )}
        </motion.div>

        {/* Risk gauge + heatmap */}
        <motion.div className="card p-6" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}>
          <CardHeader icon={<Shield style={{ width:16,height:16 }} />} title="Thermal Risk Assessment" color={riskColor} />
          <div className="flex items-center justify-center mb-5">
            <ArcGauge value={riskPct} size={160} strokeWidth={14} color={riskColor}
              label={`${riskPct}%`} sublabel="Runaway Risk" />
          </div>
          {t?.cell_temperatures && t.cell_temperatures.length > 0 ? (
            <ThermalHeatmap cellTemperatures={t.cell_temperatures} width={330} height={110} />
          ) : (
            <div className="rounded-2xl flex items-center justify-center text-xs font-mono"
              style={{ height:110,background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.2)" }}>
              Awaiting cell data...
            </div>
          )}
          {t && (
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { label:"Min",  val:`${t.temperature_min?.toFixed(1)}°C`, color:"#22d3ee" },
                { label:"Avg",  val:`${t.temperature_avg?.toFixed(1)}°C`, color:riskColor },
                { label:"Max",  val:`${t.temperature_max?.toFixed(1)}°C`, color:"#ef4444" },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-2.5 text-center"
                  style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs font-body mb-1" style={{ color:"rgba(255,255,255,0.35)" }}>{item.label}</p>
                  <p className="text-sm font-display font-bold" style={{ color:item.color }}>{item.val}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Live stream */}
      <motion.div className="card p-5" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}>
        <p className="text-sm font-display font-semibold text-white mb-4">Thermal Risk Score — Live</p>
        <TelemetryChart metric="thermal_risk_score" height={130} />
      </motion.div>

      {/* AI recommendations */}
      <motion.div className="card p-6" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.25 }}>
        <CardHeader icon={<Shield style={{ width:16,height:16 }} />} title="AI Thermal Recommendations" color="#22d3ee" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title:"Pre-Conditioning",   desc:"Pre-cool 8 min before DC fast charging — reduces peak temps by up to 12°C", action:"AUTOMATED",  color:"#22d3ee" },
            { title:"C-Rate Reduction",   desc:`Taper charge rate by 35% above 38°C for ${t?.chemistry ?? "NMC"} chemistry`, action:riskPct > 50 ? "ACTIVE" : "STANDBY", color:riskPct > 50 ? "#ef4444" : "#f59e0b" },
            { title:"Heat Redistribution",desc:"Activate peripheral cell cooling to equalise gradient across pack",           action:t?.temperature_gradient && t.temperature_gradient > 5 ? "TRIGGERED" : "MONITORING", color:"#a855f7" },
          ].map(item => (
            <div key={item.title} className="rounded-xl p-4"
              style={{ background:"rgba(255,255,255,0.04)",border:`1px solid ${item.color}20` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-display font-semibold text-white">{item.title}</p>
                <span className="pill text-xs" style={{ background:`${item.color}18`,color:item.color,borderColor:`${item.color}35`,fontSize:10 }}>{item.action}</span>
              </div>
              <p className="text-xs font-body leading-relaxed" style={{ color:"rgba(255,255,255,0.45)" }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
