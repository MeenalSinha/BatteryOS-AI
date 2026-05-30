"use client";
import { memo } from "react";

interface Props { cellVoltages: number[]; height?: number; }

const CellVoltageBar = memo(function CellVoltageBar({ cellVoltages, height = 120 }: Props) {
  const cells = cellVoltages.slice(0, 96);
  const mean  = cells.length ? cells.reduce((a, b) => a + b, 0) / cells.length : 3.6;
  const minV  = Math.min(...cells);
  const maxV  = Math.max(...cells);
  const range = maxV - minV || 0.001;

  return (
    <div style={{ height }} className="relative w-full">
      <svg width="100%" height={height} viewBox={`0 0 ${cells.length * 4} ${height}`} preserveAspectRatio="none">
        {cells.map((v, i) => {
          const deviation = Math.abs(v - mean);
          const ratio = (v - minV) / range;
          const barH = ratio * (height - 20) + 4;
          const color = deviation > 0.05 ? "#ef4444"
            : deviation > 0.025 ? "#f59e0b"
            : "#a855f7";
          return (
            <rect key={i} x={i * 4} y={height - 10 - barH} width={3} height={barH}
              fill={color} opacity={0.8} rx={1.5} />
          );
        })}
        <line x1={0} y1={height / 2} x2={cells.length * 4} y2={height / 2}
          stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="4 3" />
      </svg>
      <div className="absolute top-0 right-0 text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
        Δ <span className={Math.abs(maxV - minV) > 0.05 ? "" : ""}
          style={{ color: Math.abs(maxV - minV) > 0.05 ? "#ef4444" : "#a855f7" }}>
          {(maxV - minV).toFixed(3)}V
        </span>
      </div>
    </div>
  );
});

export default CellVoltageBar;
