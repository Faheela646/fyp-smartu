import type {
  Announcement, Bus, Driver, FeeItem, Fine, HostelBill, Pricing, Registration, ScanLog, Schedule, Student, ViolationAction, ViolationReport, ViolationType, TransportRoute,
} from "@/types/api";
import { simulator } from "@/demo/simulator";
import { uid, useDemoDB } from "@/demo/db";
import { to } from "@/lib/audience";
import { buildDdcMail, decidePolicy, priorOffences, type PolicyDecision } from "@/lib/policy";
import { parseTicketQr } from "@/lib/ticketQr";
import type { StudentInput } from "@/lib/csv";
import { DEMO_MODE } from "./wsClient";
import { http, wait } from "./http";
import { notify } from "./notify";
import { assertOwnerOr, currentUser, Forbidden, requireRole, requireStudent, scopeUserId } from "./rbac";
import { sweepTickets } from "./bookings";

const db = () => useDemoDB.getState();
const lag = (ms = 100) => wait(ms);

/** Pick demo or real implementation. */
async function run<T>(demo: () => T | Promise<T>, real: () => Promise<T>, ms = 100): Promise<T> {
  if (!DEMO_MODE) return real();
  await lag(ms);
  return demo();
}

/* ---------------- Students ---------------- */
export const studentService = {
  /** Staff only: the full student list. Students use `me()`. */
  list: () => run(() => { requireRole("ADMIN", "CONDUCTOR"); return db().students; }, async () => (await http.get<Student[]>("/students")).data),
  me: () => run(() => { const u = requireStudent(); return db().students.find((s) => s.id === u.id) ?? null; }, async () => (await http.get<Student>("/students/me")).data),
  save: (s: Student) =>
    run(
      () => {
        requireRole("ADMIN");
        const dup = db().students.find((x) => x.id !== s.id && x.rollNo.toLowerCase() === s.rollNo.toLowerCase());
        if (dup) throw new Error(`Roll number ${s.rollNo} already belongs to ${dup.name}.`);
        db().patch((d) => ({ students: d.students.some((x) => x.id === s.id) ? d.students.map((x) => (x.id === s.id ? s : x)) : [s, ...d.students] }));
        return s;
      },
      async () => (await http.put<Student>(`/students/${s.id}`, s)).data,
    ),
  /** Bulk add: existing roll numbers are skipped, never overwritten. */
  bulkAdd: (rows: StudentInput[]) =>
    run(
      () => {
        requireRole("ADMIN");
        const have = new Set(db().students.map((s) => s.rollNo.toUpperCase()));
        const fresh: Student[] = [];
        const skipped: string[] = [];
        rows.forEach((r) => {
          if (have.has(r.rollNo.toUpperCase())) return void skipped.push(r.rollNo);
          have.add(r.rollNo.toUpperCase());
          const route = db().routes.find((x) => x.id === r.routeId);
          fresh.push({ id: uid("U"), status: "ACTIVE", stopId: route?.stops[0]?.id, ...r });
        });
        db().patch((d) => ({ students: [...fresh, ...d.students] }));
        return { added: fresh.length, skipped };
      },
      async () => (await http.post<{ added: number; skipped: string[] }>("/students/bulk", { rows })).data,
      200,
    ),
  setBan: (id: string, banned: boolean, reason?: string) =>
    run(
      () => {
        requireRole("ADMIN");
        db().patch((d) => ({ students: d.students.map((x) => (x.id === id ? { ...x, status: banned ? "BANNED" : "ACTIVE", banReason: banned ? reason : undefined } : x)) }));
      },
      async () => void (await http.post(`/students/${id}/${banned ? "ban" : "unban"}`, { reason })),
    ),
};

