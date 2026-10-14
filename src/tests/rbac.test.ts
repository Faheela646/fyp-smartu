import { describe, expect, it } from "vitest";
import { announcementService, driverService, financeService, fleetService, registrationService, scanService, settingsService, studentService, violationService } from "@/services/ops";
import { bookingService } from "@/services/bookings";
import { isVisibleTo, to } from "@/lib/audience";
import { useRealtimeStore } from "@/store/realtime";
import { ADMIN, BUS_HOST, COND, DAY, HOST, as, book, capture, db, qr } from "./helpers";

const FORBIDDEN = /permission|only see your own|belongs to someone else|sign in/;

describe("RBAC: students can't do admin or conductor things", () => {
  it.each([
    ["approve fees", () => financeService.approveFees(["x"])],
    ["reject a fee", () => financeService.rejectFee("x", "because")],
    ["issue a fine", () => financeService.issueFine({ userId: "U-3082", reason: "x", amount: 1, issuedBy: "me" })],
    ["waive a fine", () => financeService.waiveFine("FN-1")],
    ["change pricing", () => financeService.savePricing(db().pricing)],
    ["mark a bill paid as admin", () => financeService.markBillPaid("x")],
    ["list every student", () => studentService.list()],
    ["bulk add students", () => studentService.bulkAdd([])],
    ["ban a student", () => studentService.setBan("U-3082", true, "x")],
    ["list drivers (full records)", () => driverService.list()],
    ["save a driver", () => driverService.save({ id: "D-X", name: "x", phone: "1", address: "y" })],
    ["edit buses / routes / schedules", () => fleetService.saveBus({ id: "B-X", plate: "x", routeId: "R01", seatCapacity: 1, standingCapacity: 1 })],
    ["publish an announcement", () => announcementService.publish({ title: "x", body: "yyyyyyyyyy", audience: "ALL", author: "x" })],
    ["toggle booking", () => settingsService.setBookingEnabled(false)],
    ["list every ticket", () => bookingService.listAll()],
    ["list a bus's tickets", () => bookingService.listForBus("B01")],
    ["read every boarding log", () => scanService.logs()],
    ["scan a ticket", () => scanService.scan("x", "B01", "x")],
    ["mark manual attendance", () => scanService.manual("U-3082", "B01", "x")],
    ["start a trip", () => fleetService.setTrip("B01", false)],
    ["file a violation report", () => violationService.report({ studentId: "U-3082", type: "Other", notes: "xxxxx", reportedBy: "x", busId: "B01" })],
    ["list violation reports", () => violationService.list()],
    ["apply policy", () => violationService.applyPolicy("VR-3")],
    ["decide registrations", () => registrationService.decideMany(["RG-2"], "APPROVED")],
  ])("student cannot %s", async (_name, fn) => {
    as(DAY);
    await expect(Promise.resolve().then(fn as () => Promise<unknown>)).rejects.toThrow(FORBIDDEN);
  });
});

describe("RBAC: a conductor can't do admin or student things", () => {
  it.each([
    ["see fees", () => financeService.listFees()],
    ["see fines", () => financeService.listFines()],
    ["see hostel bills", () => financeService.listBills()],
    ["approve fees", () => financeService.approveFees(["x"])],
    ["apply violation policy", () => violationService.applyPolicy("VR-3")],
    ["book a ticket", () => bookingService.create({ user: COND, busId: "B01", date: "2099-01-01", tripType: "ONE_WAY", direction: "TO_CAMPUS", type: "STANDING" })],
    ["save drivers", () => driverService.save({ id: "D-X", name: "x", phone: "1", address: "y" })],
    ["list every ticket", () => bookingService.listAll()],
    ["see a student's own-record endpoint", () => studentService.me()],
  ])("conductor cannot %s", async (_name, fn) => {
    as(COND);
    await expect(Promise.resolve().then(fn as () => Promise<unknown>)).rejects.toThrow(FORBIDDEN);
  });
});

