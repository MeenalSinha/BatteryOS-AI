"use client";
import { useEffect, useRef, useCallback } from "react";
import { useBatteryStore } from "@/store/batteryStore";
import { telemetryApi } from "@/lib/api";

function getWsUrl(): string {
  if (typeof window === "undefined") return "ws://127.0.0.1:8000";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  return `${protocol}//${host}:8000`;
}

/**
 * useLiveTelemetry — connects to the backend WebSocket for real-time telemetry.
 * Falls back to REST polling every 1.5s when WebSocket is unavailable.
 * NO synthetic Math.random data — all data comes from backend physics simulator.
 */
export function useLiveTelemetry(vehicleId: string, scenario: string) {
  const { updateTelemetry, addAlert } = useBatteryStore();
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const res = await telemetryApi.getLive(vehicleId, scenario);
        const data = res.data;
        updateTelemetry(data);
        processAlerts(data, addAlert);
      } catch {
        // Backend truly unavailable — silent
      }
    }, 1500);
  }, [vehicleId, scenario, updateTelemetry, addAlert, stopPoll]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = `${getWsUrl()}/ws/telemetry/${vehicleId}?scenario=${scenario}&interval_ms=1000`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      startPolling();
      return;
    }

    ws.onopen = () => {
      stopPoll(); // WebSocket connected — stop REST polling
    };

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        const data = payload.type === "TELEMETRY" ? payload.data : payload;
        updateTelemetry(data);
        processAlerts(data, addAlert);

        // Process server-pushed alerts
        if (payload.alerts?.length) {
          payload.alerts.forEach((a: any) => {
            addAlert({ type: a.alert_type, severity: a.severity, message: a.message });
          });
        }
      } catch {}
    };

    ws.onerror = () => {
      startPolling();
    };

    ws.onclose = () => {
      // Attempt reconnect after 3s, fall back to REST in the meantime
      startPolling();
      reconnectRef.current = setTimeout(connectWebSocket, 3000);
    };

    wsRef.current = ws;
  }, [vehicleId, scenario, updateTelemetry, addAlert, startPolling, stopPoll]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
      stopPoll();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [vehicleId, scenario]);
}

function processAlerts(data: any, addAlert: (a: any) => void) {
  if (data.thermal_risk_score > 0.6) {
    addAlert({
      type: "THERMAL_RISK",
      severity: data.thermal_risk_score > 0.85 ? "CRITICAL" : "HIGH",
      message: `Thermal risk ${(data.thermal_risk_score * 100).toFixed(0)}% on ${data.vehicle_id}`,
    });
  }
  if (data.anomaly_score > 0.7) {
    addAlert({
      type: "ANOMALY",
      severity: data.anomaly_score > 0.85 ? "CRITICAL" : "WARNING",
      message: `Anomaly score ${(data.anomaly_score * 100).toFixed(0)}% — ${data.anomaly_severity ?? "investigate"}`,
    });
  }
  if (data.state_of_health < 75) {
    addAlert({
      type: "DEGRADATION",
      severity: "WARNING",
      message: `SoH ${data.state_of_health?.toFixed(1)}% — schedule inspection`,
    });
  }
}
