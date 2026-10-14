import type { AppNotification, BusPosition, SeatState } from "./api";

/** Every message the backend WebSocket may push (assumed contract). */
export type WsEvent =
  | { type: "bus.position"; payload: BusPosition }
  | { type: "seats.updated"; payload: SeatState }
  | { type: "notification.new"; payload: AppNotification }
  | { type: "booking.toggled"; payload: { enabled: boolean } }
  | { type: "trip.status"; payload: { busId: string; active: boolean } };

export type ConnectionStatus = "connecting" | "online" | "reconnecting" | "offline";

export interface RealtimeClient {
  connect(): void;
  disconnect(): void;
  subscribe(handler: (e: WsEvent) => void): () => void;
  onStatus(handler: (s: ConnectionStatus) => void): () => void;
}