/* ---------------- Fees, fines, billing, pricing ---------------- */
export const financeService = {
  /** Admin: anyone's. A student: only their own. */
  listFees: (userId?: string) =>
    run<FeeItem[]>(() => { const id = scopeUserId(userId, "ADMIN"); return db().fees.filter((f) => !id || f.userId === id); }, async () => (await http.get<FeeItem[]>("/fees", { params: { userId } })).data),

  /** Pay your own fee instantly (non-day-scholar fee items). */
  payFee: (id: string, method: string) =>
    run(
      () => {
        const fee = db().fees.find((f) => f.id === id);
        if (!fee) throw new Error("Fee not found.");
        assertOwnerOr(fee.userId);
        db().patch((d) => ({ fees: d.fees.map((f) => (f.id === id ? { ...f, status: "PAID" as const, paidAt: new Date().toISOString(), method } : f)) }));
        notify("Payment received", "Your transport fee payment was recorded. Thank you.", "fee", to.student(fee.userId));
      },
      async () => void (await http.post(`/fees/${id}/pay`, { method })),
      200,
    ),

  /** Day scholars submit payment details; an admin then approves or rejects. */
  submitFee: (id: string, v: { method: string; reference: string }) =>
    run(
      () => {
        const fee = db().fees.find((f) => f.id === id);
        if (!fee) throw new Error("Fee not found.");
        assertOwnerOr(fee.userId);
        const ref = v.reference.trim();
        if (ref.length < 4) throw new Error("Enter the transaction / challan reference from your payment receipt.");
        if (fee.status === "PAID" || fee.status === "SUBMITTED") throw new Error("This fee is already submitted or paid.");
        db().patch((d) => ({ fees: d.fees.map((f) => (f.id === id ? { ...f, status: "SUBMITTED" as const, method: v.method, reference: ref, submittedAt: new Date().toISOString(), rejectReason: undefined } : f)) }));
        const st = db().students.find((s) => s.id === fee.userId);
        notify("Fee payment submitted", `${st?.name ?? "A student"} (${st?.rollNo ?? ""}) submitted a semester fee payment for approval.`, "fee", to.admin);
        return { ...fee, status: "SUBMITTED" as const, reference: ref };
      },
      async () => (await http.post<FeeItem>(`/fees/${id}/submit`, v)).data,
      200,
    ),
  approveFees: (ids: string[]) =>
    run(
      () => {
        requireRole("ADMIN");
        const set = new Set(ids);
        const done = db().fees.filter((f) => set.has(f.id) && f.status === "SUBMITTED");
        db().patch((d) => ({ fees: d.fees.map((f) => (set.has(f.id) && f.status === "SUBMITTED" ? { ...f, status: "PAID" as const, paidAt: new Date().toISOString() } : f)) }));
        // Each student is told about their own payment only.
        done.forEach((f) => notify("Fee approved", "Your semester transport fee payment was approved by the Transport Office.", "fee", to.student(f.userId)));
        return done.length;
      },
      async () => (await http.post<{ approved: number }>("/fees/approve", { ids })).data.approved,
    ),
  rejectFee: (id: string, reason: string) =>
    run(
      () => {
        requireRole("ADMIN");
        if (reason.trim().length < 3) throw new Error("Give a short reason so the student can fix and resubmit.");
        const fee = db().fees.find((f) => f.id === id && f.status === "SUBMITTED");
        db().patch((d) => ({ fees: d.fees.map((f) => (f.id === id && f.status === "SUBMITTED" ? { ...f, status: "REJECTED" as const, rejectReason: reason.trim() } : f)) }));
        if (fee) notify("Fee payment rejected", `Your submission was rejected: ${reason.trim()}`, "fee", to.student(fee.userId));
      },
      async () => void (await http.post(`/fees/${id}/reject`, { reason })),
    ),

  listFines: (userId?: string) =>
    run<Fine[]>(() => { const id = scopeUserId(userId, "ADMIN"); return db().fines.filter((f) => !id || f.userId === id); }, async () => (await http.get<Fine[]>("/fines", { params: { userId } })).data),
  payFine: (id: string, method: string) =>
    run(
      () => {
        const fine = db().fines.find((f) => f.id === id);
        if (!fine) throw new Error("Fine not found.");
        assertOwnerOr(fine.userId);
        db().patch((d) => ({ fines: d.fines.map((f) => (f.id === id ? { ...f, status: "PAID" as const } : f)) }));
      },
      async () => void (await http.post(`/fines/${id}/pay`, { method })),
      200,
    ),
  issueFine: (f: { userId: string; reason: string; amount: number; issuedBy: string }) =>
    run(
      () => {
        requireRole("ADMIN");
        const st = db().students.find((s) => s.id === f.userId);
        const fine: Fine = { id: uid("FN"), userId: f.userId, studentName: st?.name ?? "Student", reason: f.reason, amount: f.amount, date: new Date().toISOString(), status: "UNPAID", issuedBy: f.issuedBy };
        db().patch((d) => ({ fines: [fine, ...d.fines] }));
        notify("Fine issued", `${f.reason}: Rs. ${f.amount}`, "fine", to.student(f.userId));
        return fine;
      },
      async () => (await http.post<Fine>("/fines", f)).data,
    ),
  waiveFine: (id: string) =>
    run(() => { requireRole("ADMIN"); db().patch((d) => ({ fines: d.fines.map((f) => (f.id === id ? { ...f, status: "WAIVED" as const } : f)) })); }, async () => void (await http.post(`/fines/${id}/waive`))),

  /** Hostelite monthly bills: admin sees all, a hostelite only their own. */
  listBills: (studentId?: string) =>
    run<HostelBill[]>(() => { const id = scopeUserId(studentId, "ADMIN"); return db().bills.filter((b) => !id || b.studentId === id); }, async () => (await http.get<HostelBill[]>("/hostel-bills", { params: { studentId } })).data),
  /** A hostelite pays their own monthly bill. */
  payBill: (id: string, method: string) =>
    run(
      () => {
        const bill = db().bills.find((b) => b.id === id);
        if (!bill) throw new Error("Bill not found.");
        assertOwnerOr(bill.studentId);
        db().patch((d) => ({ bills: d.bills.map((b) => (b.id === id ? { ...b, status: "PAID" as const } : b)) }));
        notify("Payment received", `Your ${bill.month} transport bill was recorded as paid.`, "fee", to.student(bill.studentId));
        void method;
      },
      async () => void (await http.post(`/hostel-bills/${id}/pay`, { method })),
      200,
    ),
  markBillPaid: (id: string) =>
    run(() => { requireRole("ADMIN"); db().patch((d) => ({ bills: d.bills.map((b) => (b.id === id ? { ...b, status: "PAID" as const } : b)) })); }, async () => void (await http.post(`/hostel-bills/${id}/paid`))),
  getPricing: () => run<Pricing>(() => { currentUser(); return db().pricing; }, async () => (await http.get<Pricing>("/pricing")).data, 60),
  savePricing: (p: Pricing) => run(() => { requireRole("ADMIN"); db().patch(() => ({ pricing: p })); }, async () => void (await http.put("/pricing", p))),
};