describe("RBAC: a student only reads their own information", () => {
  it("fees / fines / bills / tickets / registrations are scoped to the caller", async () => {
    as(DAY);
    expect((await financeService.listFees()).every((f) => f.userId === DAY.id)).toBe(true);
    expect((await financeService.listFines()).every((f) => f.userId === DAY.id)).toBe(true);
    expect((await registrationService.list()).every((r) => r.userId === DAY.id)).toBe(true);
    await expect(financeService.listFees(HOST.id)).rejects.toThrow(FORBIDDEN);
    await expect(financeService.listFines(HOST.id)).rejects.toThrow(FORBIDDEN);
    await expect(financeService.listBills(HOST.id)).rejects.toThrow(FORBIDDEN);
    await expect(bookingService.listMine(HOST.id)).rejects.toThrow(FORBIDDEN);
    await expect(registrationService.list(HOST.id)).rejects.toThrow(FORBIDDEN);
  });
  it("can't pay, submit or cancel someone else's item", async () => {
    const hostFine = db().fines.find((f) => f.userId === HOST.id && f.status === "UNPAID")!;
    const dayFee = db().fees.find((f) => f.userId === DAY.id)!;
    const hostBill = db().bills.find((b) => b.studentId === HOST.id)!;
    const t = await book(HOST, BUS_HOST);
    as(DAY);
    await expect(financeService.payFine(hostFine.id, "x")).rejects.toThrow(FORBIDDEN);
    await expect(financeService.payBill(hostBill.id, "x")).rejects.toThrow(FORBIDDEN);
    await expect(bookingService.cancel(t.id)).rejects.toThrow(FORBIDDEN);
    as(HOST);
    await expect(financeService.submitFee(dayFee.id, { method: "x", reference: "REF-12345" })).rejects.toThrow(FORBIDDEN);
  });
  it("me() returns only the signed-in student's record", async () => {
    as(HOST);
    expect(await studentService.me()).toMatchObject({ id: HOST.id, rollNo: "22F-3091" });
  });
  it("a student's attendance log never includes other students' scans", async () => {
    const t = await book(HOST, BUS_HOST);
    as(COND);
    await scanService.scan(qr(t), BUS_HOST, COND.name);
    as(DAY);
    expect((await scanService.myLogs()).every((l) => l.studentId === DAY.id)).toBe(true);
  });
  it("admin can read anyone's records", async () => {
    as(ADMIN);
    expect((await financeService.listFees()).length).toBeGreaterThan(5);
    expect((await financeService.listFines(HOST.id)).every((f) => f.userId === HOST.id)).toBe(true);
    expect((await studentService.list()).length).toBeGreaterThan(10);
  });
  it("not signed in → nothing works", async () => {
    const { useAuthStore } = await import("@/store/auth");
    useAuthStore.setState({ user: null, token: null });
    await expect(financeService.listFees()).rejects.toThrow(/sign in/);
  });
});

