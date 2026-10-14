import type { ConnectionStatus, RealtimeClient, WsEvent } from "@/types/ws";
import { simulator } from "@/demo/simulator";

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";

/** Typed WebSocket client with exponential-backoff auto-reconnect. */
export class WsClient implements RealtimeClient {
  private socket: WebSocket | null = null;
  private handlers = new Set<(e: WsEvent) => void>();
  private statusHandlers = new Set<(s: ConnectionStatus) => void>();
  private attempt = 0;
  private retryTimer: number | undefined;
  private closedByUser = false;

  constructor(private url: string, private tokenProvider: () => string | null) {}

  private setStatus(s: ConnectionStatus) {
    this.statusHandlers.forEach((h) => h(s));
  }

  connect() {
    this.closedByUser = false;
    this.setStatus(this.attempt === 0 ? "connecting" : "reconnecting");
    const token = this.tokenProvider();
    const ws = new WebSocket(token ? `${this.url}?token=${encodeURIComponent(token)}` : this.url);
    this.socket = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.setStatus("online");
    };
    ws.onmessage = (m) => {
      try {
        const evt = JSON.parse(m.data) as WsEvent;
        this.handlers.forEach((h) => h(evt));
      } catch {
        /* ignore malformed frame */
      }
    };
    ws.onclose = () => {
      if (this.closedByUser) return this.setStatus("offline");
      this.attempt += 1;
      this.setStatus("reconnecting");
      const delay = Math.min(15000, 500 * 2 ** this.attempt) + Math.random() * 300;
      this.retryTimer = window.setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => ws.close();
  }

  disconnect() {
    this.closedByUser = true;
    window.clearTimeout(this.retryTimer);
    this.socket?.close();
    this.setStatus("offline");
  }

  subscribe(handler: (e: WsEvent) => void) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
  onStatus(handler: (s: ConnectionStatus) => void) {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }
}

export function createRealtimeClient(tokenProvider: () => string | null): RealtimeClient {
  if (DEMO_MODE) return simulator;
  return new WsClient(import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws", tokenProvider);
}
