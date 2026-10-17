import { describe, expect, it } from "vitest";
import { NAV } from "@/app/nav";
import { financeService } from "@/services/ops";
import { DAY, HOST, as, db } from "./helpers";

describe("STUDENT: payment page and fines navigation", () => {
  it("includes /student/payment in the student navigation items with end: true", () => {
    const paymentNav = NAV.student.find((item) => item.to === "/student/payment");
    expect(paymentNav).toBeDefined();
    expect(paymentNav?.label).toBe("Payment");
    expect(paymentNav?.end).toBe(true);
  });

  it("retains /student/fines and /student/payments in student navigation", () => {
    expect(NAV.student.some((item) => item.to === "/student/fines")).toBe(true);
    expect(NAV.student.some((item) => item.to === "/student/payments")).toBe(true);
  });

  it("allows Day Scholar to pay an outstanding fine through the payment service", async () => {
    as(DAY);
    const finesBefore = await financeService.listFines(DAY.id);
    const unpaidFine = finesBefore.find((f) => f.status === "UNPAID");
    expect(unpaidFine).toBeDefined();

    if (unpaidFine) {
      await financeService.payFine(unpaidFine.id, "JazzCash");
      const finesAfter = await financeService.listFines(DAY.id);
      const paidFine = finesAfter.find((f) => f.id === unpaidFine.id);
      expect(paidFine?.status).toBe("PAID");
    }
  });

  it("allows Hostelite to pay an outstanding fine through the payment service", async () => {
    as(HOST);
    // Issue a demo fine for HOST if none exists
    const fine = db().fines.find((f) => f.userId === HOST.id && f.status === "UNPAID") ?? {
      id: "FN-TEST-HOST",
      userId: HOST.id,
      studentName: HOST.name,
      reason: "No QR on boarding",
      amount: 500,
      date: new Date().toISOString(),
      status: "UNPAID" as const,
      issuedBy: "Transport Office",
    };
    if (!db().fines.some((f) => f.id === fine.id)) {
      db().patch((d) => ({ fines: [fine, ...d.fines] }));
    }

    await financeService.payFine(fine.id, "EasyPaisa");
    const fines = await financeService.listFines(HOST.id);
    const paid = fines.find((f) => f.id === fine.id);
    expect(paid?.status).toBe("PAID");
  });
});
