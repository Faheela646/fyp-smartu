import type { BookingRecord, BookingType, TripType, User } from "@/types/api";
import { simulator } from "@/demo/simulator";
import { monthKeyOf, monthLabel, uid, useDemoDB } from "@/demo/db";
import { to } from "@/lib/audience";
import { DEMO_MODE } from "./wsClient";
import { http, wait } from "./http";
import { assertOwnerOr, requireRole, scopeUserId } from "./rbac";
import { notify } from "./notify";

export interface NewBooking {
  user: User;
  busId: string;
  date: string; // YYYY-MM-DD, date of the first leg
  tripType: TripType;
  /** One-way tickets only: which way. A two-way ticket always starts TO_CAMPUS and returns FROM_CAMPUS. */
  direction: "TO_CAMPUS" | "FROM_CAMPUS";
  type: BookingType;
  seatNo?: number;
}

export interface CancelPreview {
  hoursLeft: number;
  free: boolean;
  fee: number;
  feePercent: number;
  freeHours: number;
}

const db = () => useDemoDB.getState();
const STUDENT_BOOKING_ROLES = ["DAY_SCHOLAR", "HOSTELITE", "FACULTY"] as const;

export const departAt = (b: Pick<BookingRecord, "date" | "departTime">) => new Date(`${b.date}T${b.departTime}:00`);
export const legsOf = (t: TripType) => (t === "TWO_WAY" ? 2 : 1);

/** Deterministic seat order per bus so the seat map is stable while counts change live. */
function order(total: number, busId: string): number[] {
  const seats = Array.from({ length: total }, (_, i) => i + 1);
  let seed = [...busId].reduce((a, c) => a + c.charCodeAt(0), 7);
  for (let i = seats.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [seats[i], seats[j]] = [seats[j], seats[i]];
  }
  return seats;
}

/** Seats currently taken on a bus (active tickets + other riders, derived from the live count). */
export function takenSeats(busId: string, date: string, total: number, available: number): Set<number> {
  const mine = db().bookings.filter((b) => b.busId === busId && b.date === date && b.status === "CONFIRMED" && b.seatNo).map((b) => b.seatNo!);
  const fillerCount = Math.max(0, total - available - mine.length);
  const filler = order(total, busId).filter((n) => !mine.includes(n)).slice(0, fillerCount);
  return new Set([...mine, ...filler]);
}

export function previewCancel(b: BookingRecord): CancelPreview {
  const p = db().pricing;
  const hoursLeft = (departAt(b).getTime() - Date.now()) / 3600_000;
  const free = hoursLeft >= p.freeCancelHours;
  return { hoursLeft, free, fee: free ? 0 : Math.round((b.price * p.cancelFeePercent) / 100), feePercent: p.cancelFeePercent, freeHours: p.freeCancelHours };
}

/** Departure time of a bus's leg (from the schedules the admin manages). */
function legTime(busId: string, direction: "TO_CAMPUS" | "FROM_CAMPUS"): string {
  return db().schedules.find((s) => s.busId === busId && s.direction === direction && s.active)?.departTime ?? (direction === "TO_CAMPUS" ? "07:30" : "16:30");
}

/** Keep the hostelite's monthly bill in step with the tickets they hold (delta may be negative). */
function adjustBill(userId: string, date: string, type: BookingType, legs: number, amount: number) {
  const st = db().students.find((s) => s.id === userId);
  if (!st || st.residence !== "HOSTELITE") return;
  const key = date.slice(0, 7) || monthKeyOf();
  db().patch((d) => {
    const existing = d.bills.find((b) => b.studentId === userId && b.monthKey === key);
    const seat = type === "SEAT" ? legs : 0;
    const stand = type === "STANDING" ? legs : 0;
    if (existing) {
      return { bills: d.bills.map((b) => (b.id === existing.id ? { ...b, seatTrips: Math.max(0, b.seatTrips + seat), standingTrips: Math.max(0, b.standingTrips + stand), amount: Math.max(0, b.amount + amount) } : b)) };
    }
    return { bills: [{ id: `HB-${userId}-${key}`, studentId: userId, studentName: st.name, rollNo: st.rollNo, monthKey: key, month: monthLabel(key), seatTrips: Math.max(0, seat), standingTrips: Math.max(0, stand), amount: Math.max(0, amount), status: "UNPAID" as const }, ...d.bills] };
  });
}

