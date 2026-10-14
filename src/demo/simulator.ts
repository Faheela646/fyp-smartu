import type { BusPosition, SeatState } from "@/types/api";
import type { ConnectionStatus, RealtimeClient, WsEvent } from "@/types/ws";
import { DEMO_BUSES, DEMO_ROUTES } from "./data";
import { useDemoDB } from "./db";

type Pt = [number, number];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function segLen(a: Pt, b: Pt) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
function bearing(a: Pt, b: Pt) {
  const dy = b[0] - a[0];
  const dx = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

/** Position along a polyline for t in [0,1], ping-ponging at both ends. */
function pointAt(path: Pt[], t: number): { pt: Pt; heading: number } {
  const lens = path.slice(1).map((p, i) => segLen(path[i], p));
  const total = lens.reduce((a, b) => a + b, 0);
  let d = t * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i]) {
      const f = lens[i] === 0 ? 0 : d / lens[i];
      const a = path[i], b = path[i + 1];
      return { pt: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], heading: bearing(a, b) };
    }
    d -= lens[i];
  }
  const last = path[path.length - 1];
  return { pt: last, heading: 0 };
}

interface Sim {
  active: boolean;
  external: boolean;
  progress: number;
  dir: 1 | -1;
  speed: number; // route fraction per second
  seatsAvailable: number;
  standingAvailable: number;
}

/** Demo-mode RealtimeClient: moves buses, changes seat counts, emits notifications. */
export class DemoSimulator implements RealtimeClient {
  private handlers = new Set<(e: WsEvent) => void>();
  private statusHandlers = new Set<(s: ConnectionStatus) => void>();
  private timers: number[] = [];
  private sims = new Map<string, Sim>();
  private status: ConnectionStatus = "offline";

  constructor() {
    DEMO_BUSES.forEach((b, i) => {
      this.sims.set(b.id, {
        active: true,
        external: false,
        progress: (0.06 + i * 0.173) % 0.92, // spread the 17 buses along their routes
        dir: 1,
        speed: rand(0.006, 0.011),
        seatsAvailable: Math.round(b.seatCapacity * rand(0.2, 0.6)),
        standingAvailable: b.standingCapacity,
      });
    });
  }

  private emit(e: WsEvent) {
    this.handlers.forEach((h) => h(e));
  }
  private setStatus(s: ConnectionStatus) {
    this.status = s;
    this.statusHandlers.forEach((h) => h(s));
  }

  private seatEvent(busId: string): WsEvent {
    const bus = DEMO_BUSES.find((b) => b.id === busId)!;
    const s = this.sims.get(busId)!;
    const payload: SeatState = {
      busId, routeId: bus.routeId, seatsTotal: bus.seatCapacity,
      seatsAvailable: s.seatsAvailable, standingAvailable: s.standingAvailable,
    };
    return { type: "seats.updated", payload };
  }

  private positionEvent(busId: string): WsEvent {
    const bus = DEMO_BUSES.find((b) => b.id === busId)!;
    const route = DEMO_ROUTES.find((r) => r.id === bus.routeId)!;
    const s = this.sims.get(busId)!;
    const t = s.dir === 1 ? s.progress : 1 - s.progress;
    const { pt, heading } = pointAt(route.path, t);
    const payload: BusPosition = {
      busId, lat: pt[0], lng: pt[1],
      heading: s.dir === 1 ? heading : (heading + 180) % 360,
      speedKmh: Math.round(rand(28, 46)),
      ts: new Date().toISOString(),
    };
    return { type: "bus.position", payload };
  }

  /** Called by demo services (bookings, cancellations) so every viewer sees the change instantly. */
  adjustSeats(busId: string, delta: number, kind: "seat" | "standing" = "seat") {
    const bus = DEMO_BUSES.find((b) => b.id === busId);
    const s = this.sims.get(busId);
    if (!bus || !s) return;
    if (kind === "seat") s.seatsAvailable = clamp(s.seatsAvailable + delta, 0, bus.seatCapacity);
    else s.standingAvailable = clamp(s.standingAvailable + delta, 0, bus.standingCapacity);
    this.emit(this.seatEvent(busId));
  }
  getSeats(busId: string) {
    const s = this.sims.get(busId);
    return s ? { seatsAvailable: s.seatsAvailable, standingAvailable: s.standingAvailable } : null;
  }
  broadcast(e: WsEvent) {
    this.emit(e);
  }

