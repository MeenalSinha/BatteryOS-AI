"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Send, Bot, Loader2, MessageCircle } from "lucide-react";
import { useBatteryStore } from "@/store/batteryStore";

interface Message { role: "user" | "assistant"; content: string; timestamp: string; }

const SYSTEM_PROMPT = `You are BatteryOS AI Assistant — an expert embedded in the BatteryOS AI platform for EV battery management. Use the live telemetry context provided in each message to give precise, data-driven answers. Be concise, technical, and actionable. Specialise in battery degradation, thermal management, charging optimisation, anomaly detection, and fleet analytics.`;

export default function VoiceAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const hasAlertedRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const { latestTelemetry, activeScenario, activeVehicleId } = useBatteryStore();

  useEffect(() => {
    if (latestTelemetry && latestTelemetry.thermal_risk_score > 0.8 && !hasAlertedRef.current) {
      setOpen(true);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "CRITICAL ALERT: Thermal risk exceeds 80%. Immediate cooling intervention recommended.", timestamp: new Date().toLocaleTimeString() }
      ]);
      hasAlertedRef.current = true;
    } else if (latestTelemetry && latestTelemetry.thermal_risk_score < 0.5) {
      hasAlertedRef.current = false;
    }
  }, [latestTelemetry]);

  const buildContext = useCallback((userMsg: string) => {
    const t = latestTelemetry;
    if (!t) return userMsg;
    return `[LIVE TELEMETRY — ${activeVehicleId} — Scenario: ${activeScenario}]
SoC: ${t.state_of_charge?.toFixed(1)}% | SoH: ${t.state_of_health?.toFixed(1)}% | Temp: ${t.temperature_avg?.toFixed(1)}°C
Thermal Risk: ${(t.thermal_risk_score * 100)?.toFixed(0)}% | Anomaly: ${(t.anomaly_score * 100)?.toFixed(0)}%
Voltage: ${t.voltage?.toFixed(1)}V | Current: ${t.current?.toFixed(1)}A | Chemistry: ${t.chemistry}
Cell delta: ${t.cell_voltages?.length > 1 ? ((Math.max(...t.cell_voltages) - Math.min(...t.cell_voltages)) * 1000).toFixed(1) + "mV" : "N/A"}
[END TELEMETRY]

${userMsg}`;
  }, [latestTelemetry, activeVehicleId, activeScenario]);

  const sendMessage = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    const userMsg: Message = { role: "user", content: userText, timestamp: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const apiMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: buildContext(userText) },
      ];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 600, system: SYSTEM_PROMPT, messages: apiMessages }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text ?? "No response.";
      setMessages(prev => [...prev, { role: "assistant", content: reply, timestamp: new Date().toLocaleTimeString() }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "AI assistant temporarily unavailable.", timestamp: new Date().toLocaleTimeString() }]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  const toggleVoice = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) return;
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new SR();
    r.onresult = (e: any) => { const t = e.results[0][0].transcript; setInput(t); setListening(false); setTimeout(() => sendMessage(t), 100); };
    r.onerror = r.onend = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  };

  const QUICK = ["What is the current thermal risk?", "Should I charge now?", "Explain the anomaly score", "Months until end-of-life?"];

  return (
    <>
      <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 30px rgba(139,92,246,0.5)" }}>
        <MessageCircle className="w-6 h-6 text-white" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-96 rounded-3xl overflow-hidden"
            style={{ background: "#13102a", border: "1px solid rgba(139,92,246,0.25)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4"
              style={{ background: "rgba(139,92,246,0.12)", borderBottom: "1px solid rgba(139,92,246,0.15)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-display font-bold text-white">BatteryOS Assistant</p>
                <p className="text-xs font-body" style={{ color: "#a855f7" }}>
                  {latestTelemetry ? `Live · ${activeVehicleId}` : "Connecting..."}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="side-btn w-7 h-7 rounded-lg">
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>

            {/* Messages */}
            <div className="h-64 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-mono uppercase tracking-widest text-center mb-4"
                    style={{ color: "rgba(255,255,255,0.25)" }}>Quick Actions</p>
                  {QUICK.map(q => (
                    <button key={q} onClick={() => sendMessage(q)}
                      className="w-full text-left text-xs px-3 py-2.5 rounded-xl transition-colors"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.12)"; (e.currentTarget as HTMLElement).style.color = "#c084fc"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed"
                    style={m.role === "user"
                      ? { background: "rgba(139,92,246,0.25)", color: "white", border: "1px solid rgba(139,92,246,0.3)" }
                      : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.08)" }
                    }>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className="mt-1 text-right" style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>{m.timestamp}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="px-3.5 py-2.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#a855f7" }} />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 flex items-center gap-2"
              style={{ background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask about battery health..."
                className="flex-1 bg-transparent text-xs outline-none font-body"
                style={{ color: "white" }} />
              <button onClick={toggleVoice}
                className="side-btn w-8 h-8 rounded-xl"
                style={listening ? { color: "#ef4444", background: "rgba(239,68,68,0.15)" } : {}}>
                {listening ? <MicOff style={{ width: 15, height: 15 }} /> : <Mic style={{ width: 15, height: 15 }} />}
              </button>
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: input.trim() ? "#7c3aed" : "rgba(255,255,255,0.06)", color: "white" }}>
                <Send style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