/* ---------------- Drivers (employee records only: no login) ---------------- */
export const driverService = {
  /** Admin: full records. */
  list: () => run<Driver[]>(() => { requireRole("ADMIN"); return db().drivers; }, async () => (await http.get<Driver[]>("/drivers")).data),
  /** Everyone signed in: just name + phone of the driver on each bus (no address / licence). */
  listPublic: () =>
    run<Pick<Driver, "id" | "name" | "phone" | "busId">[]>(
      () => { currentUser(); return db().drivers.map(({ id, name, phone, busId }) => ({ id, name, phone, busId })); },
      async () => (await http.get<Pick<Driver, "id" | "name" | "phone" | "busId">[]>("/drivers/public")).data,
    ),
  save: (d: Driver) =>
    run(
      () => {
        requireRole("ADMIN");
        if (d.busId) {
          const other = db().drivers.find((x) => x.id !== d.id && x.busId === d.busId);
          if (other) db().patch((s) => ({ drivers: s.drivers.map((x) => (x.id === other.id ? { ...x, busId: undefined } : x)) }));
        }
        db().patch((s) => ({ drivers: s.drivers.some((x) => x.id === d.id) ? s.drivers.map((x) => (x.id === d.id ? d : x)) : [...s.drivers, d] }));
        return d;
      },
      async () => (await http.put<Driver>(`/drivers/${d.id}`, d)).data,
    ),
  remove: (id: string) => run(() => { requireRole("ADMIN"); db().patch((s) => ({ drivers: s.drivers.filter((d) => d.id !== id) })); }, async () => void (await http.delete(`/drivers/${id}`))),
};

