import { describe, expect, it } from "vitest";
import { simulator } from "@/demo/simulator";
import { bookingService, sweepTickets } from "@/services/bookings";
import { scanService } from "@/services/ops";
import { BUS_DAY, BUS_HOST, COND, DAY, HOST, as, book, capture, db, qr, tomorrow } from "./helpers";

const scan = (raw: string, bus = BUS_HOST) => { as(COND); return scanService.scan(raw, bus, COND.name); };
const noGap = () => db().patch((d) => ({ pricing: { ...d.pricing, legGapMinutes: 0 } }));
const rec = (id: string) => db().bookings.find((b) => b.id === id)!;
const HOURS = 3600_000;

describe("TICKET QR: one-way = one scan, never reusable", () => {
  it("first scan boards and disposes the ticket; the same QR can't be used again", async () => {
    const t = await book(HOST, BUS_HOST); // one-way
    expect(t).toMatchObject({ tripType: "ONE_WAY", usesAllowed: 1, usesDone: 0 });
    const first = await scan(qr(t));
    expect(first).toMatchObject({ ok: true, title: "Boarding confirmed", legText: "One-way ticket: used, now disposed" });
    expect(rec(t.id)).toMatchObject({ status: "USED", usesDone: 1 });
    const again = await scan(qr(t));
    expect(again).toMatchObject({ ok: false, title: "Ticket already used" });
    expect(db().scanLogs[0]).toMatchObject({ result: "FAILED", reason: "Ticket already used", bookingId: t.id });
  });
  it("after it's disposed the student must book again, and the new ticket works", async () => {
    const t = await book(HOST, BUS_HOST);
    await scan(qr(t));
    const t2 = await book(HOST, BUS_HOST); // allowed: the first one is no longer active
    expect(t2.id).not.toBe(t.id);
    expect((await scan(qr(t2))).ok).toBe(true);
  });
  it("day scholars get the same one-way rule", async () => {
    const t = await book(DAY, BUS_DAY);
    expect((await scan(qr(t), BUS_DAY)).ok).toBe(true);
    expect((await scan(qr(t), BUS_DAY)).title).toBe("Ticket already used");
  });
});

describe("TICKET QR: two-way = two scans (going and coming back), then disposed", () => {
  it("scan 1 keeps the ticket alive for the return trip; scan 2 disposes it; scan 3 is refused", async () => {
    const t = await book(HOST, BUS_HOST, { tripType: "TWO_WAY" });
    expect(t).toMatchObject({ tripType: "TWO_WAY", usesAllowed: 2, direction: "TO_CAMPUS" });
    noGap();
    const going = await scan(qr(t));
    expect(going).toMatchObject({ ok: true, legText: "Boarding 1 of 2: return trip still valid" });
    expect(rec(t.id)).toMatchObject({ status: "CONFIRMED", usesDone: 1 });
    const back = await scan(qr(t));
    expect(back).toMatchObject({ ok: true, legText: "Boarding 2 of 2: ticket now disposed" });
    expect(rec(t.id)).toMatchObject({ status: "USED", usesDone: 2 });
    expect(await scan(qr(t))).toMatchObject({ ok: false, title: "Ticket already used" });
    expect(db().scanLogs.filter((l) => l.bookingId === t.id && l.result === "SUCCESS").map((l) => [l.leg, l.legs])).toEqual([[2, 2], [1, 2]]);
  });
  it("an accidental double scan within the gap doesn't burn the return trip", async () => {
    const t = await book(HOST, BUS_HOST, { tripType: "TWO_WAY" });
    expect((await scan(qr(t))).ok).toBe(true);
    const dbl = await scan(qr(t)); // legGapMinutes = 2 by default
    expect(dbl).toMatchObject({ ok: false, title: "Already scanned" });
    expect(rec(t.id).usesDone).toBe(1);
  });
  it("a two-way ticket costs two trips; a day scholar's costs nothing", async () => {
    expect((await book(HOST, BUS_HOST, { tripType: "TWO_WAY" })).price).toBe(300);
    expect((await book(DAY, BUS_DAY, { tripType: "TWO_WAY" })).price).toBe(0);
  });
});

