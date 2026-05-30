"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  icon?: ReactNode;
  accent?: string;   // hex color
  glow?: boolean;
  className?: string;
}

const KPICard = memo(function KPICard({
  label, value, unit, sub, icon,
  accent = "#a855f7", glow = false, className = "",
}: KPICardProps) {
  const display = typeof value === "number" && !isNaN(value)
    ? value % 1 === 0 ? value.toString() : value.toFixed(1)
    : String(value ?? "--");

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={`card p-5 flex flex-col gap-3 ${className}`}
      style={glow ? { boxShadow: `0 0 30px ${accent}28, 0 0 1px ${accent}60` } : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-body uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em" }}>
          {label}
        </p>
        {icon && (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `${accent}22`, color: accent }}>
            <div style={{ width: 16, height: 16 }}>{icon}</div>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-end gap-1.5">
        <span className="font-display font-bold leading-none"
          style={{ fontSize: "2rem", color: glow ? accent : "white",
            textShadow: glow ? `0 0 24px ${accent}80` : undefined }}>
          {display}
        </span>
        {unit && (
          <span className="text-sm mb-0.5 font-body"
            style={{ color: "rgba(255,255,255,0.45)" }}>
            {unit}
          </span>
        )}
      </div>

      {/* Sub label */}
      {sub && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: accent }} />
          <span className="text-xs font-body" style={{ color: "rgba(255,255,255,0.5)" }}>{sub}</span>
        </div>
      )}

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-6 right-6 h-px opacity-30"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
    </motion.div>
  );
});

export default KPICard;