/* ---------------- Fleet: buses, routes, schedules, trips ---------------- */
export const fleetService = {
  listBuses: () => run<Bus[]>(() => { currentUser(); return db().buses; }, async () => (await http.get<Bus[]>("/buses")).data, 40),
  saveBus: (b: Bus) =>
    run(() => { requireRole("ADMIN"); db().patch((d) => ({ buses: d.buses.some((x) => x.id === b.id) ? d.buses.map((x) => (x.id === b.id ? b : x)) : [...d.buses, b] })); }, async () => void (await http.put(`/buses/${b.id}`, b))),
  deleteBus: (id: string) =>
    run(() => { requireRole("ADMIN"); db().patch((d) => ({ buses: d.buses.filter((b) => b.id !== id), drivers: d.drivers.map((x) => (x.busId === id ? { ...x, busId: undefined } : x)) })); }, async () => void (await http.delete(`/buses/${id}`))),
  listRoutes: () => run<TransportRoute[]>(() => { currentUser(); return db().routes; }, async () => (await http.get<TransportRoute[]>("/routes")).data, 40),
  saveRoute: (r: TransportRoute) =>
    run(() => { requireRole("ADMIN"); db().patch((d) => ({ routes: d.routes.some((x) => x.id === r.id) ? d.routes.map((x) => (x.id === r.id ? r : x)) : [...d.routes, r] })); }, async () => void (await http.put(`/routes/${r.id}`, r))),
  deleteRoute: (id: string) => run(() => { requireRole("ADMIN"); db().patch((d) => ({ routes: d.routes.filter((r) => r.id !== id) })); }, async () => void (await http.delete(`/routes/${id}`))),
  listSchedules: () => run<Schedule[]>(() => { currentUser(); return db().schedules; }, async () => (await http.get<Schedule[]>("/schedules")).data),
  saveSchedule: (s: Schedule) =>
    run(() => { requireRole("ADMIN"); db().patch((d) => ({ schedules: d.schedules.some((x) => x.id === s.id) ? d.schedules.map((x) => (x.id === s.id ? s : x)) : [s, ...d.schedules] })); }, async () => void (await http.put(`/schedules/${s.id}`, s))),
  deleteSchedule: (id: string) => run(() => { requireRole("ADMIN"); db().patch((d) => ({ schedules: d.schedules.filter((s) => s.id !== id) })); }, async () => void (await http.delete(`/schedules/${id}`))),

  /** A conductor starts / ends the trip of THEIR bus (the admin may do it for any bus). */
  setTrip: (busId: string, active: boolean) =>
    run(
      () => {
        const u = requireRole("CONDUCTOR", "ADMIN");
        const bus = db().buses.find((b) => b.id === busId);
        if (u.role === "CONDUCTOR" && bus && u.routeId !== bus.routeId) throw new Forbidden("You can only start or end the trip of your own bus.");
        db().patch((d) => ({ tripActive: { ...d.tripActive, [busId]: active } }));
        simulator.setTrip(busId, active);
        const route = db().routes.find((r) => r.id === bus?.routeId);
        notify(active ? "Trip started" : "Trip ended", `${route?.name ?? "Bus"} (${bus?.plate ?? busId}) ${active ? "has started its trip." : "has ended its trip."}`, "system", to.route(bus?.routeId ?? ""));
      },
      async () => void (await http.post(`/trips/${busId}/${active ? "start" : "end"}`)),
      120,
    ),
  /** Conductor's phone location → live bus position. */
  pushGps: (busId: string, p: { lat: number; lng: number; speedKmh: number; heading: number }) =>
    run(() => { requireRole("CONDUCTOR", "ADMIN"); simulator.pushExternal(busId, p); }, async () => void (await http.post("/gps", { busId, ...p })), 0),
  setGpsSharing: (busId: string, on: boolean) => (DEMO_MODE ? simulator.setExternal(busId, on) : undefined),
};

