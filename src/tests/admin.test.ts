import { describe, expect, it } from "vitest";
import { simulator } from "@/demo/simulator";
import { announcementService, driverService, financeService, fleetService, registrationService, settingsService, studentService, violationService } from "@/services/ops";
import { buildChallanPdf, challanFor, amountInWords, challanNo } from "@/lib/challan";
import { buildDdcMail, decidePolicy } from "@/lib/policy";
import { parseStudentsCsv, STUDENT_CSV_TEMPLATE } from "@/lib/csv";
import type { Student } from "@/types/api";
import { ADMIN, BUS_HOST, COND, DAY, HOST, as, book, capture, db } from "./helpers";

const pricing = { firstOffenceFine: 1000, secondOffenceFine: 5000 };
const ROUTES = db().routes.map((r) => r.id);

/** Reports a violation as the conductor and returns the stored record (then switches back to admin). */
async function report(studentId: string, type: Parameters<typeof violationService.report>[0]["type"] = "No QR / pass", routeId = "R01") {
  as(COND);
  const v = await violationService.report({ studentId, type, notes: "test report from conductor", reportedBy: COND.name, busId: "B01", routeId });
  as(ADMIN);
  return v;
}

describe("ADMIN: students (single add, bulk add, ban)", () => {
  const input: Student = { id: "U-NEW", rollNo: "24F-3101", name: "Ayesha Noor", email: "a@x.pk", phone: "0300-1234567", residence: "DAY_SCHOLAR", routeId: "R01", status: "ACTIVE" };

  it("adds a single student", async () => {
    await studentService.save(input);
    expect(db().students.find((s) => s.id === "U-NEW")?.name).toBe("Ayesha Noor");
  });
  it("rejects a duplicate roll number", async () => {
    await studentService.save(input);
    await expect(studentService.save({ ...input, id: "U-OTHER" })).rejects.toThrow(/already belongs/);
  });
  it("edits an existing student", async () => {
    await studentService.save(input);
    await studentService.save({ ...input, name: "Ayesha N." });
    expect(db().students.filter((s) => s.id === "U-NEW")).toHaveLength(1);
    expect(db().students.find((s) => s.id === "U-NEW")?.name).toBe("Ayesha N.");
  });
  it("bulk add: parses CSV, flags bad rows, skips duplicates", async () => {
    const csv = `${STUDENT_CSV_TEMPLATE}Bad Row,XX,not-an-email,1,alien,R99\nDup Person,22F-3082,d@x.pk,0300-0000000,day,R01\n`;
    const rows = parseStudentsCsv(csv, ROUTES);
    expect(rows.filter((r) => r.data)).toHaveLength(3);
    const bad = rows.find((r) => r.error);
    expect(bad?.error).toMatch(/roll no/);
    expect(bad?.error).toMatch(/email/);
    expect(bad?.error).toMatch(/unknown route/);
    const before = db().students.length;
    const res = await studentService.bulkAdd(rows.filter((r) => r.data).map((r) => r.data!));
    expect(res.added).toBe(2);
    expect(res.skipped).toEqual(["22F-3082"]);
    expect(db().students).toHaveLength(before + 2);
    expect(db().students.find((s) => s.rollNo === "22F-3082")?.name).toBe("Ayesha Khan");
  });
  it("bulk add: duplicates inside the file are flagged", () => {
    const rows = parseStudentsCsv("a Name,24F-3101,a@x.pk,0300-1234567,day,R01\nb Name,24F-3101,b@x.pk,0300-1234567,day,R01", ROUTES);
    expect(rows[1].error).toMatch(/duplicate/);
  });
  it("ban and lift ban", async () => {
    await studentService.setBan("U-3082", true, "Test");
    expect(db().students.find((s) => s.id === "U-3082")?.status).toBe("BANNED");
    await studentService.setBan("U-3082", false);
    expect(db().students.find((s) => s.id === "U-3082")?.status).toBe("ACTIVE");
  });
});

