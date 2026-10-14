import { useAuthStore } from "@/store/auth";
import { useDemoDB } from "@/demo/db";
import { simulator } from "@/demo/simulator";
import { bookingService, takenSeats, type NewBooking } from "@/services/bookings";
import { buildTicketQr } from "@/lib/ticketQr";
import type { BookingRecord, User } from "@/types/api";
import type { WsEvent } from "@/types/ws";

export const ADMIN: User = { id: "U-ADMIN", identifier: "admin", name: "Transport Office", role: "ADMIN" };
export const DAY: User = { id: "U-3082", identifier: "22F-3082", name: "Ayesha Khan", role: "DAY_SCHOLAR", routeId: "R01" };
export const HOST: User = { id: "U-3091", identifier: "22F-3091", name: "Hamza Ali", role: "HOSTELITE", routeId: "R05" };
export const COND: User = { id: "U-COND1", identifier: "conductor_1", name: "Rashid Mehmood", role: "CONDUCTOR", routeId: "R01" };

/** Bus of the day scholar's route (Route 01) and of the hostelite's route (Route 05). */
export const BUS_DAY = "B01";
export const BUS_HOST = "B05";

export const db = () => useDemoDB.getState();
export const as = (u: User) => useAuthStore.setState({ user: u, token: "test" });
export const today = () => new Date().toISOString().slice(0, 10);
export const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

/** First seat number that is still free on the bus. */
export function freeSeat(busId: string, date: string) {
  const bus = db().buses.find((b) => b.id === busId)!;
  const live = simulator.getSeats(busId)!;
  const taken = takenSeats(busId, date, bus.seatCapacity, live.seatsAvailable);
  return Array.from({ length: bus.seatCapacity }, (_, i) => i + 1).find((n) => !taken.has(n))!;
}

/** Book a ticket as `user` (defaults: seat, tomorrow, one-way to campus). */
export async function book(user: User, busId: string, over: Partial<NewBooking> = {}): Promise<BookingRecord> {
  as(user);
  const date = over.date ?? tomorrow();
  const type = over.type ?? "SEAT";
  return bookingService.create({
    user, busId, date, tripType: "ONE_WAY", direction: "TO_CAMPUS", type,
    seatNo: type === "SEAT" ? over.seatNo ?? freeSeat(busId, date) : undefined,
    ...over,
  });
}

export const qr = (b: Pick<BookingRecord, "id" | "userId">, ageMs = 0) => buildTicketQr(b, Date.now() - ageMs);

/** Collect realtime events while `fn` runs. */
export async function capture(fn: () => Promise<unknown> | unknown): Promise<WsEvent[]> {
  const seen: WsEvent[] = [];
  const off = simulator.subscribe((e) => seen.push(e));
  try { await fn(); } finally { off(); }
  return seen;
}
