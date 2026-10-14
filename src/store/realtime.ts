import { create } from "zustand";
import type { AppNotification, BusPosition, SeatState, User } from "@/types/api";
import { isVisibleTo } from "@/lib/audience";
import type { ConnectionStatus } from "@/types/ws";

interface RealtimeState {
  status: ConnectionStatus;
  buses: Record<string, BusPosition>;
  seats: Record<string, SeatState>;
  seatDelta: Record<string, number>; // last change per bus, for subtle highlight
  tripActive: Record<string, boolean>; // false = conductor ended / has not started the trip
  notifications: AppNotification[];
  bookingEnabled: boolean;
  setStatus: (s: ConnectionStatus) => void;
  setPosition: (p: BusPosition) => void;
  /** One store update for a whole burst of GPS fixes (17 buses report at once). */
  setPositions: (ps: BusPosition[]) => void;
  setTrip: (busId: string, active: boolean) => void;
  setSeats: (s: SeatState) => void;
  addNotification: (n: AppNotification) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  setBookingEnabled: (b: boolean) => void;
  /** New session: drop everything the previous user was allowed to see. */
  resetNotifications: (user: Pick<User, "id" | "role" | "routeId"> | null) => void;
}

const seedNotifications: AppNotification[] = [
  { id: "N-seed-1", kind: "announcement", title: "Welcome to SmartU", body: "Live tracking, seat availability and QR tickets are now in one place.", ts: new Date(Date.now() - 3600_000).toISOString(), read: false },
  { id: "N-seed-2", kind: "fee", title: "Transport fee", body: "Your challan is available under Fees. Day scholars pay per semester, hostelites per month.", ts: new Date(Date.now() - 86400_000).toISOString(), read: true, audience: { roles: ["DAY_SCHOLAR", "HOSTELITE", "FACULTY"] } },
];

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: "connecting",
  buses: {},
  seats: {},
  seatDelta: {},
  tripActive: {},
  notifications: seedNotifications,
  bookingEnabled: true,
  setStatus: (status) => set({ status }),
  setPosition: (p) => set((s) => ({ buses: { ...s.buses, [p.busId]: p } })),
  setPositions: (ps) => set((s) => { const next = { ...s.buses }; ps.forEach((p) => { next[p.busId] = p; }); return { buses: next }; }),
  setTrip: (busId, active) => set((s) => ({ tripActive: { ...s.tripActive, [busId]: active } })),
  setSeats: (n) =>
    set((s) => {
      const prev = s.seats[n.busId];
      return {
        seats: { ...s.seats, [n.busId]: n },
        seatDelta: prev ? { ...s.seatDelta, [n.busId]: n.seatsAvailable - prev.seatsAvailable } : s.seatDelta,
      };
    }),
  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications].slice(0, 50) })),
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
  setBookingEnabled: (bookingEnabled) => set({ bookingEnabled }),
  resetNotifications: (user) => set({ notifications: seedNotifications.filter((n) => isVisibleTo(n.audience, user)) }),
}));