/* ---------------- Announcements, settings ---------------- */
export const announcementService = {
  /** Students only get announcements aimed at them; the admin sees all. */
  list: () =>
    run<Announcement[]>(
      () => {
        const u = currentUser();
        return [...db().announcements]
          .filter((a) => u.role === "ADMIN" || a.audience === "ALL" || a.audience === u.role)
          .sort((a, b) => b.ts.localeCompare(a.ts));
      },
      async () => (await http.get<Announcement[]>("/announcements")).data,
    ),
  publish: (a: Omit<Announcement, "id" | "ts">) =>
    run(
      () => {
        requireRole("ADMIN");
        const item: Announcement = { ...a, id: uid("AN"), ts: new Date().toISOString() };
        db().patch((d) => ({ announcements: [item, ...d.announcements] }));
        notify(item.title, item.body, "announcement", to.announcement(item.audience));
        return item;
      },
      async () => (await http.post<Announcement>("/announcements", a)).data,
    ),
  remove: (id: string) => run(() => { requireRole("ADMIN"); db().patch((d) => ({ announcements: d.announcements.filter((a) => a.id !== id) })); }, async () => void (await http.delete(`/announcements/${id}`))),
};

export const settingsService = {
  getBookingEnabled: () => run(() => { currentUser(); return db().bookingEnabled; }, async () => (await http.get<{ enabled: boolean }>("/settings/booking")).data.enabled, 40),
  setBookingEnabled: (enabled: boolean) =>
    run(
      () => {
        requireRole("ADMIN");
        db().patch(() => ({ bookingEnabled: enabled }));
        simulator.broadcast({ type: "booking.toggled", payload: { enabled } });
        notify(enabled ? "Ticket booking is open" : "Ticket booking paused", enabled ? "You can book tickets again." : "Ticket booking is temporarily disabled by the Transport Office.", "system", to.roles("HOSTELITE", "DAY_SCHOLAR", "FACULTY", "ADMIN"));
      },
      async () => void (await http.put("/settings/booking", { enabled })),
    ),
};

/* ---------------- Conductor: scanning tickets, manual attendance ---------------- */
export interface ScanOutcome {
  ok: boolean;
  title: string;
  detail: string;
  student?: Student;
  seat?: string;
  /** e.g. "Boarding 1 of 2" */
  legText?: string;
}

