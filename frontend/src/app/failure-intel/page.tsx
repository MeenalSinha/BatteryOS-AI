"use client";
import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Activity, Zap, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import ScenarioSelector from "@/components/ui/ScenarioSelector";
import CellVoltageBar from "@/components/charts/CellVoltageBar";
import TelemetryChart from "@/components/charts/TelemetryChart";
import { useBatteryStore } from "@/store/batteryStore";
import { useLiveTelemetry } from "@/hooks/useTelemetry";

const SEV: Record<string,string> = { CRITICAL:"#ef4444",HIGH:"#f97316",WARNING:"#f59e0b",NORMAL:"#a855f7" };

export default function FailureIntelPage() {
  const { activeVehicleId, activeScenario, latestTelemetry, alerts, unreadAlertCount, clearAlerts } = useBatteryStore();
  useLiveTelemetry(activeVehicleId, activeScenario);
  const t = latestTelemetry;
  const [showXai, setShowXai] = useState(false);

  const cells    = t?.cell_voltages ?? [];
  const mean     = cells.length ? cells.reduce((a,b)=>a+b,0)/cells.length : 3.6;
  const delta    = cells.length ? Math.max(...cells)-Math.min(...cells) : 0;
  const weak     = cells.filter(v => Math.abs(v-mean)>0.04).length;
  const imbal    = delta > 0.05;
  const anomaly  = t?.anomaly_score ?? 0;
  const thermal  = t?.thermal_risk_score ?? 0;
  const riskScore = Math.max(anomaly, thermal);
  const rc       = riskScore > 0.7 ? "#ef4444" : riskScore > 0.4 ? "#f59e0b" : "#a855f7";

  const predictions = [
    { label:"Cell Imbalance",     pct: Math.min(99, Math.round(delta*800)), sev: imbal ? "WARNING" : "NORMAL" },
    { label:"Thermal Stress",     pct: Math.round(thermal*100),             sev: thermal>0.7?"CRITICAL":thermal>0.4?"HIGH":"NORMAL" },
    { label:"Voltage Anomaly",    pct: Math.round(anomaly*85),              sev: anomaly>0.7?"HIGH":anomaly>0.4?"WARNING":"NORMAL" },
    { label:"Capacity Fade",      pct: t ? Math.max(0,Math.round((100-t.state_of_health)*1.8)) : 0, sev: t&&t.state_of_health<80?"WARNING":"NORMAL" },
    { label:"Thermal Runaway 30d",pct: Math.round(Math.pow(thermal,1.5)*100), sev: thermal>0.7?"CRITICAL":thermal>0.4?"HIGH":"NORMAL" },
  ];

  const xaiFeatures = [
    { label:"Temperature",    imp: thermal*0.35,           desc:`${t?.temperature_avg?.toFixed(1)}°C current` },
    { label:"Anomaly Score",  imp: anomaly*0.30,            desc:`Score: ${anomaly.toFixed(3)}` },
    { label:"Cell Imbalance", imp: Math.min(0.3,delta*3),  desc:`Delta: ${(delta*1000).toFixed(1)}mV` },
    { label:"SoH Level",      imp: Math.max(0,(100-(t?.state_of_health??90))/100*0.25), desc:`SoH: ${(t?.state_of_health??90).toFixed(1)}%` },
  ].sort((a,b) => b.imp-a.imp);

  return (
    <div className="p-6 space-y-5">
      <ScenarioSelector />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Risk Score"    value={(riskScore*100).toFixed(0)} unit="%" icon={<AlertTriangle style={{ width:14,height:14 }} />} accent={rc} glow={riskScore>0.6} sub={riskScore>0.7?"CRITICAL":riskScore>0.4?"Elevated":"Normal"} />
        <KPICard label="Weak Cells"    value={t ? weak : "--"}            icon={<Zap style={{ width:14,height:14 }} />} accent={weak>3?"#ef4444":"#a855f7"} sub={`of ${cells.length} total`} />
        <KPICard label="Anomaly Score" value={t ? (anomaly*100).toFixed(0) : "--"} unit="%" icon={<Activity style={{ width:14,height:14 }} />} accent={rc} sub="Isolation Forest" />
        <KPICard label="Active Alerts" value={alerts.length}              icon={<TrendingDown style={{ width:14,height:14 }} />} accent={alerts.length>0?"#f97316":"#a855f7"} sub="All vehicles" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Forecast bars */}
        <motion.div className="card p-6" initial={{ opacity:0 }} animate={{ opacity:1 }}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:"#ef444420",color:"#ef4444" }}>
              <AlertTriangle style={{ width:16,height:16 }} />
            </div>
            <h3 className="font-display font-semibold text-sm text-white">30-Day Failure Probability</h3>
          </div>
          <div className="space-y-4">
            {predictions.map(p => {
              const c = SEV[p.sev];
              return (
                <div key={p.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-body" style={{ color:"rgba(255,255,255,0.7)" }}>{p.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="pill text-xs" style={{ background:`${c}18`,color:c,borderColor:`${c}35`,fontSize:10 }}>{p.sev}</span>
                      <span className="font-display font-bold text-sm" style={{ color:c }}>{p.pct}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.06)" }}>
                    <motion.div initial={{ width:0 }} animate={{ width:`${p.pct}%` }} transition={{ duration:0.8,delay:0.1 }}
                      className="h-full rounded-full" style={{ background:`linear-gradient(90deg,${c}99,${c})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Cell voltage */}
        <motion.div className="card p-6" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:"#a855f720",color:"#a855f7" }}>
                <Zap style={{ width:16,height:16 }} />
              </div>
              <h3 className="font-display font-semibold text-sm text-white">Cell Voltage Imbalance</h3>
            </div>
            {imbal && <span className="pill text-xs" style={{ background:"#ef444418",color:"#ef4444",borderColor:"#ef444435",fontSize:10 }}>IMBALANCE</span>}
          </div>
          {!t ? (
            <div className="h-32 rounded-2xl flex items-center justify-center text-xs font-mono animate-pulse" style={{ background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.2)" }}>AWAITING DATA...</div>
          ) : cells.length > 0 ? (
            <>
              <CellVoltageBar cellVoltages={cells} height={110} />
              <div className="grid grid-cols-4 gap-2 mt-3">
                {[
                  { label:"Weak",  val:String(weak),                       color:weak>3?"#ef4444":"#a855f7" },
                  { label:"Delta", val:`${(delta*1000).toFixed(1)}mV`,     color:imbal?"#ef4444":"#a855f7" },
                  { label:"Min V", val:`${Math.min(...cells).toFixed(3)}V`, color:"#22d3ee" },
                  { label:"Max V", val:`${Math.max(...cells).toFixed(3)}V`, color:"#22d3ee" },
                ].map(item => (
                  <div key={item.label} className="rounded-xl p-2 text-center"
                    style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-xs font-body" style={{ color:"rgba(255,255,255,0.35)" }}>{item.label}</p>
                    <p className="text-xs font-display font-bold mt-0.5" style={{ color:item.color }}>{item.val}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs font-mono" style={{ color:"rgba(255,255,255,0.2)" }}>NO CELL DATA</div>
          )}
        </motion.div>
      </div>

      {/* Live charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div className="card p-5" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}>
          <p className="text-sm font-display font-semibold text-white mb-4">Anomaly Score — Live</p>
          <TelemetryChart metric="anomaly_score" height={140} />
        </motion.div>
        <motion.div className="card p-5" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.25 }}>
          <p className="text-sm font-display font-semibold text-white mb-4">Thermal Risk — Live</p>
          <TelemetryChart metric="thermal_risk_score" height={140} />
        </motion.div>
      </div>

      {/* XAI panel */}
      <motion.div className="card p-5" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.3 }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-display font-semibold text-white">Explainable AI — Anomaly Attribution</p>
          <button onClick={() => setShowXai(v=>!v)}
            className="flex items-center gap-1 text-xs font-display"
            style={{ color:"#22d3ee" }}>
            {showXai ? <><ChevronUp style={{ width:13,height:13 }} />Hide</> : <><ChevronDown style={{ width:13,height:13 }} />Explain</>}
          </button>
        </div>
        <AnimatePresence>
          {showXai && (
            <motion.div initial={{ opacity:0,height:0 }} animate={{ opacity:1,height:"auto" }} exit={{ opacity:0,height:0 }} className="mt-4 overflow-hidden">
              <p className="text-xs font-body leading-relaxed mb-4 pl-3" style={{ color:"rgba(255,255,255,0.55)",borderLeft:"2px solid #22d3ee" }}>
                {riskScore < 0.3
                  ? "Battery operating within normal parameters. No anomalies detected."
                  : riskScore < 0.6
                  ? `Minor anomaly on ${activeVehicleId}. Temp ${t?.temperature_avg?.toFixed(1)}°C. Monitor closely.`
                  : `Significant anomaly. Thermal risk ${(thermal*100).toFixed(0)}%. Immediate attention required.`}
              </p>
              <div className="space-y-3 mb-4">
                {xaiFeatures.map((f,i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-body" style={{ color:"rgba(255,255,255,0.6)" }}>{f.label}</span>
                      <span className="text-xs font-mono" style={{ color:"#22d3ee" }}>{(f.imp*100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.06)" }}>
                      <motion.div initial={{ width:0 }} animate={{ width:`${Math.min(100,f.imp*200)}%` }} transition={{ duration:0.8,delay:i*0.1 }}
                        className="h-full rounded-full" style={{ background:f.imp>0.25?"linear-gradient(90deg,#f97316,#ef4444)":"#22d3ee" }} />
                    </div>
                    <p className="text-xs font-body mt-0.5" style={{ color:"rgba(255,255,255,0.3)" }}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Alert log */}
      <motion.div className="card p-6" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.35 }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-display font-semibold text-white">Alert Log ({alerts.length})</p>
          {alerts.length > 0 && (
            <button onClick={clearAlerts} className="text-xs font-display" style={{ color:"rgba(255,255,255,0.3)" }}>CLEAR ALL</button>
          )}
        </div>
        {alerts.length === 0 ? (
          <div className="py-8 text-center text-xs font-display" style={{ color:"rgba(255,255,255,0.2)" }}>NO ACTIVE ALERTS</div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-auto">
            {alerts.slice(0,20).map((a,i) => {
              const c = SEV[a.severity] ?? "#f59e0b";
              return (
                <div key={a.id??i} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background:`${c}08`,borderLeft:`2px solid ${c}` }}>
                  <AlertTriangle style={{ width:12,height:12,marginTop:1,flexShrink:0,color:c }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-display" style={{ color:c }}>{a.severity}</span>
                      <span className="text-xs font-mono" style={{ color:"rgba(255,255,255,0.25)" }}>
                        {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : ""}
                      </span>
                    </div>
                    <p className="text-xs font-body truncate" style={{ color:"rgba(255,255,255,0.6)" }}>{a.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
