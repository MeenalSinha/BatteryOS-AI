"use client";
import { memo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

interface Point { month: number; soh: number; label: string; }
interface Props { trajectory: Point[]; eolThreshold?: number; height?: number; }

const DegradationChart = memo(function DegradationChart({ trajectory, eolThreshold = 80, height = 220 }: Props) {
  const data = trajectory.map(p => ({ month: p.label, soh: p.soh, eol: eolThreshold }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="sohLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#a855f7" />
              <stop offset="60%"  stopColor="#ec4899" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} interval={3} />
          <YAxis domain={[60, 100]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} width={36} />
          <Tooltip
            contentStyle={{ background: "#1a1635", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 12, fontSize: 12 }}
            itemStyle={{ color: "#c084fc" }}
            labelStyle={{ color: "rgba(255,255,255,0.5)" }}
          />
          <ReferenceLine y={eolThreshold} stroke="#ef4444" strokeDasharray="6 3" opacity={0.6}
            label={{ value: "End of Life", fill: "#ef4444", fontSize: 10, position: "insideRight" }} />
          <Line type="monotone" dataKey="soh" stroke="url(#sohLineGrad)" strokeWidth={2.5}
            dot={false} name="Predicted SoH (%)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export default DegradationChart;
