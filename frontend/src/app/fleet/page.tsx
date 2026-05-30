"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Users, AlertTriangle, TrendingDown, Activity, RefreshCw, GitCompare } from "lucide-react";
import NextLink from "next/link";
import KPICard from "@/components/ui/KPICard";
import { fleetApi } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";

function CardHeader({ icon, title, color = "#a855f7", badge }: any) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:`${color}20`,color }}>{icon}</div>
        <h3 className="font-display font-semibold text-sm text-white">{title}</h3>
      </div>
      {badge && <span className="pill text-xs" style={{ background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.45)",borderColor:"rgba(255,255,255,0.1)",fontSize:11 }}>{badge}</span>}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl ${className}`} style={{ background:"rgba(255,255,255,0.05)" }} />;
}

export default function FleetPage() {
  const [fleet, setFleet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [numVehicles, setNumVehicles] = useState(12);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fleetApi.getDashboard("FLEET-001", numVehicles);
      setFleet(res.data);
    } catch {}
    setLoading(false);
  }, [numVehicles]);

  useEffect(() => { load(); }, [load]);

  const s = fleet?.summary;
  const rd = fleet?.risk_distribution;
  const pieData = rd ? [
    { name:"Low Risk",    value:rd.low,    color:"#a855f7" },
    { name:"Med Risk",    value:rd.medium, color:"#f59e0b" },
    { name:"High Risk",   value:rd.high,   color:"#ef4444" },
  ].filter(d=>d.value>0) : [];

  const sohBars = fleet?.health_leaderboard?.map((v:any) => ({
    id: v.vehicle_id?.slice(-4), soh: v.soh ?? v.state_of_health,
  })) ?? [];

  const chartStyle = { background:"#1a1635", border:"1px solid rgba(168,85,247,0.25)", borderRadius:12, fontSize:12 };

  return (
    <div className="p-6 space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <p className="text-xs font-display uppercase tracking-widest" style={{ color:"rgba(255,255,255,0.35)" }}>Fleet Size</p>
          <input type="range" min={4} max={30} value={numVehicles} onChange={e=>setNumVehicles(Number(e.target.value))}
            className="w-32" style={{ accentColor:"#a855f7" }} />
          <span className="pill text-xs" style={{ background:"rgba(168,85,247,0.15)",color:"#c084fc",borderColor:"rgba(168,85,247,0.3)",fontSize:11 }}>
            {numVehicles} vehicles
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NextLink href="/fleet/compare">
            <button className="pill flex items-center gap-1.5 text-xs"
              style={{ background:"rgba(34,211,238,0.1)",color:"#22d3ee",borderColor:"rgba(34,211,238,0.3)" }}>
              <GitCompare style={{ width:12,height:12 }} />Compare
            </button>
          </NextLink>
          <button onClick={load} disabled={loading}
            className="pill flex items-center gap-1.5 text-xs"
            style={{ background:"rgba(168,85,247,0.1)",color:"#c084fc",borderColor:"rgba(168,85,247,0.25)" }}>
            <RefreshCw style={{ width:12,height:12 }} className={loading ? "animate-spin" : ""} />Refresh
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Avg Fleet SoH"    value={loading ? "--" : s?.avg_soh ?? "--"} unit="%"
          icon={<Activity style={{ width:14,height:14 }} />} accent="#a855f7" glow sub={`Min: ${s?.min_soh ?? "--"}%`} />
        <KPICard label="Critical Vehicles" value={loading ? "--" : s?.critical_count ?? "--"}
          icon={<AlertTriangle style={{ width:14,height:14 }} />}
          accent={s?.critical_count > 2 ? "#ef4444" : "#f59e0b"} sub="Need attention" />
        <KPICard label="Healthy Units"     value={loading ? "--" : s?.healthy_count ?? "--"}
          icon={<Users style={{ width:14,height:14 }} />} accent="#a855f7" sub="SoH ≥ 85%" />
        <KPICard label="Degraded Units"    value={loading ? "--" : s?.degraded_count ?? "--"}
          icon={<TrendingDown style={{ width:14,height:14 }} />} accent="#f59e0b" sub="SoH < 75%" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Risk pie */}
        <motion.div className="card p-6" initial={{ opacity:0 }} animate={{ opacity:1 }}>
          <CardHeader icon={<Activity style={{ width:16,height:16 }} />} title="Risk Distribution" color="#a855f7" badge={fleet ? `${fleet.total_vehicles} vehicles` : "--"} />
          {loading ? <Skeleton className="h-52" /> : pieData.length > 0 ? (
            <div style={{ height:200 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={82} innerRadius={40} labelLine={false}
                    label={({ name,percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                    {pieData.map((entry,i) => <Cell key={i} fill={entry.color} opacity={0.85} />)}
                  </Pie>
                  <Tooltip contentStyle={chartStyle} itemStyle={{ color:"rgba(255,255,255,0.7)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-xs font-mono" style={{ color:"rgba(255,255,255,0.2)" }}>NO DATA</div>
          )}
        </motion.div>

        {/* SoH leaderboard */}
        <motion.div className="card p-6" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}>
          <CardHeader icon={<Users style={{ width:16,height:16 }} />} title="Health Leaderboard" color="#22d3ee" />
          {loading ? <Skeleton className="h-52" /> : sohBars.length > 0 ? (
            <div style={{ height:200 }}>
              <ResponsiveContainer>
                <BarChart data={sohBars} margin={{ top:4,right:4,bottom:20,left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="id" tick={{ fontSize:9,fill:"rgba(255,255,255,0.35)" }} angle={-20} textAnchor="end" />
                  <YAxis domain={[60,100]} tick={{ fontSize:10,fill:"rgba(255,255,255,0.35)" }} width={32} />
                  <Tooltip contentStyle={chartStyle} itemStyle={{ color:"rgba(255,255,255,0.7)" }} />
                  <Bar dataKey="soh" name="SoH %" radius={[6,6,0,0]}>
                    {sohBars.map((_:any,i:number) => (
                      <Cell key={i} fill={sohBars[i]?.soh>=85?"#a855f7":sohBars[i]?.soh>=75?"#f59e0b":"#ef4444"} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-xs font-mono" style={{ color:"rgba(255,255,255,0.2)" }}>NO DATA</div>
          )}
        </motion.div>
      </div>

      {/* Critical vehicles */}
      {fleet?.critical_vehicles?.length > 0 && (
        <motion.div className="card p-6" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}>
          <CardHeader icon={<AlertTriangle style={{ width:16,height:16 }} />} title="Critical Vehicles" color="#ef4444" />
          <div className="space-y-2">
            {fleet.critical_vehicles.map((v:any) => {
              const soh = v.soh ?? v.state_of_health ?? 0;
              return (
                <div key={v.vehicle_id} className="flex items-center gap-4 p-3.5 rounded-2xl"
                  style={{ background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)" }}>
                  <span className="font-mono text-sm text-white w-20">{v.vehicle_id}</span>
                  <div className="flex-1 grid grid-cols-3 gap-4 text-xs font-mono">
                    <span style={{ color:"rgba(255,255,255,0.5)" }}>SoH <span style={{ color:"#ef4444",fontWeight:700 }}>{soh?.toFixed(1)}%</span></span>
                    <span style={{ color:"rgba(255,255,255,0.5)" }}>Anomaly <span style={{ color:"#f97316",fontWeight:700 }}>{(v.anomaly_score*100).toFixed(0)}%</span></span>
                    <span style={{ color:"rgba(255,255,255,0.5)" }}>Thermal <span style={{ color:"#ef4444",fontWeight:700 }}>{((v.thermal_risk??0)*100).toFixed(0)}%</span></span>
                  </div>
                  <span className="pill text-xs" style={{ background:"rgba(239,68,68,0.15)",color:"#ef4444",borderColor:"rgba(239,68,68,0.3)",fontSize:10,whiteSpace:"nowrap" }}>
                    {v.recommended_action?.split(" ").slice(0,2).join(" ") ?? "Inspect"}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Thermal hotspots */}
      {fleet?.thermal_hotspots?.length > 0 && (
        <motion.div className="card p-6" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.3 }}>
          <CardHeader icon={<TrendingDown style={{ width:16,height:16 }} />} title="Thermal Hotspots — Top 3" color="#f59e0b" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {fleet.thermal_hotspots.map((h:any, i:number) => {
              const c = h.temperature > 50 ? "#ef4444" : "#f59e0b";
              return (
                <div key={h.vehicle_id} className="rounded-2xl p-4" style={{ background:`${c}08`,border:`1px solid ${c}20` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-display" style={{ color:"rgba(255,255,255,0.4)" }}>RANK #{i+1}</span>
                    <span className="font-display font-bold" style={{ color:c }}>{h.temperature}°C</span>
                  </div>
                  <p className="text-sm font-mono text-white mb-2">{h.vehicle_id}</p>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width:`${Math.min(100,(h.temperature/80)*100)}%`,background:`linear-gradient(90deg,${c}80,${c})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
