"use client";
import { useRef, useEffect } from "react";
import { useBatteryStore } from "@/store/batteryStore";

interface Props { 
  width?: number; 
  height?: number; 
  telemetryData?: any;
  scenarioOverride?: string;
}

const SCENARIO_COLORS: Record<string, string> = {
  healthy:           "#a855f7",
  degraded:          "#f59e0b",
  thermal_runaway:   "#ef4444",
  aggressive:        "#f97316",
  fast_charge_abuse: "#ec4899",
  normal:            "#a855f7",
  fast_charge:       "#f59e0b",
  cold_weather:      "#22d3ee",
  thermal_stress:    "#ef4444",
  cell_failure:      "#9333ea",
};

function hexRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r,g,b];
}

export default function Battery3D({ width = 280, height = 155, telemetryData, scenarioOverride }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const { latestTelemetry, activeScenario } = useBatteryStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const W = width, H = height;
    let frame = 0;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      const t         = telemetryData || latestTelemetry;
      const effectiveScenario = scenarioOverride || activeScenario;
      
      const soh       = t?.state_of_health ?? 90;
      const soc       = t?.state_of_charge ?? 60;
      const temp      = t?.temperature_avg ?? 25;
      const thermal   = t?.thermal_risk_score ?? 0;
      const cells     = t?.cell_voltages ?? [];
      const accent    = SCENARIO_COLORS[effectiveScenario] ?? "#a855f7";
      const [ar,ag,ab] = hexRgb(accent);
      const rgb       = `${ar},${ag},${ab}`;
      const pulse     = 0.65 + 0.35 * Math.sin(frame * 0.055);

      // ── Battery body ──────────────────────────────────
      const bx = W/2, by = H/2 - 12, bw = 160, bh = 72, depth = 18;

      // Top face
      const topG = ctx.createLinearGradient(bx-bw/2, by-bh/2-depth, bx+bw/2, by-bh/2);
      topG.addColorStop(0, `rgba(${rgb},0.22)`);
      topG.addColorStop(1, `rgba(${rgb},0.06)`);
      ctx.beginPath();
      ctx.moveTo(bx-bw/2, by-bh/2);
      ctx.lineTo(bx+bw/2, by-bh/2);
      ctx.lineTo(bx+bw/2+depth, by-bh/2-depth);
      ctx.lineTo(bx-bw/2+depth, by-bh/2-depth);
      ctx.closePath();
      ctx.fillStyle = topG; ctx.fill();
      ctx.strokeStyle = `rgba(${rgb},0.35)`; ctx.lineWidth = 1; ctx.stroke();

      // Right face
      const rG = ctx.createLinearGradient(bx+bw/2, by-bh/2, bx+bw/2+depth, by+bh/2-depth);
      rG.addColorStop(0, `rgba(${rgb},0.10)`);
      rG.addColorStop(1, `rgba(${rgb},0.03)`);
      ctx.beginPath();
      ctx.moveTo(bx+bw/2, by-bh/2); ctx.lineTo(bx+bw/2, by+bh/2);
      ctx.lineTo(bx+bw/2+depth, by+bh/2-depth); ctx.lineTo(bx+bw/2+depth, by-bh/2-depth);
      ctx.closePath();
      ctx.fillStyle = rG; ctx.fill();
      ctx.strokeStyle = `rgba(${rgb},0.25)`; ctx.stroke();

      // Front face
      const fG = ctx.createLinearGradient(bx-bw/2, by-bh/2, bx+bw/2, by+bh/2);
      fG.addColorStop(0, "rgba(26,22,53,0.96)");
      fG.addColorStop(1, "rgba(17,14,40,0.98)");
      ctx.beginPath();
      (ctx as any).roundRect?.(bx-bw/2, by-bh/2, bw, bh, 8) ??
        ctx.rect(bx-bw/2, by-bh/2, bw, bh);
      ctx.fillStyle = fG; ctx.fill();
      ctx.strokeStyle = `rgba(${rgb},${0.45 * pulse})`; ctx.lineWidth = 1.5; ctx.stroke();

      // ── SoC fill bar ──────────────────────────────────
      const socW = (soc/100) * (bw-20);
      const socC = soc < 20 ? "#ef4444" : soc < 40 ? "#f59e0b" : accent;
      const socG = ctx.createLinearGradient(bx-bw/2+10, 0, bx-bw/2+10+socW, 0);
      socG.addColorStop(0, socC+"cc"); socG.addColorStop(1, socC+"44");
      ctx.beginPath();
      (ctx as any).roundRect?.(bx-bw/2+10, by+bh/2-17, socW, 8, 3) ??
        ctx.rect(bx-bw/2+10, by+bh/2-17, socW, 8);
      ctx.fillStyle = socG; ctx.fill();

      // SoC label
      ctx.font = `bold 10px 'Syne',monospace`;
      ctx.fillStyle = socC;
      ctx.textAlign = "center";
      ctx.fillText(`${soc.toFixed(0)}% SoC`, bx, by+bh/2-6);

      // ── Cell grid ─────────────────────────────────────
      if (cells.length > 0) {
        const gCols = 12, gRows = 3;
        const cW = (bw-20)/gCols, cH = (bh-28)/gRows;
        const sx = bx-bw/2+10, sy = by-bh/2+8;
        const vMin = Math.min(...cells), vMax = Math.max(...cells), vRange = vMax-vMin||0.001;
        for (let row=0; row<gRows; row++) for (let col=0; col<gCols; col++) {
          const idx = (row*gCols+col) % cells.length;
          const ratio = (cells[idx]-vMin)/vRange;
          const rr = Math.round(ar*ratio + 34*(1-ratio));
          const rg = Math.round(ag*ratio + 211*(1-ratio));
          const rb = Math.round(ab*ratio + 238*(1-ratio));
          ctx.beginPath();
          (ctx as any).roundRect?.(sx+col*cW+1, sy+row*cH+1, cW-2, cH-2, 2) ??
            ctx.rect(sx+col*cW+1, sy+row*cH+1, cW-2, cH-2);
          ctx.fillStyle = `rgba(${rr},${rg},${rb},0.7)`; ctx.fill();
        }
      }

      // ── Terminal cap ──────────────────────────────────
      ctx.beginPath();
      (ctx as any).roundRect?.(bx+bw/2-1, by-8, 11, 16, 3) ??
        ctx.rect(bx+bw/2-1, by-8, 11, 16);
      ctx.fillStyle = `rgba(${rgb},0.6)`; ctx.fill();

      // ── SoH gauge (top-right) ─────────────────────────
      const gx = W-50, gy = 38, gr = 30;
      const sohColor = soh>=85 ? "#a855f7" : soh>=75 ? "#f59e0b" : "#ef4444";
      const sohAng = Math.PI*0.75 + (soh/100)*Math.PI*1.5;
      ctx.beginPath(); ctx.arc(gx,gy,gr,Math.PI*0.75,Math.PI*2.25);
      ctx.strokeStyle="rgba(255,255,255,0.07)"; ctx.lineWidth=7; ctx.lineCap="round"; ctx.stroke();
      if (soh>0) {
        ctx.beginPath(); ctx.arc(gx,gy,gr,Math.PI*0.75,sohAng);
        ctx.strokeStyle=sohColor; ctx.lineWidth=7; ctx.stroke();
      }
      ctx.font="bold 11px 'Syne',monospace"; ctx.fillStyle=sohColor; ctx.textAlign="center";
      ctx.fillText(`${soh.toFixed(0)}%`,gx,gy+4);
      ctx.font="8px 'DM Sans',sans-serif"; ctx.fillStyle="rgba(255,255,255,0.35)";
      ctx.fillText("SoH",gx,gy+16);

      // ── Temp gauge (top-left) ─────────────────────────
      const tgx = 44, tgy = 38, tgr = 26;
      const tempC = temp>60?"#ef4444":temp>45?"#f59e0b":temp>35?"#f97316":"#22d3ee";
      const tAng  = Math.PI*0.75 + Math.min(1,(temp-5)/90)*Math.PI*1.5;
      ctx.beginPath(); ctx.arc(tgx,tgy,tgr,Math.PI*0.75,Math.PI*2.25);
      ctx.strokeStyle="rgba(255,255,255,0.07)"; ctx.lineWidth=6; ctx.stroke();
      ctx.beginPath(); ctx.arc(tgx,tgy,tgr,Math.PI*0.75,tAng);
      ctx.strokeStyle=tempC; ctx.lineWidth=6; ctx.stroke();
      ctx.font="bold 10px 'Syne',monospace"; ctx.fillStyle=tempC; ctx.textAlign="center";
      ctx.fillText(`${temp.toFixed(0)}°`,tgx,tgy+4);
      ctx.font="8px 'DM Sans',sans-serif"; ctx.fillStyle="rgba(255,255,255,0.35)";
      ctx.fillText("TEMP",tgx,tgy+15);

      // ── Charging bolt ─────────────────────────────────
      if (t?.is_charging) {
        const bp = 0.5+0.5*Math.abs(Math.sin(frame*0.12));
        ctx.globalAlpha = bp;
        ctx.font = "16px sans-serif"; ctx.fillStyle="#f59e0b";
        ctx.textAlign = "center";
        ctx.fillText("⚡", bx, by-bh/2-depth-8);
        ctx.globalAlpha = 1;
      }

      // ── Thermal pulse ring ────────────────────────────
      if (thermal > 0.4) {
        const rp = 0.3 + 0.7*Math.abs(Math.sin(frame*0.07));
        ctx.beginPath();
        ctx.arc(bx, by, 88+8*Math.sin(frame*0.06), 0, Math.PI*2);
        ctx.strokeStyle = `rgba(239,68,68,${rp*thermal*0.45})`;
        ctx.lineWidth = 2; ctx.stroke();
      }

      // ── Scenario label ────────────────────────────────
      ctx.font = "9px 'Syne',monospace";
      ctx.fillStyle = `rgba(${rgb},0.7)`;
      ctx.textAlign = "center";
      ctx.fillText(activeScenario.replace(/_/g," ").toUpperCase(), bx, H-4);

      frame++;
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [latestTelemetry, activeScenario, width, height]);

  return (
    <canvas ref={canvasRef} style={{ width, height, imageRendering:"auto" }} className="rounded-2xl" />
  );
}
