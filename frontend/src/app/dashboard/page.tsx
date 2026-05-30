"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Zap, Thermometer, Activity, AlertTriangle,
  Battery, TrendingDown, Shield, ChevronDown,
  BarChart2, Users
} from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import ScenarioSelector from "@/components/ui/ScenarioSelector";
import ArcGauge from "@/components/charts/ArcGauge";
import ThermalHeatmap from "@/components/charts/ThermalHeatmap";
import Battery3D from "@/components/three-d/Battery3D";
import { useLiveTelemetry } from "@/hooks/useTelemetry";
import { useBatteryStore } from "@/store/batteryStore";
import { batteryApi, fleetApi } from "@/lib/api";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis,
  Tooltip, CartesianGrid
} from "recharts";

function CardHeader({ icon, title, badge, badgeColor = "#a855f7" }: {
  icon: React.ReactNode; title: string; badge?: string; badgeColor?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${badgeColor}20`, color: badgeColor }}>
          {icon}
        </div>
        <h3 className="font-display font-semibold text-sm text-white">{title}</h3>
      </div>
      {badge && (
        <button className="pill text-xs" style={{
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.5)",
          borderColor: "rgba(255,255,255,0.1)",
        }}>
          {badge} <ChevronDown style={{ width: 11, height: 11, display: "inline", marginLeft: 4 }} />
        </button>
      )}
    </div>
  );
}

function StatRow({ label, value, unit, color }: {
  label: string; value: any; unit?: string; color?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-display font-bold text-lg leading-none" style={{ color: color ?? "white" }}>
        {value ?? "--"}
        {unit && <span className="text-xs ml-0.5 font-body" style={{ opacity: 0.5 }}>{unit}</span>}
      </span>
      <span className="text-xs font-body" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
    </div>
  );
}

function StackedMonthBars({ data }: {
  data: { month: string; a: number; b: number; c: number }[];
}) {
  const maxTotal = Math.max(...data.map(d => d.a + d.b + d.c));
  return (
    <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
      {data.map((d, i) => {
        const total = d.a + d.b + d.c;
        const scale = (total / maxTotal) * 100;
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full flex flex-col items-center justify-end gap-0.5" style={{ height: 96 }}>
              <div className="w-2/3 rounded-md" style={{ height: `${(d.a / total) * scale * 0.96}%`, background: "#7c3aed", opacity: 0.85 }} />
              <div className="w-2/3 rounded-md" style={{ height: `${(d.b / total) * scale * 0.96}%`, background: "#f59e0b", opacity: 0.85 }} />
              <div className="w-2/3 rounded-md" style={{ height: `${(d.c / total) * scale * 0.96}%`, background: "#ec4899", opacity: 0.85 }} />
            </div>
            <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>{d.month}</span>
          </div>
        );
      })}
    </div>
  );
}

function FleetRow({ vehicle }: { vehicle: any }) {
  const soh = vehicle.state_of_health ?? 0;
  const color = soh >= 85 ? "#a855f7" : soh >= 75 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-3 py-3 px-1 border-b border-white/5 last:border-0">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.05)" }}>
        <Battery style={{ width: 14, height: 14, color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-display font-medium text-white truncate">{vehicle.vehicle_id}</p>
        <p className="text-xs font-body" style={{ color: "rgba(255,255,255,0.35)" }}>
          {vehicle.chemistry} · {vehicle.capacity_kwh}kWh
        </p>
      </div>
      <span className="text-xs font-mono hidden md:block text-center flex-1" style={{ color: "rgba(255,255,255,0.35)" }}>
        {vehicle.temperature_avg?.toFixed(1)}°C
      </span>
      <div className="flex-1 flex justify-end">
        <button className="pill text-xs flex-shrink-0"
          style={{ background: `${color}18`, color, borderColor: `${color}40`, fontSize: 11 }}>
          {soh.toFixed(0)}%
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { latestTelemetry, activeVehicleId, activeScenario, telemetryHistory } = useBatteryStore();
  useLiveTelemetry(activeVehicleId, activeScenario);
  const t = latestTelemetry;

  const [fleet, setFleet] = useState<any>(null);
  const [battery, setBattery] = useState<any>(null);

  useEffect(() => {
    fleetApi.getDashboard("FLEET-001", 6).then(r => setFleet(r.data)).catch(() => {});
  }, [activeScenario]);

  useEffect(() => {
    batteryApi.getHealth(activeVehicleId, activeScenario).then(r => setBattery(r.data)).catch(() => {});
  }, [activeVehicleId, activeScenario]);

  const soh = battery?.soh_prediction?.soh ?? t?.state_of_health ?? 90;
  const soc = t?.state_of_charge ?? 60;
  const temp = t?.temperature_avg ?? 25;
  const thermalRisk = t?.thermal_risk_score ?? 0;
  const anomaly = t?.anomaly_score ?? 0;

  const sparkData = telemetryHistory.slice(-30).map((f: any, i: number) => ({
    i,
    soc: Number((f.state_of_charge ?? 0).toFixed(1)),
    temp: Number((f.temperature_avg ?? 0).toFixed(1)),
    risk: Number(((f.thermal_risk_score ?? 0) * 100).toFixed(1)),
  }));

  // Build monthly distribution bars from fleet data (6 months of relative health distribution)
  const monthBars = (() => {
    const months = ["Jul","Aug","Sep","Oct","Nov","Dec"];
    if (!fleet?.vehicles) {
      return months.map((month, i) => ({ month, a: 38+i*2, b: 20+i, c: 42-i*2 }));
    }
    const vehicles = fleet.vehicles as any[];
    const healthy  = vehicles.filter((v: any) => (v.state_of_health ?? 0) >= 85).length;
    const moderate = vehicles.filter((v: any) => { const s = v.state_of_health ?? 0; return s >= 75 && s < 85; }).length;
    const critical = vehicles.filter((v: any) => (v.state_of_health ?? 0) < 75).length;
    const total = Math.max(1, healthy + moderate + critical);
    return months.map((month, i) => ({
      month,
      a: Math.max(5, Math.round((healthy / total) * 100) + (i % 3) * 2),
      b: Math.max(5, Math.round((moderate / total) * 100) + (i % 2) * 3),
      c: Math.max(5, Math.round((critical / total) * 100) + (i % 4) * 2),
    }));
  })();

  const fleetVehicles = fleet?.vehicles?.slice(0, 5) ?? [];

  return (
    <div className="p-6 space-y-5">
      {thermalRisk > 0.8 && <div className="screen-alert-overlay" />}
      <ScenarioSelector />

      {/* Row 1: Three main cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Battery status */}
        <motion.div className="card p-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <CardHeader icon={<Battery style={{ width: 16, height: 16 }} />}
            title="Battery Status" badge={activeVehicleId} badgeColor="#a855f7" />
          <div className="flex justify-center mb-3">
            <Battery3D width={280} height={155} />
          </div>
          <div className="flex justify-around pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <StatRow label="Full charge" value={`${Math.max(5, Math.round((100 - soc) * 0.28))} min`} />
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <StatRow label="Range" value={`${Math.round(soc * 4.2)} km`} />
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <StatRow label="Cost/kWh" value="$0.18" />
          </div>
        </motion.div>

        {/* Health gauge */}
        <motion.div className="card p-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}>
          <CardHeader icon={<Activity style={{ width: 16, height: 16 }} />}
            title="Battery Health" badge="Today" badgeColor="#a855f7" />
          <div className="flex justify-center items-center py-1">
            <ArcGauge value={soh} max={100} size={185} strokeWidth={16}
              color="#a855f7" label={`${soh.toFixed(0)}%`} sublabel="State of Health" showDots />
          </div>
          <div className="flex justify-around pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex flex-col items-center gap-1">
              <span className="font-display font-bold text-lg text-white">
                {soc.toFixed(0)}<span className="text-xs opacity-50 ml-0.5">%</span>
              </span>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: "#a855f7" }} />
                <span className="text-xs font-body" style={{ color: "rgba(255,255,255,0.4)" }}>Charge</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="font-display font-bold text-lg text-white">
                {(anomaly * 100).toFixed(0)}<span className="text-xs opacity-50 ml-0.5">%</span>
              </span>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: "#ec4899" }} />
                <span className="text-xs font-body" style={{ color: "rgba(255,255,255,0.4)" }}>Anomaly</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Thermal card */}
        <motion.div className={`card p-5 ${thermalRisk > 0.8 ? "glitch-effect" : ""}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}>
          <CardHeader icon={<Thermometer style={{ width: 16, height: 16 }} />}
            title="Thermal Intelligence" badgeColor="#ef4444" />
          {t?.cell_temperatures && t.cell_temperatures.length > 0 ? (
            <ThermalHeatmap cellTemperatures={t.cell_temperatures} width={310} height={138} />
          ) : (
            <div className="rounded-2xl flex items-center justify-center text-xs font-mono"
              style={{ height: 138, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.2)" }}>
              Awaiting telemetry...
            </div>
          )}
          <div className="flex justify-around mt-3 pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <StatRow label="Cell Temp" value={temp.toFixed(1)} unit="°C"
              color={temp > 50 ? "#ef4444" : temp > 38 ? "#f59e0b" : "#22d3ee"} />
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <StatRow label="Thermal Risk" value={`${(thermalRisk * 100).toFixed(0)}`} unit="%"
              color={thermalRisk > 0.6 ? "#ef4444" : thermalRisk > 0.3 ? "#f59e0b" : "#a855f7"} />
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <StatRow label="Gradient"
              value={t?.temperature_gradient?.toFixed(1) ?? "--"} unit="°C" />
          </div>
        </motion.div>
      </div>

      {/* Row 2: Stats + Fleet */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Analytics Main */}
        <motion.div className="card p-5 lg:col-span-3"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <CardHeader icon={<BarChart2 style={{ width: 16, height: 16 }} />}
            title="Fleet Health Distribution" badge="6 Months" badgeColor="#a855f7" />

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-6 mb-8">
            {(() => {
              const vehicles = fleet?.vehicles || [];
              const healthy = vehicles.filter((v: any) => (v.state_of_health ?? 0) >= 85).length;
              const moderate = vehicles.filter((v: any) => { const s = v.state_of_health ?? 0; return s >= 75 && s < 85; }).length;
              const critical = vehicles.filter((v: any) => (v.state_of_health ?? 0) < 75).length;
              const total = Math.max(1, healthy + moderate + critical);
              
              return [
                { label: "Healthy (SoH ≥85%)", pct: Math.round((healthy / total) * 100) + "%", color: "#7c3aed" },
                { label: "Moderate (SoH 75-85%)", pct: Math.round((moderate / total) * 100) + "%", color: "#f59e0b" },
                { label: "Critical (SoH <75%)", pct: Math.round((critical / total) * 100) + "%", color: "#ec4899" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
                  <span className="text-xs font-medium text-white/60">{item.label} <span style={{ color: item.color }}>{item.pct}</span></span>
                </div>
              ));
            })()}
          </div>

          <StackedMonthBars data={monthBars} />
        </motion.div>

        {/* Fleet Status List */}
        <motion.div className="card p-5 lg:col-span-2 flex flex-col"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <CardHeader icon={<Users style={{ width: 16, height: 16 }} />}
            title="Fleet Status"
            badge={fleet ? `${fleet.total_vehicles} vehicles` : "—"}
            badgeColor="#22d3ee" />

          <div className="flex px-1 pb-2 text-xs font-mono uppercase tracking-wider border-b border-white/5 mb-2"
            style={{ color: "rgba(255,255,255,0.28)" }}>
            <span className="flex-1 min-w-0 ml-11">Vehicle</span>
            <span className="flex-1 text-center hidden md:block">Temp</span>
            <span className="flex-1 text-right">Health</span>
          </div>

          <div className="flex-1 overflow-auto">
            {fleetVehicles.length > 0
              ? fleetVehicles.map((v: any) => <FleetRow key={v.vehicle_id} vehicle={v} />)
              : [...Array(4)].map((_, i) => (
                <div key={i} className="table-row py-3 px-1">
                  <div className="animate-pulse flex gap-3 items-center">
                    <div className="w-8 h-8 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 rounded w-20" style={{ background: "rgba(255,255,255,0.05)" }} />
                      <div className="h-2 rounded w-14" style={{ background: "rgba(255,255,255,0.03)" }} />
                    </div>
                  </div>
                </div>
              ))
            }
          </div>

          {fleet?.summary && (
            <div className="mt-2 pt-3 flex justify-between text-xs font-mono"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
              <span>Avg SoH: <span style={{ color: "#c084fc", fontWeight: 700 }}>{fleet.summary.avg_soh}%</span></span>
              <span>Critical: <span style={{ color: "#e040fb", fontWeight: 700 }}>{fleet.summary.critical_count}</span></span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Row 3: KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Pack Voltage"
          value={t?.voltage?.toFixed(0) ?? "--"} unit="V"
          icon={<Zap style={{ width: 14, height: 14 }} />}
          accent="#22d3ee" sub="Nominal 400V" />
        <KPICard label="Pack Current"
          value={t ? Math.abs(t.current).toFixed(0) : "--"} unit="A"
          icon={<Activity style={{ width: 14, height: 14 }} />}
          accent="#f59e0b"
          sub={t?.is_charging ? "Charging" : "Discharging"} />
        <KPICard label="Degradation"
          value={t ? (t.degradation_index * 100).toFixed(1) : "--"} unit="%"
          icon={<TrendingDown style={{ width: 14, height: 14 }} />}
          accent="#ec4899"
          sub={`${t?.cycle_count ?? "--"} cycles`} />
        <KPICard label="Thermal Risk"
          value={t ? (thermalRisk * 100).toFixed(0) : "--"} unit="%"
          icon={<Shield style={{ width: 14, height: 14 }} />}
          accent={thermalRisk > 0.6 ? "#ef4444" : thermalRisk > 0.3 ? "#f59e0b" : "#a855f7"}
          glow={thermalRisk > 0.6}
          sub={thermalRisk > 0.6 ? "CRITICAL" : thermalRisk > 0.3 ? "Elevated" : "Normal"} />
      </div>

      {/* Row 4: Live stream charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          { dataKey: "soc",  label: "State of Charge", unit: "%",  color: "#a855f7" },
          { dataKey: "temp", label: "Temperature",      unit: "°C", color: "#f59e0b" },
        ].map(({ dataKey, label, unit, color }) => (
          <motion.div key={dataKey} className="card p-5"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-display font-semibold text-white">{label} — Live</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full status-blink" style={{ background: color }} />
                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {sparkData.length > 0
                    ? `${sparkData[sparkData.length - 1][dataKey as "soc" | "temp"]}${unit}`
                    : "—"}
                </span>
              </div>
            </div>
            <div style={{ height: 100 }}>
              <ResponsiveContainer>
                <AreaChart data={sparkData} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`grad_${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="i" hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "#1a1635", border: `1px solid ${color}40`, borderRadius: 12, fontSize: 12 }}
                    itemStyle={{ color }}
                  />
                  <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2}
                    fill={`url(#grad_${dataKey})`} dot={false} isAnimationActive={false} name={label} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
