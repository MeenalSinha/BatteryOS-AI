"use client";
import { memo } from "react";

interface Props { cellTemperatures: number[]; width?: number; height?: number; }

function tempToColor(temp: number, min: number, max: number): string {
  const ratio = Math.max(0, Math.min(1, (temp - min) / (max - min || 1)));
  // Cool (blue-cyan) → warm (purple) → hot (red)
  if (ratio < 0.33) {
    const t = ratio / 0.33;
    return `rgb(${Math.round(34 + t * 90)}, ${Math.round(211 - t * 60)}, ${Math.round(238 - t * 80)})`;
  } else if (ratio < 0.66) {
    const t = (ratio - 0.33) / 0.33;
    return `rgb(${Math.round(124 + t * 100)}, ${Math.round(151 - t * 100)}, ${Math.round(158 + t * 20)})`;
  } else {
    const t = (ratio - 0.66) / 0.34;
    return `rgb(${Math.round(224 + t * 15)}, ${Math.round(51 - t * 51)}, ${Math.round(178 - t * 140)})`;
  }
}

const ThermalHeatmap = memo(function ThermalHeatmap({ cellTemperatures, width = 400, height = 180 }: Props) {
  const cells  = cellTemperatures.slice(0, 96);
  const minT   = Math.min(...cells);
  const maxT   = Math.max(...cells);
  const cols   = 16;
  const rows   = Math.ceil(cells.length / cols);
  const cellW  = width / cols;
  const cellH  = height / rows;

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ width, height }}>
      <svg width={width} height={height}>
        {cells.map((temp, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          return (
            <rect key={i}
              x={col * cellW + 1} y={row * cellH + 1}
              width={cellW - 2} height={cellH - 2}
              fill={tempToColor(temp, minT, maxT)}
              rx={3} opacity={0.88} />
          );
        })}
      </svg>
      {/* Legend */}
      <div className="absolute bottom-1 right-2 flex items-center gap-1.5">
        <span className="text-xs font-mono" style={{ color:"rgba(255,255,255,0.4)", fontSize:9 }}>{minT.toFixed(0)}°</span>
        <div className="w-14 h-1.5 rounded-full" style={{
          background:"linear-gradient(90deg,#22d3ee,#a855f7,#ef4444)"
        }} />
        <span className="text-xs font-mono" style={{ color:"rgba(255,255,255,0.4)", fontSize:9 }}>{maxT.toFixed(0)}°</span>
      </div>
    </div>
  );
});

export default ThermalHeatmap;