describe("ADMIN: fee challans (FLEX style): semester for day scholars, monthly for hostelites", () => {
  const day = () => db().students.find((s) => s.id === "U-3082")!;
  const host = () => db().students.find((s) => s.id === "U-3091")!;
  const make = (s: Student) => challanFor(s, db().fees, db().bills, db().routes, db().pricing);

  it("day scholar gets a SEMESTER challan with route number, pick-up stop and time from the university timetable", () => {
    const c = make(day());
    expect(c).toMatchObject({ kind: "SEMESTER", rollNo: "22F-3082", period: "Fall 2026", amount: 14000, routeNumber: "01" });
    expect(c.challanNo).toBe("TC-FALL2026-22F-3082");
    expect(c.pickup).not.toBe("");
    expect(c.pickupTime).toMatch(/^\d{2}:\d{2}$/);
  });
  it("hostelite gets a MONTHLY challan built from that month's bill", async () => {
    await book(HOST, BUS_HOST, { tripType: "TWO_WAY" }); // Rs. 300 on this month's bill (or next month's, if booked across a month end)
    const key = db().bookings[0].date.slice(0, 7);
    const c = challanFor(host(), db().fees, db().bills, db().routes, db().pricing, { monthKey: key });
    expect(c.kind).toBe("MONTHLY");
    expect(c.amount).toBe(300);
    expect(c.challanNo.startsWith("TM-")).toBe(true);
    expect(c.detail).toMatch(/2 seat trip/);
    expect(c.routeNumber).toBe("05");
  });
  it("builds one landscape page per student", async () => {
    const items = [day(), host(), db().students[2]].map(make);
    const pdf = await buildChallanPdf(items);
    expect(pdf.getNumberOfPages()).toBe(3);
    expect(pdf.internal.pageSize.getWidth()).toBeGreaterThan(pdf.internal.pageSize.getHeight());
  });
  it("amount in words and challan numbers", () => {
    expect(amountInWords(14000)).toBe("Fourteen Thousand Rupees Only");
    expect(amountInWords(125500)).toBe("One Lakh Twenty Five Thousand Five Hundred Rupees Only");
    expect(challanNo("22F-3091", "October 2026", "MONTHLY")).toBe("TM-OCTOBER2026-22F-3091");
  });
});

describe("ADMIN: fee approvals (day-scholar semester fee)", () => {
  const myFee = () => db().fees.find((f) => f.userId === "U-3082")!;
  it("day scholar submits payment → Submitted; admin sees it", async () => {
    as(DAY);
    await financeService.submitFee(myFee().id, { method: "JazzCash", reference: "TXN-900001" });
    expect(myFee().status).toBe("SUBMITTED");
    expect(myFee().reference).toBe("TXN-900001");
  });
  it("requires a real reference", async () => {
    as(DAY);
    await expect(financeService.submitFee(myFee().id, { method: "JazzCash", reference: "ab" })).rejects.toThrow(/reference/);
    expect(myFee().status).toBe("UNPAID");
  });
  it("cannot submit twice", async () => {
    as(DAY);
    await financeService.submitFee(myFee().id, { method: "Bank transfer", reference: "TXN-900002" });
    await expect(financeService.submitFee(myFee().id, { method: "Bank transfer", reference: "TXN-900003" })).rejects.toThrow(/already/);
  });
  it("admin approves one → Paid", async () => {
    as(DAY);
    await financeService.submitFee(myFee().id, { method: "JazzCash", reference: "TXN-900004" });
    as(ADMIN);
    expect(await financeService.approveFees([myFee().id])).toBe(1);
    expect(myFee().status).toBe("PAID");
    expect(myFee().paidAt).toBeTruthy();
  });
  it("bulk approve approves every submitted item and ignores others", async () => {
    const submitted = db().fees.filter((f) => f.status === "SUBMITTED").map((f) => f.id);
    expect(submitted.length).toBeGreaterThanOrEqual(2);
    const unpaid = db().fees.find((f) => f.status === "UNPAID")!;
    const n = await financeService.approveFees([...submitted, unpaid.id]);
    expect(n).toBe(submitted.length);
    expect(db().fees.find((f) => f.id === unpaid.id)?.status).toBe("UNPAID");
    expect(db().fees.filter((f) => submitted.includes(f.id)).every((f) => f.status === "PAID")).toBe(true);
  });
  it("reject needs a reason, then student can resubmit", async () => {
    as(DAY);
    await financeService.submitFee(myFee().id, { method: "EasyPaisa", reference: "TXN-900005" });
    as(ADMIN);
    await expect(financeService.rejectFee(myFee().id, " ")).rejects.toThrow(/reason/);
    await financeService.rejectFee(myFee().id, "Reference not found");
    expect(myFee().status).toBe("REJECTED");
    as(DAY);
    await financeService.submitFee(myFee().id, { method: "EasyPaisa", reference: "TXN-900006" });
    expect(myFee().status).toBe("SUBMITTED");
    expect(myFee().rejectReason).toBeUndefined();
  });
  it("hostelites have no semester fee item (they're billed monthly)", () => {
    expect(db().fees.some((f) => f.userId === "U-3091")).toBe(false);
    expect(db().bills.filter((b) => b.studentId === "U-3091")).toHaveLength(3);
  });
});

