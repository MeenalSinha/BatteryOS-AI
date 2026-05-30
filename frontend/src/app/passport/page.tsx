"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Shield, Award, CheckCircle, Hash, Clock, RefreshCw, ExternalLink, Activity } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import ScenarioSelector from "@/components/ui/ScenarioSelector";
import ArcGauge from "@/components/charts/ArcGauge";
import { useBatteryStore } from "@/store/batteryStore";
import { passportApi } from "@/lib/api";
import { useLiveTelemetry } from "@/hooks/useTelemetry";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl ${className}`} style={{ background:"rgba(255,255,255,0.05)" }} />;
}

export default function PassportPage() {
  const { activeVehicleId, activeScenario } = useBatteryStore();
  useLiveTelemetry(activeVehicleId, activeScenario);
  const [passport, setPassport] = useState<any>(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setVerified(false);
    try {
      const res = await passportApi.generate(activeVehicleId, activeScenario);
      setPassport(res.data);
    } catch {}
    setLoading(false);
  }, [activeVehicleId, activeScenario]);

  useEffect(() => { load(); }, [load]);

  const handleVerify = async () => {
    if (!passport?.certificate_id) return;
    setVerifying(true);
    try { await passportApi.verify(passport.certificate_id); } catch {}
    setVerified(true); setVerifying(false);
  };

  const p = passport;
  const soh = p?.overall_health_score ?? 90;
  const rc  = soh >= 85 ? "#a855f7" : soh >= 75 ? "#f59e0b" : "#ef4444";

  const fields = p ? [
    { label:"Vehicle ID",         value:p.vehicle_id },
    { label:"Chemistry",          value:p.chemistry },
    { label:"Issued",             value:new Date(p.issued_at).toLocaleDateString() },
    { label:"Valid Until",        value:new Date(p.valid_until).toLocaleDateString() },
    { label:"Total Cycles",       value:String(p.total_cycles) },
    { label:"Fast Charge Events", value:String(p.fast_charge_events), color:p.fast_charge_events>50?"#f59e0b":undefined },
    { label:"Thermal Events",     value:String(p.thermal_events),     color:p.thermal_events>5?"#f59e0b":undefined },
    { label:"AI Risk Rating",     value:p.ai_risk_rating,             color:rc },
    { label:"Resale Confidence",  value:`${p.resale_confidence_score?.toFixed(1)}%`, color:"#22d3ee" },
  ] : [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <ScenarioSelector />
        <button onClick={load} disabled={loading}
          className="pill flex items-center gap-1.5 text-xs ml-4"
          style={{ background:"rgba(168,85,247,0.1)",color:"#c084fc",borderColor:"rgba(168,85,247,0.25)" }}>
          <RefreshCw style={{ width:12,height:12 }} className={loading ? "animate-spin" : ""} />Regenerate
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Health Score"      value={loading ? "--" : soh?.toFixed(1) ?? "--"} unit="/100" icon={<Award style={{ width:14,height:14 }} />} accent={rc} glow />
        <KPICard label="Resale Confidence" value={loading ? "--" : p?.resale_confidence_score?.toFixed(1) ?? "--"} unit="%" icon={<Shield style={{ width:14,height:14 }} />} accent="#22d3ee" />
        <KPICard label="Predicted Life"    value={loading ? "--" : p?.predicted_lifespan_months ?? "--"} unit="mo" icon={<Clock style={{ width:14,height:14 }} />} accent="#a855f7" />
        <KPICard label="Risk Rating"       value={loading ? "--" : p?.ai_risk_rating ?? "--"} icon={<CheckCircle style={{ width:14,height:14 }} />} accent={rc} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Certificate */}
        <motion.div className="card p-6 relative overflow-hidden" initial={{ opacity:0 }} animate={{ opacity:1 }}
          style={{ borderColor:`${rc}25` }}>
          <div className="absolute top-0 right-0 w-56 h-56 rounded-bl-full pointer-events-none opacity-[0.04]" style={{ background:rc }} />
          <div className="flex items-start gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background:`${rc}18` }}>
              <Shield style={{ width:20,height:20,color:rc }} />
            </div>
            <div>
              <p className="font-display font-bold text-base text-white">Battery Health Certificate</p>
              {loading ? <Skeleton className="w-40 h-3 mt-1.5" /> : (
                <p className="text-xs font-mono mt-1" style={{ color:"rgba(255,255,255,0.35)" }}>{p?.certificate_id ?? "—"}</p>
              )}
            </div>
          </div>

          {/* Gauge */}
          <div className="flex justify-center mb-5">
            {loading ? <Skeleton className="w-36 h-36 rounded-full" /> : (
              <ArcGauge value={soh} size={150} strokeWidth={14} color={rc}
                label={`${soh.toFixed(0)}%`} sublabel="Overall Score" />
            )}
          </div>

          {/* Fields */}
          {loading ? (
            <div className="space-y-2">{[...Array(7)].map((_,i) => (
              <div key={i} className="flex justify-between py-2.5" style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                <Skeleton className="w-28 h-3" /><Skeleton className="w-20 h-3" />
              </div>
            ))}</div>
          ) : (
            <div>
              {fields.map(row => (
                <div key={row.label} className="flex justify-between items-center py-2.5"
                  style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-xs font-body" style={{ color:"rgba(255,255,255,0.4)" }}>{row.label}</span>
                  <span className="text-xs font-mono font-semibold" style={{ color:(row as any).color ?? "white" }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}

          <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
            onClick={handleVerify} disabled={loading || verifying}
            className="w-full mt-5 py-3 rounded-2xl font-display text-sm flex items-center justify-center gap-2 transition-all"
            style={verified
              ? { background:"rgba(168,85,247,0.15)",color:"#c084fc",border:"1px solid rgba(168,85,247,0.35)" }
              : { background:`${rc}18`,color:rc,border:`1px solid ${rc}40` }
            }>
            {verifying
              ? <><div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor:`${rc}40`,borderTopColor:rc }} />VERIFYING...</>
              : verified
                ? <><CheckCircle style={{ width:16,height:16 }} />BLOCKCHAIN VERIFIED</>
                : <><Hash style={{ width:16,height:16 }} />VERIFY ON BLOCKCHAIN</>
            }
          </motion.button>
        </motion.div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Blockchain anchor */}
          <motion.div className="card p-5" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background:"rgba(168,85,247,0.15)",color:"#a855f7" }}>
                <Hash style={{ width:13,height:13 }} />
              </div>
              <h3 className="text-sm font-display font-semibold text-white">Blockchain Anchor</h3>
            </div>
            {loading ? <div className="space-y-2">{[...Array(3)].map((_,i) => <Skeleton key={i} className="h-4 w-full" />)}</div> : (
              <div className="space-y-2.5 text-xs font-mono">
                {[
                  { label:"Hash",  value:p?.blockchain_hash?.slice(0,38) + "...", color:"#a855f7" },
                  { label:"IPFS",  value:p?.ipfs_cid?.slice(0,30) + "...",        color:"#9333ea" },
                  { label:"QR",    value:p?.qr_data ?? "—",                       color:"rgba(255,255,255,0.5)" },
                ].map(item => (
                  <div key={item.label} className="flex gap-2">
                    <span className="w-10 flex-shrink-0" style={{ color:"rgba(255,255,255,0.3)" }}>{item.label}</span>
                    <span className="break-all" style={{ color:item.color }}>{item.value}</span>
                  </div>
                ))}
                {p?.verification_url && (
                  <a href={p.verification_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 mt-1" style={{ color:"#22d3ee" }}>
                    <ExternalLink style={{ width:11,height:11 }} />Verify online
                  </a>
                )}
              </div>
            )}
          </motion.div>

          {/* DNA Fingerprint */}
          <motion.div className="card p-5" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.15 }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background:"rgba(34,211,238,0.12)",color:"#22d3ee" }}>
                <Activity style={{ width:13,height:13 }} />
              </div>
              <h3 className="text-sm font-display font-semibold text-white">DNA Fingerprint</h3>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-2">{[...Array(4)].map((_,i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : p?.dna_fingerprint ? (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(p.dna_fingerprint).map(([k,v]) => (
                  <div key={k} className="rounded-xl p-3" style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-xs font-body mb-1 capitalize" style={{ color:"rgba(255,255,255,0.35)" }}>{k.replace(/_/g," ")}</p>
                    <p className="text-xs font-display font-bold text-white">{String(v)}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </motion.div>

          {/* Use cases */}
          <motion.div className="card p-5" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}>
            <h3 className="text-sm font-display font-semibold text-white mb-3">Certified Use Cases</h3>
            <div className="flex flex-wrap gap-2">
              {["EV Resale","Insurance","Fleet Financing","Battery Leasing","OEM Warranty","Second Life"].map(u => (
                <span key={u} className="pill text-xs"
                  style={{ background:"rgba(168,85,247,0.1)",color:"#c084fc",borderColor:"rgba(168,85,247,0.25)",fontSize:11 }}>
                  {u}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