/**
 * Dispose tickets whose time is up (trip start + validity hours, 14 h by default) and give their seat back.
 * Called whenever tickets are read or scanned, and on a timer in the app.
 */
export function sweepTickets(now = Date.now()): number {
  const expired = db().bookings.filter((b) => b.status === "CONFIRMED" && new Date(b.expiresAt).getTime() <= now);
  if (!expired.length) return 0;
  const ids = new Set(expired.map((b) => b.id));
  db().patch((d) => ({ bookings: d.bookings.map((b) => (ids.has(b.id) ? { ...b, status: "EXPIRED" as const } : b)) }));
  expired.forEach((b) => {
    if (b.usesDone === 0) simulator.adjustSeats(b.busId, +1, b.type === "SEAT" ? "seat" : "standing"); // never boarded → seat is free again
    notify("Ticket expired", `Your ${b.routeName} ticket for ${b.date} was disposed automatically. Book again to get a new QR.`, "booking", to.student(b.userId));
  });
  return expired.length;
}

export const bookingService = {
  /** My tickets (newest first). Students only ever get their own. */
  async listMine(userId: string): Promise<BookingRecord[]> {
    if (!DEMO_MODE) return (await http.get<BookingRecord[]>("/bookings", { params: { userId } })).data;
    await wait(80);
    const uidScoped = scopeUserId(userId, "ADMIN")!;
    sweepTickets();
    return db().bookings.filter((b) => b.userId === uidScoped).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Every ticket: admin only. */
  async listAll(): Promise<BookingRecord[]> {
    if (!DEMO_MODE) return (await http.get<BookingRecord[]>("/admin/bookings")).data;
    await wait(80);
    requireRole("ADMIN");
    sweepTickets();
    return [...db().bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Tickets for one bus (conductor's passenger list). */
  async listForBus(busId: string): Promise<BookingRecord[]> {
    if (!DEMO_MODE) return (await http.get<BookingRecord[]>("/bookings", { params: { busId } })).data;
    await wait(80);
    requireRole("CONDUCTOR", "ADMIN");
    sweepTickets();
    return db().bookings.filter((b) => b.busId === busId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  sweep: () => sweepTickets(),

  async create(req: NewBooking): Promise<BookingRecord> {
    if (!DEMO_MODE) return (await http.post<BookingRecord>("/bookings", req)).data;
    await wait(120);
    const me = requireRole(...STUDENT_BOOKING_ROLES);
    if (req.user.id !== me.id) throw new Error("You can only book tickets for yourself.");
    sweepTickets();
    const d = db();
    const student = d.students.find((s) => s.id === me.id);
    if (student?.status === "BANNED") throw new Error("Your account is suspended. Contact the Transport Office.");
    if (!d.bookingEnabled) throw new Error("Ticket booking is currently disabled by the Transport Office.");
    const dup = d.bookings.find((b) => b.userId === me.id && b.date === req.date && b.status === "CONFIRMED" && b.busId === req.busId);
    if (dup) throw new Error("You already have an active ticket on this bus for that day.");
    const overdue =
      me.role === "HOSTELITE"
        ? d.bills.some((b) => b.studentId === me.id && b.status === "UNPAID" && b.monthKey < monthKeyOf())
        : d.fees.some((f) => f.userId === me.id && f.status === "UNPAID" && new Date(f.dueDate) < new Date());
    if (overdue) throw new Error(me.role === "HOSTELITE" ? "You have an unpaid bill from a previous month. Please clear it to book." : "Your semester transport fee is overdue. Please pay it to book.");
    const live = simulator.getSeats(req.busId);
    if (!live) throw new Error("Live seat data isn't available yet. Try again in a moment.");
    if (req.type === "SEAT" && live.seatsAvailable <= 0) throw new Error("Sorry, that seat was just taken. Pick another or take a standing ticket.");
    if (req.type === "STANDING" && live.seatsAvailable > 0) throw new Error("Seats are still available, so a standing ticket isn't offered.");
    if (req.type === "STANDING" && live.standingAvailable <= 0) throw new Error("This bus is completely full.");
    const bus = d.buses.find((b) => b.id === req.busId);
    if (!bus) throw new Error("Bus not found.");
    if (req.type === "SEAT" && req.seatNo) {
      const taken = takenSeats(req.busId, req.date, bus.seatCapacity, live.seatsAvailable);
      if (taken.has(req.seatNo)) throw new Error(`Seat ${req.seatNo} was just taken. Please choose another.`);
    }
    const firstDir = req.tripType === "TWO_WAY" ? "TO_CAMPUS" : req.direction;
    const departTime = legTime(bus.id, firstDir);
    const expiresAt = new Date(new Date(`${req.date}T${departTime}:00`).getTime() + d.pricing.ticketValidHours * 3600_000);
    if (expiresAt.getTime() <= Date.now()) throw new Error("That trip has already finished. Pick tomorrow's date.");
    const route = d.routes.find((r) => r.id === bus.routeId);
    const legs = legsOf(req.tripType);
    const unit = req.type === "SEAT" ? d.pricing.seatPrice : d.pricing.standingPrice;
    // Hostelites are billed per ticket (monthly); day scholars' rides are covered by their semester fee.
    const price = me.role === "HOSTELITE" ? unit * legs : 0;
    const rec: BookingRecord = {
      id: uid("TK"), userId: me.id, busId: bus.id, routeId: bus.routeId, date: req.date, type: req.type, price, status: "CONFIRMED",
      tripType: req.tripType, direction: firstDir, usesAllowed: legs, usesDone: 0, expiresAt: expiresAt.toISOString(),
      seatNo: req.type === "SEAT" ? req.seatNo : undefined, departTime, routeName: route?.name ?? bus.routeId, routeNumber: route?.number ?? "", plate: bus.plate,
      createdAt: new Date().toISOString(),
    };
    d.patch((s) => ({ bookings: [rec, ...s.bookings] }));
    simulator.adjustSeats(bus.id, -1, req.type === "SEAT" ? "seat" : "standing");
    if (price) adjustBill(me.id, req.date, req.type, legs, price);
    return rec;
  },

  async cancel(id: string): Promise<BookingRecord> {
    if (!DEMO_MODE) return (await http.post<BookingRecord>(`/bookings/${id}/cancel`)).data;
    await wait(100);
    const d = db();
    const b = d.bookings.find((x) => x.id === id);
    if (!b) throw new Error("Ticket not found.");
    assertOwnerOr(b.userId, "ADMIN");
    sweepTickets();
    const fresh = db().bookings.find((x) => x.id === id)!;
    if (fresh.status !== "CONFIRMED") throw new Error("This ticket can't be cancelled.");
    if (fresh.usesDone > 0) throw new Error("This ticket has already been used to board, so it can't be cancelled.");
    const prev = previewCancel(fresh);
    const updated: BookingRecord = { ...fresh, status: "CANCELLED", cancelFee: prev.fee };
    d.patch((s) => ({
      bookings: s.bookings.map((x) => (x.id === id ? updated : x)),
      fines: prev.fee
        ? [{ id: uid("FN"), userId: fresh.userId, studentName: s.students.find((st) => st.id === fresh.userId)?.name ?? "Student", reason: "Late booking cancellation", amount: prev.fee, date: new Date().toISOString(), status: "UNPAID" as const, issuedBy: "System" }, ...s.fines]
        : s.fines,
    }));
    simulator.adjustSeats(fresh.busId, +1, fresh.type === "SEAT" ? "seat" : "standing");
    if (fresh.price) adjustBill(fresh.userId, fresh.date, fresh.type, -legsOf(fresh.tripType), -fresh.price);
    if (prev.fee) notify("Fine issued", `Late cancellation fee of Rs. ${prev.fee} was added to your fines.`, "fine", to.student(fresh.userId));
    return updated;
  },
};