describe("ADMIN: semester registrations (day scholars only; single + bulk)", () => {
  it("has pending items, none from hostelites", () => {
    const pending = db().registrations.filter((r) => r.status === "PENDING");
    expect(pending.length).toBeGreaterThan(3);
    expect(db().registrations.every((r) => db().students.find((s) => s.id === r.userId)?.residence !== "HOSTELITE")).toBe(true);
  });
  it("approves a single registration", async () => {
    const r = db().registrations.find((x) => x.status === "PENDING")!;
    expect(await registrationService.decide(r.id, "APPROVED")).toBe(1);
    expect(db().registrations.find((x) => x.id === r.id)?.status).toBe("APPROVED");
  });
  it("bulk approves all selected pending items only", async () => {
    const pending = db().registrations.filter((r) => r.status === "PENDING").map((r) => r.id);
    const approved = db().registrations.find((r) => r.status === "APPROVED")!;
    const n = await registrationService.decideMany([...pending, approved.id], "APPROVED");
    expect(n).toBe(pending.length);
    expect(db().registrations.some((r) => r.status === "PENDING")).toBe(false);
  });
  it("bulk rejects", async () => {
    const ids = db().registrations.filter((r) => r.status === "PENDING").slice(0, 3).map((r) => r.id);
    await registrationService.decideMany(ids, "REJECTED");
    expect(db().registrations.filter((r) => ids.includes(r.id)).every((r) => r.status === "REJECTED")).toBe(true);
  });
  it("a day scholar can submit a registration; a hostelite can't", async () => {
    as(DAY);
    const rec = await registrationService.submit({ userId: DAY.id, semester: "Spring 2027", routeId: "R01", stopId: "R01-S1", residence: "DAY_SCHOLAR" });
    expect(rec.status).toBe("PENDING");
    as(HOST);
    await expect(registrationService.submit({ userId: HOST.id, semester: "Spring 2027", routeId: "R05", stopId: "R05-S1", residence: "HOSTELITE" })).rejects.toThrow(/don't need to register/);
  });
});

describe("ADMIN: violation policy → fines / DDC", () => {
  it("pure ladder: 1st 1000, 2nd 5000, 3rd DDC", () => {
    expect(decidePolicy("No QR / pass", 0, pricing)).toMatchObject({ action: "FINED", amount: 1000, offenceNo: 1 });
    expect(decidePolicy("No QR / pass", 1, pricing)).toMatchObject({ action: "FINED", amount: 5000, offenceNo: 2 });
    expect(decidePolicy("No QR / pass", 2, pricing)).toMatchObject({ action: "DDC", offenceNo: 3 });
    expect(decidePolicy("No QR / pass", 7, pricing).action).toBe("DDC");
  });
  it("vape / pod goes straight to DDC even on the first offence", () => {
    expect(decidePolicy("Vape / pod found", 0, pricing)).toMatchObject({ action: "DDC", offenceNo: 1 });
  });
  it("'Other' follows the ladder", () => {
    expect(decidePolicy("Other", 0, pricing).amount).toBe(1000);
    expect(decidePolicy("Other", 1, pricing).amount).toBe(5000);
    expect(decidePolicy("Other", 2, pricing).action).toBe("DDC");
  });
  it("the conductor's report records route number, student name and roll number", async () => {
    const v = await report("U-3091", "Misbehaviour", "R05");
    expect(v).toMatchObject({ studentName: "Hamza Ali", rollNo: "22F-3091", routeId: "R05", routeNumber: "05", type: "Misbehaviour" });
    expect(v.plate).toBeTruthy();
  });
  it("end to end: three reports on one student → Rs.1000, Rs.5000, then DDC (no fine)", async () => {
    const sid = "U-3091";
    db().patch((d) => ({ violations: [], fines: d.fines.filter((f) => f.userId !== sid) }));
    const finesBefore = db().fines.length;
    const a = await report(sid);
    const b = await report(sid, "Standing without ticket");
    const c = await report(sid, "Misbehaviour");
    expect(await violationService.applyPolicy(a.id)).toMatchObject({ action: "FINED", fineAmount: 1000, offenceNo: 1, status: "RESOLVED" });
    expect(await violationService.applyPolicy(b.id)).toMatchObject({ action: "FINED", fineAmount: 5000, offenceNo: 2 });
    const rc = await violationService.applyPolicy(c.id);
    expect(rc).toMatchObject({ action: "DDC", offenceNo: 3, status: "ESCALATED" });
    expect(rc.fineAmount).toBeUndefined();
    expect(db().fines.length).toBe(finesBefore + 2);
  });
  it("vape / pod report → direct DDC with no fine", async () => {
    db().patch(() => ({ violations: [] }));
    const finesBefore = db().fines.length;
    const v = await report("U-3091", "Vape / pod found");
    expect(await violationService.applyPolicy(v.id)).toMatchObject({ action: "DDC", status: "ESCALATED" });
    expect(db().fines.length).toBe(finesBefore);
  });
  it("admin can override with a custom fine, or send to DDC, or dismiss", async () => {
    db().patch(() => ({ violations: [] }));
    const a = await report("U-3091");
    expect(await violationService.override(a.id, "FINED", 2500)).toMatchObject({ fineAmount: 2500, action: "FINED" });
    const b = await report("U-3082");
    expect(await violationService.override(b.id, "DDC")).toMatchObject({ action: "DDC", status: "ESCALATED" });
    const c = await report("U-3091");
    await violationService.dismiss(c.id);
    expect(db().violations.find((v) => v.id === c.id)).toMatchObject({ action: "DISMISSED", status: "RESOLVED" });
    const d = await report("U-3091");
    expect(violationService.preview(d.id).offenceNo).toBe(2);
  });
  it("an already-handled report can't be handled twice; custom fine needs an amount", async () => {
    db().patch(() => ({ violations: [] }));
    const a = await report("U-3091");
    await expect(violationService.override(a.id, "FINED", 0)).rejects.toThrow(/amount/);
    await violationService.applyPolicy(a.id);
    await expect(violationService.applyPolicy(a.id)).rejects.toThrow(/already handled/);
  });
  it("DDC email draft contains student, ROUTE NUMBER, history and a mailto link", async () => {
    db().patch(() => ({ violations: [] }));
    const a = await report("U-3091", "Misbehaviour", "R05");
    await violationService.applyPolicy(a.id);
    const b = await report("U-3091", "Vape / pod found", "R05");
    const r = await violationService.applyPolicy(b.id);
    const mail = violationService.ddcMail(r.id);
    expect(mail.to).toBe("ddc@cfd.nu.edu.pk");
    expect(mail.subject).toContain("Hamza Ali");
    expect(mail.body).toContain("22F-3091");
    expect(mail.body).toContain("Route 05");
    expect(mail.body).toContain("fined Rs. 1000");
    expect(mail.mailto.startsWith("mailto:ddc@cfd.nu.edu.pk?subject=")).toBe(true);
    expect(buildDdcMail(r, db().violations, "x@y.pk").to).toBe("x@y.pk");
  });
  it("manual fine and waive", async () => {
    const f = await financeService.issueFine({ userId: "U-3082", reason: "Other", amount: 750, issuedBy: "Transport Office" });
    await financeService.waiveFine(f.id);
    expect(db().fines.find((x) => x.id === f.id)?.status).toBe("WAIVED");
  });
});

describe("ADMIN: announcements", () => {
  it("publishes, targets an audience, notifies, and deletes", async () => {
    const seen = await capture(async () => {
      const a = await announcementService.publish({ title: "Bus route change", body: "Route 2 will use the new bypass from Monday.", audience: "HOSTELITE", author: "Transport Office" });
      expect(db().announcements[0]).toMatchObject({ id: a.id, audience: "HOSTELITE" });
      await announcementService.remove(a.id);
      expect(db().announcements.find((x) => x.id === a.id)).toBeUndefined();
    });
    expect(seen.some((e) => e.type === "notification.new" && e.payload.title === "Bus route change")).toBe(true);
  });
  it("students only list announcements aimed at them", async () => {
    as(DAY);
    const titles = (await announcementService.list()).map((a) => a.title);
    expect(titles).toContain("Friday joint shuttle"); // everyone
    expect(titles).toContain("Semester fee deadline"); // day scholars
    expect(titles).not.toContain("New standing tickets"); // hostelites only
    as(HOST);
    expect((await announcementService.list()).map((a) => a.title)).toContain("New standing tickets");
  });
});

describe("ADMIN: university routes (from the PDF timetable)", () => {
  it("has the 17 routes with printed stops and times", () => {
    const routes = db().routes;
    expect(routes).toHaveLength(17);
    expect(routes.map((r) => r.number)).toEqual(Array.from({ length: 17 }, (_, i) => String(i + 1).padStart(2, "0")));
    const r1 = routes[0];
    expect(r1.stops.map((s) => s.name)).toEqual(["Chenab Garden", "Korian Pull", "D-Type", "Waris Pura", "Raja Chowk", "Pahari Chowk", "Babar Chowk", "Hameed Palace", "Mcdonald", "Campus"]);
    expect(r1.stops[0].time).toBe("07:05");
    expect(r1.stops.at(-1)).toMatchObject({ name: "Campus", time: "08:25" });
  });
  it("Route 08 is the Chiniot route; Route 05 is the long one", () => {
    expect(db().routes.find((r) => r.number === "08")).toMatchObject({ note: "Chiniot" });
    expect(db().routes.find((r) => r.number === "05")!.stops).toHaveLength(18);
  });
  it("authorised persons from the PDF; Route 17 has none printed", () => {
    expect(db().routes.find((r) => r.number === "01")?.contact).toEqual({ name: "Mr. Waqas", phone: "0307-7912548" });
    expect(db().routes.find((r) => r.number === "11")?.contact).toEqual({ name: "Mr. Akhtar", phone: "0306-9091701" });
    expect(db().routes.find((r) => r.number === "17")?.contact).toBeUndefined();
  });
  it("one bus per route and a morning schedule at the first stop's printed time", () => {
    expect(db().buses).toHaveLength(17);
    const s = db().schedules.find((x) => x.busId === "B11" && x.direction === "TO_CAMPUS")!;
    expect(s.departTime).toBe("06:55");
  });
});

describe("ADMIN: drivers (records only, assigned to buses)", () => {
  it("has no driver login account", async () => {
    const { DEMO_ACCOUNTS } = await import("@/demo/data");
    expect(DEMO_ACCOUNTS.some((a) => (a.role as string) === "DRIVER")).toBe(false);
  });
  it("each route's authorised person is seeded as that bus's driver", () => {
    expect(db().drivers.find((d) => d.busId === "B01")?.name).toBe("Mr. Waqas");
  });
  it("adds a driver with name, phone, address", async () => {
    const d = await driverService.save({ id: "D-NEW", name: "Kamran Ali", phone: "0300-9999999", address: "Street 5, Faisalabad" });
    expect(db().drivers.find((x) => x.id === d.id)).toMatchObject({ name: "Kamran Ali", phone: "0300-9999999", address: "Street 5, Faisalabad" });
  });
  it("assigning a driver to a bus unassigns the previous driver of that bus", async () => {
    await driverService.save({ ...db().drivers.find((d) => d.id === "D-SPARE")!, busId: "B01" });
    expect(db().drivers.filter((d) => d.busId === "B01")).toHaveLength(1);
    expect(db().drivers.find((d) => d.busId === "B01")?.id).toBe("D-SPARE");
    expect(db().drivers.find((d) => d.id === "D-01")?.busId).toBeUndefined();
  });
  it("deleting a bus unassigns its driver; drivers can be removed", async () => {
    await fleetService.deleteBus("B02");
    expect(db().drivers.find((d) => d.id === "D-02")?.busId).toBeUndefined();
    await driverService.remove("D-03");
    expect(db().drivers.find((d) => d.id === "D-03")).toBeUndefined();
  });
  it("students get only name + phone of a bus's driver (no address / licence)", async () => {
    as(DAY);
    const pub = await driverService.listPublic();
    expect(pub[0]).not.toHaveProperty("address");
    expect(pub[0]).not.toHaveProperty("licenseNo");
    expect(pub.find((d) => d.busId === "B01")).toMatchObject({ name: "Mr. Waqas", phone: "0307-7912548" });
  });
});

describe("ADMIN: pricing, booking control, schedules, routes, billing", () => {
  it("saves pricing including offence fines and DDC email", async () => {
    await financeService.savePricing({ ...db().pricing, firstOffenceFine: 1500, secondOffenceFine: 7500, ddcEmail: "ddc@test.pk" });
    expect(await financeService.getPricing()).toMatchObject({ firstOffenceFine: 1500, secondOffenceFine: 7500, ddcEmail: "ddc@test.pk" });
    db().patch(() => ({ violations: [] }));
    const v = await report("U-3091");
    expect((await violationService.applyPolicy(v.id)).fineAmount).toBe(1500);
  });
  it("disabling booking broadcasts live and blocks tickets", async () => {
    const seen = await capture(() => settingsService.setBookingEnabled(false));
    expect(seen.some((e) => e.type === "booking.toggled" && e.payload.enabled === false)).toBe(true);
    await expect(book(HOST, BUS_HOST)).rejects.toThrow(/disabled/);
    as(ADMIN);
    await settingsService.setBookingEnabled(true);
    expect(db().bookingEnabled).toBe(true);
  });
  it("schedules: add, edit, delete", async () => {
    const s = { id: "SCH-T", routeId: "R01", busId: "B01", direction: "TO_CAMPUS" as const, departTime: "09:15", days: ["Mon"], active: true };
    await fleetService.saveSchedule(s);
    await fleetService.saveSchedule({ ...s, active: false });
    expect(db().schedules.find((x) => x.id === "SCH-T")?.active).toBe(false);
    await fleetService.deleteSchedule("SCH-T");
    expect(db().schedules.find((x) => x.id === "SCH-T")).toBeUndefined();
  });
  it("routes: add, edit, delete", async () => {
    const r = { id: "R-T", number: "99", name: "Route 99", via: "A → Campus", color: "#123456", stops: [{ id: "S1", name: "A", lat: 1, lng: 1 }, { id: "S2", name: "B", lat: 2, lng: 2 }], path: [[1, 1], [2, 2]] as [number, number][] };
    await fleetService.saveRoute(r);
    await fleetService.saveRoute({ ...r, name: "Renamed" });
    expect(db().routes.find((x) => x.id === "R-T")?.name).toBe("Renamed");
    await fleetService.deleteRoute("R-T");
    expect(db().routes.find((x) => x.id === "R-T")).toBeUndefined();
  });
  it("buses: add, edit, delete", async () => {
    await fleetService.saveBus({ id: "B-T", plate: "TST-0001", routeId: "R01", seatCapacity: 30, standingCapacity: 5 });
    await fleetService.saveBus({ id: "B-T", plate: "TST-0002", routeId: "R01", seatCapacity: 30, standingCapacity: 5 });
    expect(db().buses.filter((b) => b.id === "B-T")).toHaveLength(1);
    await fleetService.deleteBus("B-T");
    expect(db().buses.find((b) => b.id === "B-T")).toBeUndefined();
  });
  it("hostel billing: admin marks a monthly bill paid", async () => {
    const unpaid = db().bills.find((b) => b.status === "UNPAID")!;
    await financeService.markBillPaid(unpaid.id);
    expect(db().bills.find((b) => b.id === unpaid.id)?.status).toBe("PAID");
  });
  it("live trip flag reaches clients", async () => {
    const seen = await capture(() => simulator.setTrip("B03", false));
    expect(seen).toContainEqual({ type: "trip.status", payload: { busId: "B03", active: false } });
  });
});
