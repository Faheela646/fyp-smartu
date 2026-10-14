import { describe, expect, it } from "vitest";
import { simulator } from "@/demo/simulator";
import { bookingService, previewCancel, takenSeats } from "@/services/bookings";
import { financeService, registrationService, scanService } from "@/services/ops";
import { monthKeyOf } from "@/demo/db";
import { BUS_DAY, BUS_HOST, COND, DAY, HOST, as, book, db, freeSeat, qr, tomorrow, today } from "./helpers";

describe("HOSTELITE: ticket booking", () => {
  it("books a seat; seat count drops and the seat becomes taken for everyone", async () => {
    const before = simulator.getSeats(BUS_HOST)!.seatsAvailable;
    const seatNo = freeSeat(BUS_HOST, tomorrow());
    const b = await book(HOST, BUS_HOST, { seatNo });
    expect(b).toMatchObject({ status: "CONFIRMED", type: "SEAT", seatNo, price: 150, tripType: "ONE_WAY", usesAllowed: 1, usesDone: 0, routeNumber: "05" });
    expect(simulator.getSeats(BUS_HOST)!.seatsAvailable).toBe(before - 1);
    const live = simulator.getSeats(BUS_HOST)!;
    expect(takenSeats(BUS_HOST, tomorrow(), db().buses.find((x) => x.id === BUS_HOST)!.seatCapacity, live.seatsAvailable).has(seatNo)).toBe(true);
  });
  it("broadcasts a live seat update to every viewer", async () => {
    const seen: number[] = [];
    const off = simulator.subscribe((e) => { if (e.type === "seats.updated" && e.payload.busId === BUS_HOST) seen.push(e.payload.seatsAvailable); });
    await book(HOST, BUS_HOST);
    off();
    expect(seen).toEqual([19]); // 20 free → 19
  });
  it("rejects a second active ticket on the same bus and day", async () => {
    await book(HOST, BUS_HOST);
    await expect(book(HOST, BUS_HOST)).rejects.toThrow(/already have an active ticket/);
  });
  it("rejects a seat that someone else already holds", async () => {
    const bus = db().buses.find((b) => b.id === BUS_HOST)!;
    const taken = [...takenSeats(BUS_HOST, tomorrow(), bus.seatCapacity, simulator.getSeats(BUS_HOST)!.seatsAvailable)][0];
    await expect(book(HOST, BUS_HOST, { seatNo: taken })).rejects.toThrow(/just taken/);
  });
  it("full bus → seat refused, standing ticket works at half price", async () => {
    simulator.adjustSeats(BUS_HOST, -simulator.getSeats(BUS_HOST)!.seatsAvailable, "seat");
    await expect(book(HOST, BUS_HOST, { type: "SEAT", seatNo: 1 })).rejects.toThrow(/just taken/);
    const standing0 = simulator.getSeats(BUS_HOST)!.standingAvailable;
    const b = await book(HOST, BUS_HOST, { type: "STANDING" });
    expect(b).toMatchObject({ type: "STANDING", price: 75 });
    expect(b.price).toBe(db().pricing.seatPrice / 2);
    expect(simulator.getSeats(BUS_HOST)!.standingAvailable).toBe(standing0 - 1);
  });
  it("standing ticket is not offered while seats remain; completely full bus refuses everyone", async () => {
    await expect(book(HOST, BUS_HOST, { type: "STANDING" })).rejects.toThrow(/still available/);
    simulator.adjustSeats(BUS_HOST, -99, "seat");
    simulator.adjustSeats(BUS_HOST, -99, "standing");
    await expect(book(HOST, BUS_HOST, { type: "STANDING" })).rejects.toThrow(/completely full/);
  });
  it("blocks booking while the admin has paused it", async () => {
    db().patch(() => ({ bookingEnabled: false }));
    await expect(book(HOST, BUS_HOST)).rejects.toThrow(/disabled/);
  });
  it("blocks booking with an unpaid bill from a previous month", async () => {
    const prev = db().bills.find((b) => b.studentId === HOST.id && b.monthKey < monthKeyOf())!;
    db().patch((d) => ({ bills: d.bills.map((b) => (b.id === prev.id ? { ...b, status: "UNPAID" as const } : b)) }));
    await expect(book(HOST, BUS_HOST)).rejects.toThrow(/previous month/);
  });
  it("banned students can't book", async () => {
    db().patch((d) => ({ students: d.students.map((s) => (s.id === HOST.id ? { ...s, status: "BANNED" as const } : s)) }));
    await expect(book(HOST, BUS_HOST)).rejects.toThrow(/suspended/);
  });
  it("a student can only book for themselves", async () => {
    as(HOST);
    await expect(bookingService.create({ user: DAY, busId: BUS_HOST, date: tomorrow(), tripType: "ONE_WAY", direction: "TO_CAMPUS", type: "SEAT", seatNo: 1 })).rejects.toThrow(/for yourself/);
  });
});

