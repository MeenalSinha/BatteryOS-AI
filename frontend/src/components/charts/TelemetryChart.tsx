"use client";
import { memo, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useBatteryStore } from "@/store/batteryStore";

type MetricKey = "temperature_avg" | "state_of_charge" | "state_of_health" | "anomaly_score" | "thermal_risk_score";

const METRIC_CONFIG: Record<MetricKey, { label: string; color: string; domain: [number, number] }> = {
  temperature_avg:    { label: "Temperature (°C)", color: "#f59e0b", domain: [0, 100] },
  state_of_charge:    { label: "SoC (%)",          color: "#a855f7", domain: [0, 100] },
  state_of_health:    { label: "SoH (%)",          color: "#22d3ee", domain: [60, 100] },
  anomaly_score:      { label: "Anomaly Score",    color: "#f97316", domain: [0, 1] },
  thermal_risk_score: { label: "Thermal Risk",     color: "#ef4444", domain: [0, 1] },
};

const TelemetryChart = memo(function TelemetryChart({
  metric, height = 180
}: { metric: MetricKey; height?: number }) {
  const { telemetryHistory } = useBatteryStore();
  const config = METRIC_CONFIG[metric];

  const data = useMemo(() =>
    telemetryHistory.slice(-40).map((t: any, i: number) => ({
      i,
      value: Number(t[metric]?.toFixed?.(4) ?? 0),
      time: new Date(t.timestamp).toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    })),
    [telemetryHistory, metric]
  );

  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id={`grad_${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={config.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={config.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} interval="preserveStartEnd" />
          <YAxis domain={config.domain} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} width={36} />
          <Tooltip
            contentStyle={{ background: "#1a1635", border: `1px solid ${config.color}40`, borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "rgba(255,255,255,0.4)" }}
            itemStyle={{ color: config.color }}
          />
          <Area type="monotone" dataKey="value" name={config.label}
            stroke={config.color} strokeWidth={2} fill={`url(#grad_${metric})`}
            dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

export default TelemetryChart;
