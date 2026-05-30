"use client";
import { memo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface CurvePoint { time_min: number; current_a: number; soc_pct: number; power_kw: number; }
interface Props { standardCurve: CurvePoint[]; optimizedCurve: CurvePoint[]; height?: number; }

const ChargingCurveChart = memo(function ChargingCurveChart({ standardCurve, optimizedCurve, height = 220 }: Props) {
  const maxLen = Math.max(standardCurve.length, optimizedCurve.length);
  const data = Array.from({ length: maxLen }, (_, i) => ({
    time: standardCurve[i]?.time_min ?? optimizedCurve[i]?.time_min ?? i,
    standard: standardCurve[i]?.current_a,
    optimized: optimizedCurve[i]?.current_a,
  }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
            label={{ value: "Time (min)", fill: "rgba(255,255,255,0.3)", fontSize: 10, position: "insideBottom", offset: -2 }} />
          <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} width={36} />
          <Tooltip
            contentStyle={{ background: "#1a1635", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "rgba(255,255,255,0.5)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
          <Line type="monotone" dataKey="standard" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5}
            strokeDasharray="5 3" dot={false} name="Standard" />
          <Line type="monotone" dataKey="optimized" stroke="#a855f7" strokeWidth={2.5}
            dot={false} name="AI Optimized" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export default ChargingCurveChart;
