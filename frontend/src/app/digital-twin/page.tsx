"use client";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Box, Play, Pause, RotateCcw, Thermometer, Activity, Zap, AlertTriangle, FastForward, MessageSquare } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import { digitalTwinApi } from "@/lib/api";
import Battery3D from "@/components/three-d/Battery3D";
import ThermalHeatmap from "@/components/charts/ThermalHeatmap";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts";

const SCENARIOS = [
  { id:"normal",         label:"Normal Drive",         color:"#a855f7", desc:"Highway driving 50A discharge" },
  { id:"fast_charge",    label:"Ultra Fast Charge",    color:"#f59e0b", desc:"DC fast charging at 180A" },
  { id:"aggressive",     label:"Aggressive Drive",     color:"#f97316", desc:"Full acceleration 150A" },
  { id:"cold_weather",   label:"Cold Weather",         color:"#22d3ee", desc:"Operation at −10°C ambient" },
  { id:"thermal_stress", label:"Thermal Stress",       color:"#ef4444", desc:"180A at 50°C ambient" },
  { id:"cell_failure",   label:"Cell Failure",         color:"#9333ea", desc:"Single cell failure injection" },
];

export default function DigitalTwinPage() {
  const [selected, setSelected] = useState("normal");
  const [steps, setSteps]       = useState(60);
  const [result, setResult]     = useState<any>(null);
  const [running, setRunning]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  
  const [scrubIndex, setScrubIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    let interval: any;
    if (autoPlay && result?.timeline) {
      interval = setInterval(() => {
        setScrubIndex(prev => {
          if (prev >= result.timeline.length - 1) {
            setAutoPlay(false);
            return prev;
          }
          return prev + 1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [autoPlay, result]);

  const run = async () => {
    setRunning(true); setResult(null); setError(null);
    setAutoPlay(false); setScrubIndex(0);
    try {
      await digitalTwinApi.create("DEMO-001");
      const res = await digitalTwinApi.simulate("DEMO-001", selected, steps);
      setResult(res.data);
      setAutoPlay(true);
    } catch (e: any) {
      setError(e?.message ?? "Simulation failed — start backend first");
    }
    setRunning(false);
  };

  const sc = SCENARIOS.find(s => s.id === selected)!;
  const tl = result?.timeline ?? [];
  const s  = result?.summary;
  const currentFrame = tl[scrubIndex] || tl[0];

  const chartStyle = { background:"#1a1635", border:"1px solid rgba(168,85,247,0.25)", borderRadius:12, fontSize:12 };

  return (
    <div className="p-6 space-y-5">
      {/* Scenario picker */}
      <motion.div className="card p-6" initial={{ opacity:0 }} animate={{ opacity:1 }}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:"#a855f720",color:"#a855f7" }}>
            <Box style={{ width:16,height:16 }} />
          </div>
          <h3 className="font-display font-semibold text-sm text-white">Simulation Scenario</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => setSelected(s.id)}
              className="p-3.5 rounded-2xl text-left transition-all"
              style={{
                background: selected === s.id ? `${s.color}15` : "rgba(255,255,255,0.03)",
                border: `1px solid ${selected === s.id ? `${s.color}50` : "rgba(255,255,255,0.08)"}`,
              }}>
              <p className="text-xs font-display font-semibold mb-1" style={{ color: selected === s.id ? s.color : "rgba(255,255,255,0.55)" }}>{s.label}</p>
              <p className="text-xs font-body" style={{ color:"rgba(255,255,255,0.35)" }}>{s.desc}</p>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex-1 min-w-48">
            <div className="flex justify-between mb-1.5">
              <p className="text-xs font-body" style={{ color:"rgba(255,255,255,0.45)" }}>Simulation Duration</p>
              <span className="text-xs font-mono" style={{ color:"#a855f7" }}>{steps} min</span>
            </div>
            <input type="range" min={20} max={240} step={10} value={steps}
              onChange={e => setSteps(Number(e.target.value))}
              className="w-full" style={{ accentColor:"#a855f7" }} />
          </div>
          <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
            onClick={run} disabled={running}
            className="flex items-center gap-2 px-7 py-3 rounded-2xl font-display text-sm font-semibold transition-all"
            style={{ background: running ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg,#7c3aed,${sc.color})`,
              color: running ? "rgba(255,255,255,0.3)" : "white",
              boxShadow: running ? "none" : `0 0 30px ${sc.color}40` }}>
            {running
              ? <><RotateCcw style={{ width:15,height:15 }} className="animate-spin" />Simulating...</>
              : <><Play style={{ width:15,height:15 }} />Run Simulation</>
            }
          </motion.button>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl p-4 flex items-center gap-3 text-sm font-display"
          style={{ background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#ef4444" }}>
          <AlertTriangle style={{ width:16,height:16,flexShrink:0 }} />{error}
        </div>
      )}

      {/* KPIs */}
      {s && (
        <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Peak Temperature" value={s.max_temperature?.toFixed(1)} unit="°C"
            icon={<Thermometer style={{ width:14,height:14 }} />}
            accent={s.max_temperature > 60 ? "#ef4444" : s.max_temperature > 45 ? "#f59e0b" : "#22d3ee"}
            glow={s.max_temperature > 60} />
          <KPICard label="Min SoH Reached" value={s.min_soh_reached?.toFixed(1)} unit="%"
            icon={<Activity style={{ width:14,height:14 }} />}
            accent={s.min_soh_reached < 80 ? "#ef4444" : "#a855f7"} />
          <KPICard label="Max Cell Delta" value={(s.max_cell_delta * 1000).toFixed(1)} unit="mV"
            icon={<Zap style={{ width:14,height:14 }} />}
            accent={s.max_cell_delta > 0.05 ? "#ef4444" : "#22d3ee"} />
          <KPICard label="Thermal Events" value={s.thermal_events}
            icon={<Box style={{ width:14,height:14 }} />}
            accent={s.thermal_events > 5 ? "#f97316" : "#a855f7"} />
        </motion.div>
      )}

      {/* Visual Replay */}
      {tl.length > 0 && currentFrame && (
        <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }} className="card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-white flex items-center gap-2">
              <FastForward style={{ width:18, height:18, color:"#a855f7" }} />
              Interactive Simulation Replay
            </h3>
            <div className="flex items-center gap-4">
              <span className="text-sm font-mono text-white/50">
                Time: <span style={{ color:"white" }}>{currentFrame.time_min.toFixed(1)} min</span>
              </span>
              <button onClick={() => setAutoPlay(!autoPlay)}
                className="pill flex items-center gap-1.5"
                style={{ background:"rgba(168,85,247,0.1)", color:"#a855f7", borderColor:"rgba(168,85,247,0.2)" }}>
                {autoPlay ? <Pause style={{ width:14,height:14 }} /> : <Play style={{ width:14,height:14 }} />}
                {autoPlay ? "Pause" : "Play"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <input type="range" min={0} max={tl.length - 1} value={scrubIndex}
              onChange={e => { setScrubIndex(Number(e.target.value)); setAutoPlay(false); }}
              className="w-full" style={{ accentColor: "#a855f7" }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
            <div>
              <p className="text-xs font-display font-semibold text-white/50 mb-3">3D DIGITAL TWIN</p>
              <div className="flex justify-center bg-black/20 rounded-2xl p-4">
                <Battery3D width={320} height={180} 
                  scenarioOverride={selected}
                  telemetryData={{
                    state_of_health: currentFrame.avg_soh,
                    state_of_charge: 100 - (currentFrame.time_min / Math.max(1, steps)) * 80,
                    temperature_avg: currentFrame.avg_temperature,
                    thermal_risk_score: currentFrame.max_temperature > 45 ? Math.min(1, (currentFrame.max_temperature - 45) / 20) : 0.05,
                    cell_voltages: currentFrame.cell_voltages,
                  }} 
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-display font-semibold text-white/50 mb-3">CELL THERMAL HEATMAP</p>
              <div className="bg-black/20 rounded-2xl p-4 flex items-center justify-center h-full">
                <ThermalHeatmap cellTemperatures={currentFrame.cell_temperatures} width={340} height={160} />
              </div>
            </div>
          </div>
          
          {s.thermal_events > 0 && (
            <div className="mt-4 p-4 rounded-xl flex items-center justify-between"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="flex items-center gap-3">
                <AlertTriangle style={{ width:20, height:20, color:"#ef4444" }} />
                <div>
                  <p className="text-sm font-display font-semibold text-white">Critical Thermal Stress Detected</p>
                  <p className="text-xs font-body text-white/60">The simulation resulted in {s.thermal_events} thermal events exceeding safe limits.</p>
                </div>
              </div>
              <button className="side-btn px-4 py-2 rounded-xl text-xs flex items-center gap-2"
                style={{ background: "#ef4444", color: "white", borderColor: "#ef4444" }}>
                <MessageSquare style={{ width:14, height:14 }} />
                Ask AI Mitigation
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Charts */}
      {tl.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <motion.div className="card p-6" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }}>
            <p className="text-sm font-display font-semibold text-white mb-4">Temperature Timeline</p>
            <div style={{ height:190 }}>
              <ResponsiveContainer>
                <LineChart data={tl} margin={{ top:4,right:4,bottom:16,left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time_min" tick={{ fontSize:10,fill:"rgba(255,255,255,0.3)" }}
                    label={{ value:"Time (min)",fill:"rgba(255,255,255,0.3)",fontSize:10,position:"insideBottom",offset:-4 }} />
                  <YAxis tick={{ fontSize:10,fill:"rgba(255,255,255,0.3)" }} width={36} />
                  <Tooltip contentStyle={chartStyle} labelStyle={{ color:"rgba(255,255,255,0.4)" }} />
                  <ReferenceLine y={45} stroke="#f59e0b" strokeDasharray="4 2" opacity={0.5} label={{ value:"45°C",fill:"#f59e0b",fontSize:9 }} />
                  <Legend wrapperStyle={{ fontSize:11,color:"rgba(255,255,255,0.4)" }} />
                  <Line type="monotone" dataKey="avg_temperature" stroke="#f59e0b" strokeWidth={2} dot={false} name="Avg Temp °C" />
                  <Line type="monotone" dataKey="max_temperature" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Max Temp °C" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div className="card p-6" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.1 }}>
            <p className="text-sm font-display font-semibold text-white mb-4">State of Health Timeline</p>
            <div style={{ height:190 }}>
              <ResponsiveContainer>
                <LineChart data={tl} margin={{ top:4,right:4,bottom:16,left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time_min" tick={{ fontSize:10,fill:"rgba(255,255,255,0.3)" }} />
                  <YAxis domain={[50,101]} tick={{ fontSize:10,fill:"rgba(255,255,255,0.3)" }} width={36} />
                  <Tooltip contentStyle={chartStyle} labelStyle={{ color:"rgba(255,255,255,0.4)" }} />
                  <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="4 2" opacity={0.5} label={{ value:"EoL 80%",fill:"#f59e0b",fontSize:9 }} />
                  <Legend wrapperStyle={{ fontSize:11,color:"rgba(255,255,255,0.4)" }} />
                  <Line type="monotone" dataKey="avg_soh" stroke="#a855f7" strokeWidth={2} dot={false} name="Avg SoH %" />
                  <Line type="monotone" dataKey="min_soh" stroke="#ec4899" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Min SoH %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div className="card p-6 lg:col-span-2" initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.2 }}>
            <p className="text-sm font-display font-semibold text-white mb-4">Cell Voltage Imbalance</p>
            <div style={{ height:130 }}>
              <ResponsiveContainer>
                <LineChart data={tl} margin={{ top:4,right:4,bottom:4,left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time_min" tick={{ fontSize:10,fill:"rgba(255,255,255,0.3)" }} />
                  <YAxis tickFormatter={(v:any) => `${(Number(v)*1000).toFixed(0)}mV`} tick={{ fontSize:10,fill:"rgba(255,255,255,0.3)" }} width={50} />
                  <Tooltip contentStyle={chartStyle} formatter={(v:any) => [`${(Number(v)*1000).toFixed(1)}mV`,"Cell Delta"]} />
                  <ReferenceLine y={0.05} stroke="#f59e0b" strokeDasharray="3 2" opacity={0.5} label={{ value:"50mV",fill:"#f59e0b",fontSize:9 }} />
                  <Line type="monotone" dataKey="cell_voltage_delta" stroke={sc.color} strokeWidth={2} dot={false} name="Cell Delta V" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      )}

      {!result && !running && (
        <motion.div className="card p-16 text-center" initial={{ opacity:0 }} animate={{ opacity:1 }}>
          <Box className="mx-auto mb-4" style={{ width:48,height:48,color:"rgba(255,255,255,0.15)" }} />
          <p className="font-display text-sm" style={{ color:"rgba(255,255,255,0.3)" }}>SELECT A SCENARIO AND RUN SIMULATION</p>
          <p className="text-xs font-body mt-2" style={{ color:"rgba(255,255,255,0.2)" }}>Physics-based digital twin — exact analytical thermal model</p>
        </motion.div>
      )}
    </div>
  );
}
