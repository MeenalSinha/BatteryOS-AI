"use client";
import { memo } from "react";

interface Props {
  value: number;      // 0-100
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  showDots?: boolean;
}

const ArcGauge = memo(function ArcGauge({
  value, max = 100, size = 180, strokeWidth = 14,
  color = "#a855f7", trackColor = "rgba(255,255,255,0.06)",
  label, sublabel, showDots = false,
}: Props) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // Arc from 225deg to 315deg (270deg sweep, like video)
  const startAngle = 225;
  const sweep = 270;
  const endAngle = startAngle + sweep;
  const pct = Math.min(1, Math.max(0, value / max));

  function polarToXY(angle: number) {
    const rad = (angle - 90) * (Math.PI / 180);
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function describeArc(from: number, to: number) {
    const s = polarToXY(from);
    const e = polarToXY(to);
    const large = to - from > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const trackPath = describeArc(startAngle, endAngle);
  const fillEnd = startAngle + pct * sweep;
  const fillPath = pct > 0 ? describeArc(startAngle, Math.min(fillEnd, endAngle - 0.01)) : "";

  const circumference = 2 * Math.PI * r;
  const dotAngles = showDots ? [0.2, 0.35, 0.5, 0.65].map(p => startAngle + p * sweep) : [];

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        {/* Track */}
        <path d={trackPath} fill="none" stroke={trackColor} strokeWidth={strokeWidth} strokeLinecap="round" />
        {/* Fill */}
        {fillPath && (
          <path d={fillPath} fill="none" stroke="url(#gaugeGrad)" strokeWidth={strokeWidth} strokeLinecap="round" />
        )}
        {/* Gradient */}
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={color === "#a855f7" ? "#ec4899" : color} />
          </linearGradient>
        </defs>
        {/* Dot markers */}
        {dotAngles.map((angle, i) => {
          const pos = polarToXY(angle);
          return (
            <circle key={i} cx={pos.x} cy={pos.y} r={strokeWidth / 2 + 1}
              fill={color} opacity={0.9} />
          );
        })}
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map(tick => {
          const a = startAngle + (tick / 100) * sweep;
          const inner = polarToXY(a);
          const outer = (() => {
            const rad = (a - 90) * (Math.PI / 180);
            return { x: cx + (r + strokeWidth * 0.7) * Math.cos(rad), y: cy + (r + strokeWidth * 0.7) * Math.sin(rad) };
          })();
          return null; // skip ticks for cleaner look
        })}
      </svg>
      {/* Center text */}
      <div className="relative text-center z-10">
        {label && (
          <div className="font-display font-bold leading-none" style={{ fontSize: size * 0.2, color: "white" }}>
            {label}
          </div>
        )}
        {sublabel && (
          <div className="text-xs mt-1 font-body" style={{ color: "rgba(255,255,255,0.45)", fontSize: size * 0.07 }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
});

export default ArcGauge;