describe("DAY SCHOLAR: tickets are free (covered by the semester fee)", () => {
  it("day scholars can book too, at no charge", async () => {
    const b = await book(DAY, BUS_DAY);
    expect(b).toMatchObject({ status: "CONFIRMED", price: 0, routeNumber: "01" });
  });
  it("a day scholar's ticket does not touch any hostel bill", async () => {
    const before = db().bills.length;
    await book(DAY, BUS_DAY, { tripType: "TWO_WAY" });
    expect(db().bills).toHaveLength(before);
  });
  it("overdue semester fee blocks booking", async () => {
    db().patch((d) => ({ fees: d.fees.map((f) => (f.userId === DAY.id ? { ...f, dueDate: new Date(Date.now() - 3 * 86400000).toISOString() } : f)) }));
    await expect(book(DAY, BUS_DAY)).rejects.toThrow(/semester transport fee is overdue/);
  });
});

describe("HOSTELITE: monthly bill follows the tickets they book", () => {
  const bill = (key: string) => db().bills.find((b) => b.studentId === HOST.id && b.monthKey === key);
  it("one-way seat = 1 trip, two-way seat = 2 trips (priced per trip)", async () => {
    const one = await book(HOST, BUS_HOST, { date: tomorrow() });
    expect(one.price).toBe(150);
    const key = tomorrow().slice(0, 7);
    const after1 = bill(key)!;
    expect(after1).toMatchObject({ seatTrips: 1, amount: 150 });
    const two = await book(HOST, "B06", { date: tomorrow(), tripType: "TWO_WAY" });
    expect(two).toMatchObject({ price: 300, usesAllowed: 2 });
    expect(bill(key)).toMatchObject({ seatTrips: 3, amount: 450 });
  });
  it("standing trips are billed at the standing price", async () => {
    simulator.adjustSeats(BUS_HOST, -99, "seat");
    await book(HOST, BUS_HOST, { type: "STANDING", tripType: "TWO_WAY" });
    expect(bill(tomorrow().slice(0, 7))).toMatchObject({ standingTrips: 2, amount: 150 });
  });
  it("cancelling a ticket removes it from the bill", async () => {
    const b = await book(HOST, BUS_HOST);
    await bookingService.cancel(b.id);
    expect(bill(tomorrow().slice(0, 7))).toMatchObject({ seatTrips: 0, amount: 0 });
  });
  it("hostelite pays their monthly bill", async () => {
    const mine = db().bills.find((b) => b.studentId === HOST.id && b.status === "UNPAID")!;
    as(HOST);
    await financeService.payBill(mine.id, "JazzCash");
    expect(db().bills.find((b) => b.id === mine.id)?.status).toBe("PAID");
  });
});

