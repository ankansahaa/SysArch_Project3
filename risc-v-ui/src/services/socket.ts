import type { SimulatorMessage } from "../types/simulator";
import { SIMULATOR_DEBUG_ENABLED } from "../constants/simulator";
import { logTransportMessage } from "./debug";

interface SimulatorSocket {
  close(): void;
}

interface SocketConfig {
  backendUrl?: string;
  onMessage: (payload: SimulatorMessage) => void;
  heartbeatMs?: number;
}

export const openSimulatorSocket = ({
  backendUrl,
  onMessage,
  heartbeatMs = 5000,
}: SocketConfig): SimulatorSocket => {
  const socketUrl = backendUrl
    ? (() => {
        const backend = new URL(backendUrl);
        const socketProtocol = backend.protocol === "https:" ? "wss:" : "ws:";
        return `${socketProtocol}//${backend.host}/socket`;
      })()
    : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/socket`;
  const ws = new WebSocket(socketUrl);

  if (SIMULATOR_DEBUG_ENABLED) {
    console.info("[simulator-socket] connecting", { socketUrl });
  }

  ws.onopen = () => {
    if (SIMULATOR_DEBUG_ENABLED) {
      console.info("[simulator-socket] open", { socketUrl });
    }
  };

  ws.onerror = (event: Event) => {
    console.error("[simulator-socket] error", { socketUrl, event });
  };

  ws.onclose = (event: CloseEvent) => {
    if (SIMULATOR_DEBUG_ENABLED) {
      console.warn("[simulator-socket] close", {
        socketUrl,
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
    }
  };

  ws.onmessage = (event: MessageEvent) => {
    logTransportMessage("websocket", "incoming", "Raw message", { socketUrl, data: event.data });

    try {
      const payload: SimulatorMessage = JSON.parse(event.data);
      logTransportMessage("websocket", "incoming", "Parsed message", payload);
      onMessage(payload);
    } catch (error) {
      console.error("[simulator-socket] failed to parse message", {
        socketUrl,
        data: event.data,
        error,
      });
    }
  };

  const heartbeat = window.setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      logTransportMessage("websocket", "outgoing", "Heartbeat", { socketUrl, data: "Heartbeat" });
      ws.send("Heartbeat");
    }
  }, heartbeatMs);

  return {
    close() {
      window.clearInterval(heartbeat);
      ws.close();
    },
  };
};
