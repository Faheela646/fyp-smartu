import { describe, expect, it } from "vitest";
import { simulator } from "@/demo/simulator";
import { fleetService, scanService, violationService } from "@/services/ops";
import { BUS_HOST, COND, HOST, as, book, capture, db, qr } from "./helpers";

describe("CONDUCTOR: trip start / end", () => {
  it("ending the trip tells every client and stops the bus", async () => {
    as(COND);
    const seen = await capture(() => fleetService.setTrip("B01", false));
    expect(db().tripActive.B01).toBe(false);
    expect(seen).toContainEqual({ type: "trip.status", payload: { busId: "B01", active: false } });
    expect(seen.some((e) => e.type === "notification.new" && /Trip ended/.test(e.payload.title))).toBe(true);
  });
  it("starting the trip again re-enables the bus", async () => {
    as(COND);
    await fleetService.setTrip("B01", false);
    await fleetService.setTrip("B01", true);
    expect(db().tripActive.B01).toBe(true);
  });
  it("a conductor can only start / end the trip of their OWN bus", async () => {
    as(COND); // Route 01
    await expect(fleetService.setTrip("B09", false)).rejects.toThrow(/your own bus/);
    expect(db().tripActive.B09).toBe(true);
  });
  it("scanning is refused until the trip is started", async () => {
    const t = await book(HOST, BUS_HOST);
    as(COND);
    db().patch((d) => ({ tripActive: { ...d.tripActive, [BUS_HOST]: false } }));
    expect((await scanService.scan(qr(t), BUS_HOST, COND.name)).title).toBe("Trip not started");
    db().patch((d) => ({ tripActive: { ...d.tripActive, [BUS_HOST]: true } }));
    expect((await scanService.scan(qr(t), BUS_HOST, COND.name)).ok).toBe(true);
  });
});

describe("CONDUCTOR: GPS sharing", () => {
  it("shared device GPS becomes the bus's live position", async () => {
    as(COND);
    fleetService.setGpsSharing("B01", true);
    const seen = await capture(() => fleetService.pushGps("B01", { lat: 31.4504, lng: 73.135, speedKmh: 33.4, heading: 90 }));
    fleetService.setGpsSharing("B01", false);
    const p = seen.find((e) => e.type === "bus.position");
    expect(p?.type === "bus.position" && p.payload).toMatchObject({ busId: "B01", lat: 31.4504, lng: 73.135, speedKmh: 33, heading: 90 });
  });
  it("students cannot push a bus position", async () => {
    as(HOST);
    await expect(fleetService.pushGps("B01", { lat: 1, lng: 1, speedKmh: 1, heading: 1 })).rejects.toThrow(/permission/);
  });
  it("the simulator flag round-trips", () => {
    fleetService.setGpsSharing("B02", true);
    fleetService.setGpsSharing("B02", false);
    expect(simulator.getSeats("B02")).not.toBeNull();
  });
});

describe("CONDUCTOR: manual attendance", () => {
  it("marks a student present when the scan fails (and the student sees it as a boarding)", async () => {
    as(COND);
    const st = await scanService.manual("U-3082", "B01", COND.name);
    expect(st.name).toBe("Ayesha Khan");
    expect(db().scanLogs[0]).toMatchObject({ studentId: "U-3082", result: "MANUAL", conductor: COND.name, routeNumber: "01" });
  });
  it("unknown student → error", async () => {
    as(COND);
    await expect(scanService.manual("U-NOPE", "B01", COND.name)).rejects.toThrow(/not found/);
  });
});

describe("CONDUCTOR: report a violation (route number + student name + roll no.)", () => {
  it("creates an OPEN report with route number, plate, student name and roll no. and tells ONLY the admin", async () => {
    as(COND);
    const seen = await capture(async () => {
      const v = await violationService.report({ studentId: "U-3091", type: "Vape / pod found", notes: "Found a vape in the back seat.", reportedBy: COND.name, busId: "B05", routeId: "R05" });
      expect(v).toMatchObject({ status: "OPEN", type: "Vape / pod found", studentName: "Hamza Ali", rollNo: "22F-3091", routeId: "R05", routeNumber: "05" });
      expect(v.plate).toBe(db().buses.find((b) => b.id === "B05")!.plate);
    });
    const n = seen.find((e) => e.type === "notification.new" && /Violation reported/.test(e.payload.title));
    expect(n?.type === "notification.new" && n.payload.audience).toEqual({ roles: ["ADMIN"] });
    expect(n?.type === "notification.new" && n.payload.body).toContain("Route 05");
  });
  it("route defaults to the bus's route when only a bus is given; accepts 'Other'", async () => {
    as(COND);
    const v = await violationService.report({ studentId: "U-3082", type: "Other", notes: "Something else happened on the bus.", reportedBy: COND.name, busId: "B01" });
    expect(v).toMatchObject({ type: "Other", routeNumber: "01" });
  });
  it("unknown student → error", async () => {
    as(COND);
    await expect(violationService.report({ studentId: "U-NOPE", type: "Other", notes: "xxxxx", reportedBy: "R", busId: "B01" })).rejects.toThrow(/not found/);
  });
  it("a conductor sees only the reports they filed", async () => {
    as(COND);
    await violationService.report({ studentId: "U-3082", type: "Other", notes: "mine mine mine", reportedBy: COND.name, busId: "B01" });
    const mine = await violationService.list();
    expect(mine.every((v) => v.reportedBy === COND.name)).toBe(true);
    db().patch((d) => ({ violations: [{ ...d.violations[0], id: "VR-OTHER", reportedBy: "Someone Else" }, ...d.violations] }));
    expect((await violationService.list()).some((v) => v.id === "VR-OTHER")).toBe(false);
  });
});