describe("NOTIFICATIONS: each person only gets their own information (+ announcements for them)", () => {
  const seenBy = (events: Awaited<ReturnType<typeof capture>>, user: Parameters<typeof isVisibleTo>[1]) =>
    events.filter((e) => e.type === "notification.new" && isVisibleTo(e.payload.audience, user)).map((e) => (e.type === "notification.new" ? e.payload.title : ""));

  it("audience rules", () => {
    expect(isVisibleTo(undefined, DAY)).toBe(true);
    expect(isVisibleTo(to.student("U-3091"), HOST)).toBe(true);
    expect(isVisibleTo(to.student("U-3091"), DAY)).toBe(false);
    expect(isVisibleTo(to.student("U-3091", true), ADMIN)).toBe(true);
    expect(isVisibleTo(to.admin, ADMIN)).toBe(true);
    expect(isVisibleTo(to.admin, HOST)).toBe(false);
    expect(isVisibleTo(to.announcement("HOSTELITE"), HOST)).toBe(true);
    expect(isVisibleTo(to.announcement("HOSTELITE"), DAY)).toBe(false);
    expect(isVisibleTo(to.announcement("ALL"), DAY)).toBe(true);
    expect(isVisibleTo(to.route("R05"), HOST)).toBe(true); // same route
    expect(isVisibleTo(to.route("R05"), DAY)).toBe(false); // different route
    expect(isVisibleTo(to.route("R05"), ADMIN)).toBe(true);
    expect(isVisibleTo(to.student("x"), null)).toBe(false);
  });

  it("when one student is fined, other students are NOT notified (only that student and the admin)", async () => {
    as(COND);
    const v = await violationService.report({ studentId: HOST.id, type: "No QR / pass", notes: "no ticket shown", reportedBy: COND.name, busId: "B05", routeId: "R05" });
    as(ADMIN);
    const events = await capture(() => violationService.applyPolicy(v.id));
    const titles = (u: Parameters<typeof isVisibleTo>[1]) => seenBy(events, u);
    expect(titles(HOST)).toContain("Fine issued");
    expect(titles(ADMIN)).toContain("Fine issued");
    expect(titles(DAY)).toEqual([]);
    expect(titles(COND)).toEqual([]);
  });

  it("a DDC referral is visible to the admin only, not even to the student", async () => {
    as(COND);
    const v = await violationService.report({ studentId: HOST.id, type: "Vape / pod found", notes: "pod device found", reportedBy: COND.name, busId: "B05", routeId: "R05" });
    as(ADMIN);
    const events = await capture(() => violationService.applyPolicy(v.id));
    expect(seenBy(events, ADMIN)).toContain("Referred to DDC");
    expect(seenBy(events, HOST)).toEqual([]);
    expect(seenBy(events, DAY)).toEqual([]);
  });

  it("fee approval notifies each student about their own payment only", async () => {
    const submitted = db().fees.filter((f) => f.status === "SUBMITTED");
    const owner = db().students.find((s) => s.id === submitted[0].userId)!;
    const events = await capture(() => financeService.approveFees(submitted.map((f) => f.id)));
    const ownerView = { id: owner.id, role: owner.residence, routeId: owner.routeId } as Parameters<typeof isVisibleTo>[1];
    expect(seenBy(events, ownerView)).toEqual(["Fee approved"]); // exactly one: their own
    expect(seenBy(events, DAY)).toEqual([]); // Ayesha's fee wasn't among them
    expect(events.filter((e) => e.type === "notification.new")).toHaveLength(submitted.length);
  });

  it("a day scholar submitting a fee tells the admin only", async () => {
    as(DAY);
    const events = await capture(() => financeService.submitFee(db().fees.find((f) => f.userId === DAY.id)!.id, { method: "JazzCash", reference: "TXN-123456" }));
    expect(seenBy(events, ADMIN)).toEqual(["Fee payment submitted"]);
    expect(seenBy(events, HOST)).toEqual([]);
    expect(seenBy(events, DAY)).toEqual([]);
  });

  it("registration decisions go to the student concerned only", async () => {
    const pend = db().registrations.filter((r) => r.status === "PENDING");
    const owner = db().students.find((s) => s.id === pend[0].userId)!;
    const events = await capture(() => registrationService.decideMany([pend[0].id], "APPROVED"));
    expect(seenBy(events, { id: owner.id, role: owner.residence, routeId: owner.routeId })).toEqual(["Registration approved"]);
    expect(seenBy(events, HOST)).toEqual([]);
  });

  it("announcements reach only the audience they target (+ admin)", async () => {
    const events = await capture(() => announcementService.publish({ title: "Hostelite notice", body: "Only hostelites should read this.", audience: "HOSTELITE", author: "Transport Office" }));
    expect(seenBy(events, HOST)).toEqual(["Hostelite notice"]);
    expect(seenBy(events, ADMIN)).toEqual(["Hostelite notice"]);
    expect(seenBy(events, DAY)).toEqual([]);
    const ev2 = await capture(() => announcementService.publish({ title: "For everyone", body: "Everybody gets this one.", audience: "ALL", author: "Transport Office" }));
    expect(seenBy(ev2, DAY)).toEqual(["For everyone"]);
    expect(seenBy(ev2, COND)).toEqual(["For everyone"]);
  });

  it("trip start/end is shown to that route's students and the admin, not to other routes", async () => {
    as(COND);
    const events = await capture(() => fleetService.setTrip("B01", false)); // Route 01
    expect(seenBy(events, DAY)).toEqual(["Trip ended"]); // Ayesha is on Route 01
    expect(seenBy(events, HOST)).toEqual([]); // Hamza is on Route 05
    expect(seenBy(events, ADMIN)).toEqual(["Trip ended"]);
  });

  it("the live store drops everything the previous user could see when a new person signs in", () => {
    const s = useRealtimeStore.getState();
    s.addNotification({ id: "N-A", kind: "fine", title: "Fine issued", body: "x", ts: new Date().toISOString(), read: false, audience: to.student(HOST.id) });
    s.resetNotifications(DAY);
    expect(useRealtimeStore.getState().notifications.some((n) => n.id === "N-A")).toBe(false);
    expect(useRealtimeStore.getState().notifications.length).toBeGreaterThan(0); // welcome message is for everyone
  });

  it("ticket / booking notifications are private to the ticket owner", async () => {
    const t = await book(HOST, BUS_HOST);
    db().patch((d) => ({ pricing: { ...d.pricing, freeCancelHours: 9999 } })); // force a late-cancel fee
    as(HOST);
    const events = await capture(() => bookingService.cancel(t.id));
    expect(seenBy(events, HOST)).toContain("Fine issued");
    expect(seenBy(events, DAY)).toEqual([]);
  });
});