  /** Conductor started / ended the trip: the bus stops moving and every client is told. */
  setTrip(busId: string, active: boolean) {
    const s = this.sims.get(busId);
    if (s) s.active = active;
    this.emit({ type: "trip.status", payload: { busId, active } });
  }
  /** While a conductor shares real GPS, the simulated movement for that bus is switched off. */
  setExternal(busId: string, on: boolean) {
    const s = this.sims.get(busId);
    if (s) s.external = on;
  }
  pushExternal(busId: string, p: { lat: number; lng: number; speedKmh: number; heading: number }) {
    this.emit({ type: "bus.position", payload: { busId, lat: p.lat, lng: p.lng, heading: p.heading, speedKmh: Math.round(p.speedKmh), ts: new Date().toISOString() } });
  }

  connect() {
    if (this.status === "online" || this.status === "connecting") return;
    this.setStatus("connecting");
    this.timers.push(
      window.setTimeout(() => {
        this.setStatus("online");
        const trips = useDemoDB.getState().tripActive;
        DEMO_BUSES.forEach((b) => {
          const s = this.sims.get(b.id)!;
          s.active = trips[b.id] !== false;
          this.emit(this.seatEvent(b.id));
          this.emit(this.positionEvent(b.id));
          this.emit({ type: "trip.status", payload: { busId: b.id, active: s.active } });
        });
      }, 250),
    );

    // GPS tick: every 2s (client interpolates between points).
    this.timers.push(
      window.setInterval(() => {
        if (this.status !== "online") return;
        DEMO_BUSES.forEach((b) => {
          const s = this.sims.get(b.id)!;
          if (!s.active || s.external) return;
          s.progress += s.speed * 2;
          if (s.progress >= 1) {
            s.progress = 0;
            s.dir = s.dir === 1 ? -1 : 1;
          }
          this.emit(this.positionEvent(b.id));
        });
      }, 2000),
    );

    // Seat churn.
    this.timers.push(
      window.setInterval(() => {
        if (this.status !== "online") return;
        const b = DEMO_BUSES[Math.floor(Math.random() * DEMO_BUSES.length)];
        const s = this.sims.get(b.id)!;
        const delta = Math.random() < 0.55 ? -1 : 1;
        s.seatsAvailable = clamp(s.seatsAvailable + delta, 0, b.seatCapacity);
        s.standingAvailable = s.seatsAvailable === 0 ? clamp(s.standingAvailable + delta, 0, b.standingCapacity) : b.standingCapacity;
        this.emit(this.seatEvent(b.id));
      }, 3500),
    );

    // Occasional delay notice, sent ONLY to the students riding that route (and the admin).
    this.timers.push(
      window.setInterval(() => {
        if (this.status !== "online") return;
        const live = DEMO_BUSES.filter((b) => this.sims.get(b.id)?.active);
        if (!live.length) return;
        const b = live[Math.floor(Math.random() * live.length)];
        const mins = 4 + Math.floor(Math.random() * 9);
        this.emit({
          type: "notification.new",
          payload: {
            id: `N-${Date.now()}`, kind: "delay", title: "Bus delayed", body: `Route ${b.routeId.slice(1)} (${b.plate}) is running about ${mins} minutes late due to traffic.`,
            ts: new Date().toISOString(), read: false, audience: { routeIds: [b.routeId], roles: ["ADMIN"] },
          },
        });
      }, 90000),
    );
  }

  disconnect() {
    this.timers.forEach((t) => {
      window.clearTimeout(t);
      window.clearInterval(t);
    });
    this.timers = [];
    this.setStatus("offline");
  }

  subscribe(handler: (e: WsEvent) => void) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
  onStatus(handler: (s: ConnectionStatus) => void) {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }
}

export const simulator = new DemoSimulator();