export const scanService = {
  async scan(raw: string, busId: string, conductor: string): Promise<ScanOutcome> {
    if (!DEMO_MODE) return (await http.post<ScanOutcome>("/scans", { raw, busId })).data;
    await lag(60);
    requireRole("CONDUCTOR", "ADMIN");
    sweepTickets();
    const d = db();
    const routeNumber = d.buses.find((b) => b.id === busId)?.routeId.slice(1);
    const log = (s: Student | undefined, result: ScanLog["result"], reason?: string, extra?: Partial<ScanLog>) =>
      d.patch((x) => ({ scanLogs: [{ id: uid("SC"), ts: new Date().toISOString(), studentId: s?.id ?? "?", studentName: s?.name ?? "Unknown", rollNo: s?.rollNo ?? "-", busId, routeNumber, result, reason, conductor, ...extra }, ...x.scanLogs] }));

    if (!d.tripActive[busId]) return { ok: false, title: "Trip not started", detail: "Start the trip before scanning passengers." };
    const qr = parseTicketQr(raw);
    if (!qr) return { ok: false, title: "Invalid QR code", detail: "This isn't a SmartU ticket QR." };
    const bk = d.bookings.find((b) => b.id === qr.tid && b.userId === qr.sid);
    const st = d.students.find((s) => s.id === qr.sid);
    if (!bk || !st) { log(st, "FAILED", "Ticket not found"); return { ok: false, title: "Ticket not found", detail: "No ticket matches this QR. The student needs to book one.", student: st }; }
    if (Date.now() - qr.ts > 5 * 60_000) { log(st, "FAILED", "Stale QR", { bookingId: bk.id }); return { ok: false, title: "QR expired", detail: "Ask the student to reopen their ticket to refresh the code.", student: st }; }
    if (st.status === "BANNED") { log(st, "FAILED", "Student banned", { bookingId: bk.id }); return { ok: false, title: "Boarding not allowed", detail: `Account suspended: ${st.banReason ?? "see Transport Office"}.`, student: st }; }
    if (bk.status === "EXPIRED") { log(st, "FAILED", "Ticket expired", { bookingId: bk.id }); return { ok: false, title: "Ticket expired", detail: `Tickets are disposed ${d.pricing.ticketValidHours} h after the trip starts. The student must book again.`, student: st }; }
    if (bk.status === "USED") { log(st, "FAILED", "Ticket already used", { bookingId: bk.id }); return { ok: false, title: "Ticket already used", detail: "All boardings on this ticket are used up. The student must book again.", student: st }; }
    if (bk.status === "CANCELLED") { log(st, "FAILED", "Ticket cancelled", { bookingId: bk.id }); return { ok: false, title: "Ticket cancelled", detail: "This ticket was cancelled.", student: st }; }
    if (bk.busId !== busId) {
      log(st, "FAILED", "Ticket is for a different bus", { bookingId: bk.id });
      return { ok: false, title: "Wrong bus", detail: `This ticket is for Route ${bk.routeNumber} (${bk.plate}).`, student: st };
    }
    const last = d.scanLogs.find((l) => l.bookingId === bk.id && l.result === "SUCCESS");
    if (last && Date.now() - new Date(last.ts).getTime() < d.pricing.legGapMinutes * 60_000) {
      return { ok: false, title: "Already scanned", detail: "This ticket was scanned a moment ago.", student: st };
    }
    const leg = bk.usesDone + 1;
    const finished = leg >= bk.usesAllowed;
    d.patch((x) => ({ bookings: x.bookings.map((b) => (b.id === bk.id ? { ...b, usesDone: leg, status: finished ? ("USED" as const) : b.status } : b)) }));
    log(st, "SUCCESS", undefined, { bookingId: bk.id, leg, legs: bk.usesAllowed });
    const seat = bk.type === "SEAT" ? `Seat ${bk.seatNo ?? "-"}` : "Standing";
    const legText = bk.usesAllowed === 1 ? "One-way ticket: used, now disposed" : finished ? "Boarding 2 of 2: ticket now disposed" : "Boarding 1 of 2: return trip still valid";
    if (finished) notify("Ticket used", `Your ${bk.routeName} ticket is fully used. Book again for your next trip.`, "booking", to.student(bk.userId));
    return { ok: true, title: "Boarding confirmed", detail: `${st.name} (${st.rollNo})`, student: st, seat, legText };
  },

  manual: (studentId: string, busId: string, conductor: string) =>
    run(
      () => {
        requireRole("CONDUCTOR", "ADMIN");
        const st = db().students.find((s) => s.id === studentId);
        if (!st) throw new Error("Student not found.");
        const routeNumber = db().buses.find((b) => b.id === busId)?.routeId.slice(1);
        db().patch((x) => ({ scanLogs: [{ id: uid("SC"), ts: new Date().toISOString(), studentId: st.id, studentName: st.name, rollNo: st.rollNo, busId, routeNumber, result: "MANUAL" as const, reason: "Marked manually by conductor", conductor }, ...x.scanLogs] }));
        return st;
      },
      async () => (await http.post<Student>("/scans/manual", { studentId, busId })).data,
    ),
  /** Staff: every boarding. */
  logs: () => run<ScanLog[]>(() => { requireRole("ADMIN", "CONDUCTOR"); return db().scanLogs; }, async () => (await http.get<ScanLog[]>("/scans")).data),
  /** A student's own boardings (each time they boarded). */
  myLogs: () =>
    run<ScanLog[]>(
      () => { const u = requireStudent(); return db().scanLogs.filter((l) => l.studentId === u.id && l.result !== "FAILED"); },
      async () => (await http.get<ScanLog[]>("/scans/mine")).data,
    ),
};