describe("TICKET QR: automatic disposal after 14 hours", () => {
  it("expiry is the first leg's departure + 14 hours (editable in pricing)", async () => {
    const t = await book(HOST, BUS_HOST);
    const depart = new Date(`${t.date}T${t.departTime}:00`).getTime();
    expect(new Date(t.expiresAt).getTime() - depart).toBe(14 * HOURS);
    db().patch((d) => ({ pricing: { ...d.pricing, ticketValidHours: 10 } }));
    const t2 = await book(HOST, "B06");
    expect(new Date(t2.expiresAt).getTime() - new Date(`${t2.date}T${t2.departTime}:00`).getTime()).toBe(10 * HOURS);
  });
  it("a ticket past its time is disposed automatically and its unused seat is released", async () => {
    const t = await book(HOST, BUS_HOST);
    const free = simulator.getSeats(BUS_HOST)!.seatsAvailable;
    db().patch((d) => ({ bookings: d.bookings.map((b) => (b.id === t.id ? { ...b, expiresAt: new Date(Date.now() - 1000).toISOString() } : b)) }));
    expect(sweepTickets()).toBe(1);
    expect(rec(t.id).status).toBe("EXPIRED");
    expect(simulator.getSeats(BUS_HOST)!.seatsAvailable).toBe(free + 1);
  });
  it("sweeping is idempotent and also runs when tickets are listed", async () => {
    const t = await book(HOST, BUS_HOST);
    db().patch((d) => ({ bookings: d.bookings.map((b) => (b.id === t.id ? { ...b, expiresAt: new Date(Date.now() - 1000).toISOString() } : b)) }));
    as(HOST);
    const list = await bookingService.listMine(HOST.id);
    expect(list.find((b) => b.id === t.id)?.status).toBe("EXPIRED");
    expect(sweepTickets()).toBe(0);
  });
  it("scanning an expired ticket fails with a clear message; the student books again", async () => {
    const t = await book(HOST, BUS_HOST);
    db().patch((d) => ({ bookings: d.bookings.map((b) => (b.id === t.id ? { ...b, expiresAt: new Date(Date.now() - 1000).toISOString() } : b)) }));
    const r = await scan(qr(t));
    expect(r).toMatchObject({ ok: false, title: "Ticket expired" });
    expect(r.detail).toMatch(/14 h/);
    const fresh = await book(HOST, BUS_HOST);
    expect((await scan(qr(fresh))).ok).toBe(true);
  });
  it("a two-way ticket used once then left to expire does NOT free the seat (the student boarded)", async () => {
    const t = await book(HOST, BUS_HOST, { tripType: "TWO_WAY" });
    await scan(qr(t));
    const free = simulator.getSeats(BUS_HOST)!.seatsAvailable;
    db().patch((d) => ({ bookings: d.bookings.map((b) => (b.id === t.id ? { ...b, expiresAt: new Date(Date.now() - 1000).toISOString() } : b)) }));
    sweepTickets();
    expect(rec(t.id).status).toBe("EXPIRED");
    expect(simulator.getSeats(BUS_HOST)!.seatsAvailable).toBe(free);
    expect((await scan(qr(t))).title).toBe("Ticket expired");
  });
  it("only the ticket's owner is told it expired", async () => {
    const t = await book(HOST, BUS_HOST);
    db().patch((d) => ({ bookings: d.bookings.map((b) => (b.id === t.id ? { ...b, expiresAt: new Date(Date.now() - 1000).toISOString() } : b)) }));
    const seen = await capture(() => sweepTickets());
    const n = seen.find((e) => e.type === "notification.new" && e.payload.title === "Ticket expired");
    expect(n?.type === "notification.new" && n.payload.audience).toEqual({ users: [HOST.id], roles: undefined });
  });
});

describe("TICKET QR: validation at the door", () => {
  it("ticket for another route's bus is refused", async () => {
    const t = await book(HOST, BUS_HOST);
    expect(await scan(qr(t), "B09")).toMatchObject({ ok: false, title: "Wrong bus" });
    expect(rec(t.id).usesDone).toBe(0);
  });
  it("a QR whose student id doesn't match the ticket owner is refused", async () => {
    const t = await book(HOST, BUS_HOST);
    expect((await scan(qr({ id: t.id, userId: DAY.id }))).title).toBe("Ticket not found");
  });
  it("stale rotating QR (older than 5 min) is refused without using the ticket", async () => {
    const t = await book(HOST, BUS_HOST);
    expect(await scan(qr(t, 10 * 60_000))).toMatchObject({ ok: false, title: "QR expired" });
    expect(rec(t.id).usesDone).toBe(0);
  });
  it("garbage, wrong version and unknown ticket are refused", async () => {
    expect((await scan("hello-world")).title).toBe("Invalid QR code");
    expect((await scan('{"v":1,"sid":"U-3082","roll":"22F-3082","ts":1}')).title).toBe("Invalid QR code"); // the old identity QR no longer boards
    expect((await scan(qr({ id: "TK-NOPE", userId: HOST.id }))).title).toBe("Ticket not found");
  });
  it("cancelled ticket and banned student are refused", async () => {
    const t = await book(HOST, BUS_HOST);
    as(HOST);
    await bookingService.cancel(t.id);
    expect((await scan(qr(t))).title).toBe("Ticket cancelled");
    const t2 = await book(HOST, BUS_HOST);
    db().patch((d) => ({ students: d.students.map((s) => (s.id === HOST.id ? { ...s, status: "BANNED" as const, banReason: "Violations" } : s)) }));
    expect(await scan(qr(t2))).toMatchObject({ ok: false, title: "Boarding not allowed" });
  });
  it("no ticket, no ride: day scholars and hostelites alike", async () => {
    expect((await scan(qr({ id: "TK-NONE", userId: DAY.id }), BUS_DAY)).ok).toBe(false);
  });
  it("trip not started → nothing can be scanned", async () => {
    const t = await book(HOST, BUS_HOST);
    db().patch((d) => ({ tripActive: { ...d.tripActive, [BUS_HOST]: false } }));
    expect(await scan(qr(t))).toMatchObject({ ok: false, title: "Trip not started" });
    expect(rec(t.id).usesDone).toBe(0);
  });
  it("fully-used ticket tells the student (only them) to book again", async () => {
    const t = await book(HOST, BUS_HOST);
    const seen = await capture(() => scan(qr(t)));
    const n = seen.find((e) => e.type === "notification.new" && e.payload.title === "Ticket used");
    expect(n?.type === "notification.new" && n.payload.audience?.users).toEqual([HOST.id]);
  });
  it("tomorrow's ticket scans fine (expiry counts from that trip, not from booking time)", async () => {
    const t = await book(HOST, BUS_HOST, { date: tomorrow() });
    expect((await scan(qr(t))).ok).toBe(true);
  });
});