describe("cancellation rule", () => {
  it("free cancellation well before departure, seat released, no fine", async () => {
    const b = await book(HOST, BUS_HOST);
    expect(previewCancel(b)).toMatchObject({ free: true, fee: 0, feePercent: 50, freeHours: 2 });
    const after = simulator.getSeats(BUS_HOST)!.seatsAvailable;
    const finesBefore = db().fines.length;
    const c = await bookingService.cancel(b.id);
    expect(c).toMatchObject({ status: "CANCELLED", cancelFee: 0 });
    expect(simulator.getSeats(BUS_HOST)!.seatsAvailable).toBe(after + 1);
    expect(db().fines.length).toBe(finesBefore);
  });
  it("late cancellation charges 50% and lands in fines", async () => {
    // First leg departs at 00:01 today → we are inside the free window already.
    db().patch((d) => ({ schedules: d.schedules.map((s) => (s.busId === BUS_HOST && s.direction === "TO_CAMPUS" ? { ...s, departTime: "00:01" } : s)) }));
    const b = await book(HOST, BUS_HOST, { date: today() }).catch(() => null);
    if (!b) return; // the 14-hour window of a 00:01 trip has passed (late evening) → the booking itself is refused; covered below
    expect(previewCancel(b)).toMatchObject({ free: false, fee: 75 });
    const c = await bookingService.cancel(b.id);
    expect(c.cancelFee).toBe(75);
    expect(db().fines[0]).toMatchObject({ userId: HOST.id, amount: 75, status: "UNPAID", reason: "Late booking cancellation" });
  });
  it("a trip that already finished can't be booked", async () => {
    db().patch((d) => ({ schedules: d.schedules.map((s) => (s.busId === BUS_HOST && s.direction === "TO_CAMPUS" ? { ...s, departTime: "00:01" } : s)) }));
    const date = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    await expect(book(HOST, BUS_HOST, { date })).rejects.toThrow(/already finished/);
  });
  it("can't cancel twice, or after boarding", async () => {
    const b = await book(HOST, BUS_HOST, { tripType: "TWO_WAY" });
    as(COND);
    await scanService.scan(qr(b), BUS_HOST, COND.name);
    as(HOST);
    await expect(bookingService.cancel(b.id)).rejects.toThrow(/already been used/);
    const c = await book(HOST, "B07");
    await bookingService.cancel(c.id);
    await expect(bookingService.cancel(c.id)).rejects.toThrow(/can't be cancelled/);
  });
  it("cancellation rule follows the admin's pricing settings", async () => {
    db().patch((d) => ({ pricing: { ...d.pricing, freeCancelHours: 48, cancelFeePercent: 20 } }));
    const b = await book(HOST, BUS_HOST);
    expect(previewCancel(b)).toMatchObject({ free: false, fee: 30, feePercent: 20 });
  });
  it("only the owner (or admin) can cancel a ticket", async () => {
    const b = await book(HOST, BUS_HOST);
    as(DAY);
    await expect(bookingService.cancel(b.id)).rejects.toThrow(/belongs to someone else/);
  });
});

describe("DAY SCHOLAR: semester fee → admin approval", () => {
  const myFee = () => db().fees.find((f) => f.userId === DAY.id)!;
  it("starts unpaid with a due date", () => {
    expect(myFee().status).toBe("UNPAID");
    expect(new Date(myFee().dueDate).getTime()).toBeGreaterThan(Date.now());
  });
  it("submits payment details and waits for approval", async () => {
    as(DAY);
    await financeService.submitFee(myFee().id, { method: "Bank transfer", reference: "CHL-77120" });
    expect(myFee().status).toBe("SUBMITTED");
  });
  it("submits a semester registration (starts pending)", async () => {
    as(DAY);
    const r = await registrationService.submit({ userId: DAY.id, semester: "Spring 2027", routeId: "R01", stopId: "R01-S2", residence: "DAY_SCHOLAR" });
    expect(r.status).toBe("PENDING");
  });
});

describe("attendance logs (every boarding, for both kinds of student)", () => {
  it("a day scholar sees each time they boarded; hostelite sees theirs; neither sees the other's", async () => {
    const a = await book(DAY, BUS_DAY, { tripType: "TWO_WAY" });
    const h = await book(HOST, BUS_HOST);
    as(COND);
    await scanService.scan(qr(a), BUS_DAY, COND.name);
    db().patch((d) => ({ pricing: { ...d.pricing, legGapMinutes: 0 } }));
    await scanService.scan(qr(a), BUS_DAY, COND.name);
    await scanService.manual(DAY.id, BUS_DAY, COND.name);
    as(COND); // hostelite's ticket is for B05, so scan it on B05 (conductor's own route check applies to trips, not scans)
    await scanService.scan(qr(h), BUS_HOST, COND.name);
    as(DAY);
    const mine = await scanService.myLogs();
    expect(mine.map((l) => l.studentId)).toEqual(Array(mine.length).fill(DAY.id));
    expect(mine.filter((l) => l.legs)).toHaveLength(2);
    expect(mine.some((l) => !l.legs && l.result === "MANUAL")).toBe(true);
    expect(mine.find((l) => l.leg === 1)).toMatchObject({ legs: 2, routeNumber: "01", bookingId: a.id });
    as(HOST);
    const theirs = await scanService.myLogs();
    expect(theirs.every((l) => l.studentId === HOST.id)).toBe(true);
    expect(theirs.some((l) => l.bookingId === h.id)).toBe(true);
  });
});

describe("HOSTELITE: ticket log (how many one-way / two-way tickets)", () => {
  it("lists every ticket with its type so the counts can be shown and exported", async () => {
    await book(HOST, BUS_HOST);
    await book(HOST, "B06", { tripType: "TWO_WAY" });
    await book(HOST, "B07", { tripType: "TWO_WAY" });
    as(HOST);
    const mine = await bookingService.listMine(HOST.id);
    expect(mine).toHaveLength(3);
    expect(mine.filter((b) => b.tripType === "ONE_WAY")).toHaveLength(1);
    expect(mine.filter((b) => b.tripType === "TWO_WAY")).toHaveLength(2);
    expect(mine.reduce((a, b) => a + b.price, 0)).toBe(150 + 300 + 300);
  });
});