/* ---------------- Violations: conductor report → admin policy ---------------- */
export const violationService = {
  /** Admin sees all; a conductor only the reports they filed. */
  list: () =>
    run<ViolationReport[]>(
      () => {
        const u = requireRole("ADMIN", "CONDUCTOR");
        return [...db().violations].filter((v) => u.role === "ADMIN" || v.reportedBy === u.name).sort((a, b) => b.ts.localeCompare(a.ts));
      },
      async () => (await http.get<ViolationReport[]>("/violations")).data,
    ),

  report: (v: { studentId: string; type: ViolationType; notes: string; reportedBy: string; busId: string; routeId?: string }) =>
    run(
      () => {
        requireRole("CONDUCTOR", "ADMIN");
        const st = db().students.find((s) => s.id === v.studentId);
        if (!st) throw new Error("Student not found.");
        const route = db().routes.find((r) => r.id === (v.routeId ?? db().buses.find((b) => b.id === v.busId)?.routeId));
        const plate = db().buses.find((b) => b.id === v.busId)?.plate;
        const rec: ViolationReport = {
          id: uid("VR"), studentId: st.id, studentName: st.name, rollNo: st.rollNo, type: v.type, notes: v.notes, reportedBy: v.reportedBy,
          busId: v.busId, routeId: route?.id, routeNumber: route?.number, plate, ts: new Date().toISOString(), status: "OPEN",
        };
        db().patch((d) => ({ violations: [rec, ...d.violations] }));
        notify("Violation reported", `${st.name} (${st.rollNo}), Route ${route?.number ?? "?"}: ${v.type}`, "system", to.admin);
        return rec;
      },
      async () => (await http.post<ViolationReport>("/violations", v)).data,
    ),

  /** What the policy says should happen for this report (does not change anything). */
  preview: (id: string): PolicyDecision => {
    requireRole("ADMIN");
    const d = db();
    const v = d.violations.find((x) => x.id === id);
    if (!v) throw new Error("Report not found.");
    return decidePolicy(v.type, priorOffences(d.violations, v.studentId, v.id), d.pricing);
  },

  /** Apply the policy: fine for 1st/2nd offence, DDC referral for 3rd+ or vape/pod. */
  applyPolicy: (id: string) =>
    run(
      () => {
        requireRole("ADMIN");
        const d = db();
        const v = d.violations.find((x) => x.id === id);
        if (!v) throw new Error("Report not found.");
        if (v.status !== "OPEN") throw new Error("This report was already handled.");
        const dec = decidePolicy(v.type, priorOffences(d.violations, v.studentId, v.id), d.pricing);
        return violationService.decide(v, dec.action, dec.offenceNo, dec.amount);
      },
      async () => (await http.post<ViolationReport>(`/violations/${id}/apply-policy`)).data,
    ),

  /** Admin override: custom fine amount, or DDC referral, regardless of the ladder. */
  override: (id: string, action: "FINED" | "DDC", amount?: number) =>
    run(
      () => {
        requireRole("ADMIN");
        const d = db();
        const v = d.violations.find((x) => x.id === id);
        if (!v) throw new Error("Report not found.");
        if (v.status !== "OPEN") throw new Error("This report was already handled.");
        if (action === "FINED" && (!amount || amount < 1)) throw new Error("Enter a valid fine amount.");
        return violationService.decide(v, action, priorOffences(d.violations, v.studentId, v.id) + 1, amount);
      },
      async () => (await http.post<ViolationReport>(`/violations/${id}/decision`, { action, amount })).data,
    ),

  dismiss: (id: string) =>
    run(() => { requireRole("ADMIN"); db().patch((d) => ({ violations: d.violations.map((v) => (v.id === id ? { ...v, status: "RESOLVED" as const, action: "DISMISSED" as ViolationAction } : v)) })); }, async () => void (await http.post(`/violations/${id}/dismiss`))),

  ddcMail: (id: string) => {
    requireRole("ADMIN");
    const d = db();
    const v = d.violations.find((x) => x.id === id);
    if (!v) throw new Error("Report not found.");
    return buildDdcMail(v, d.violations, d.pricing.ddcEmail);
  },

  /** Internal: write the decision (fine record / DDC escalation). */
  decide(v: ViolationReport, action: "FINED" | "DDC", offenceNo: number, amount?: number): ViolationReport {
    const d = db();
    let updated: ViolationReport;
    if (action === "FINED") {
      const fine: Fine = { id: uid("FN"), userId: v.studentId, studentName: v.studentName, reason: `${v.type} (offence #${offenceNo})`, amount: amount!, date: new Date().toISOString(), status: "UNPAID", issuedBy: "Transport Office" };
      updated = { ...v, status: "RESOLVED", action, fineAmount: amount, offenceNo };
      d.patch((s) => ({ fines: [fine, ...s.fines], violations: s.violations.map((x) => (x.id === v.id ? updated : x)) }));
      // Only the fined student (and the admin) hear about it, never other students.
      notify("Fine issued", `${v.type}: Rs. ${amount}`, "fine", to.student(v.studentId, true));
    } else {
      updated = { ...v, status: "ESCALATED", action, offenceNo };
      d.patch((s) => ({ violations: s.violations.map((x) => (x.id === v.id ? updated : x)) }));
      notify("Referred to DDC", `${v.studentName} (${v.rollNo}) was referred to the DDC.`, "system", to.admin);
    }
    return updated;
  },
};

/* ---------------- Registration (day scholars only) ---------------- */
export const registrationService = {
  list: (userId?: string) =>
    run<Registration[]>(() => { const id = scopeUserId(userId, "ADMIN"); return db().registrations.filter((r) => !id || r.userId === id); }, async () => (await http.get<Registration[]>("/registrations", { params: { userId } })).data),
  submit: (r: Omit<Registration, "id" | "status" | "submittedAt">) =>
    run(
      () => {
        const u = requireStudent();
        if (u.role === "HOSTELITE") throw new Forbidden("Hostelites don't need to register for the semester.");
        if (r.userId !== u.id) throw new Forbidden("You can only register yourself.");
        const rec: Registration = { ...r, id: uid("RG"), status: "PENDING", submittedAt: new Date().toISOString() };
        db().patch((d) => ({ registrations: [rec, ...d.registrations] }));
        return rec;
      },
      async () => (await http.post<Registration>("/registrations", r)).data,
      200,
    ),
  decide: (id: string, status: "APPROVED" | "REJECTED") => registrationService.decideMany([id], status),
  /** Single or bulk approve / reject. Only PENDING items change; each student is told about their own application only. */
  decideMany: (ids: string[], status: "APPROVED" | "REJECTED") =>
    run(
      () => {
        requireRole("ADMIN");
        const set = new Set(ids);
        const changed = db().registrations.filter((r) => set.has(r.id) && r.status === "PENDING");
        db().patch((d) => ({ registrations: d.registrations.map((r) => (set.has(r.id) && r.status === "PENDING" ? { ...r, status } : r)) }));
        changed.forEach((r) => notify(`Registration ${status === "APPROVED" ? "approved" : "rejected"}`, `Your ${r.semester} transport registration was ${status.toLowerCase()}.`, "system", to.student(r.userId)));
        return changed.length;
      },
      async () => (await http.post<{ changed: number }>("/registrations/decide", { ids, status })).data.changed,
    ),
};

