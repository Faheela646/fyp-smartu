import type { FeeItem, HostelBill, Pricing, Student, TransportRoute } from "@/types/api";

export type ChallanKind = "SEMESTER" | "MONTHLY";

export interface ChallanData {
  kind: ChallanKind;
  challanNo: string;
  rollNo: string;
  name: string;
  /** "Fall 2026" for a semester challan, "October 2026" for a monthly one. */
  period: string;
  routeNumber: string;
  routeName: string;
  /** Pick-up point and its departure time from the university bus timetable. */
  pickup: string;
  pickupTime: string;
  residence: string;
  amount: number;
  dueDate: string; // ISO
  /** Monthly challans: what the amount is made of. */
  detail?: string;
}

const compact = (s: string) => s.replace(/\s+/g, "").toUpperCase();
export const challanNo = (rollNo: string, period: string, kind: ChallanKind = "SEMESTER") => `${kind === "MONTHLY" ? "TM" : "TC"}-${compact(period)}-${rollNo.toUpperCase()}`;

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]} ${ONES[r % 10]}`.trim()].filter(Boolean).join(" ");
}
export function amountInWords(n: number): string {
  if (n === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  const lakh = Math.floor(n / 100000), th = Math.floor((n % 100000) / 1000), rest = n % 1000;
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  if (th) parts.push(`${below1000(th)} Thousand`);
  if (rest) parts.push(below1000(rest));
  return `${parts.join(" ")} Rupees Only`;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (hhmm: string) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

/**
 * FLEX-style fee challan: one landscape A4 page per student, three copies side by side.
 * jsPDF is loaded on demand so it never slows the first page load.
 */
export async function buildChallanPdf(items: ChallanData[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const copies = ["BANK COPY", "STUDENT COPY", "UNIVERSITY COPY"];
  const margin = 24;
  const gap = 14;
  const colW = (W - margin * 2 - gap * 2) / 3;

  items.forEach((c, idx) => {
    if (idx > 0) doc.addPage();
    copies.forEach((label, i) => {
      const x = margin + i * (colW + gap);
      let y = margin;
      doc.setDrawColor(150).setLineWidth(0.6).rect(x, y, colW, H - margin * 2);
      doc.setFillColor(20, 48, 122).rect(x, y, colW, 44, "F");
      doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(10).text("FAST National University", x + colW / 2, y + 17, { align: "center" });
      doc.setFont("helvetica", "normal").setFontSize(8).text("Chiniot-Faisalabad Campus", x + colW / 2, y + 30, { align: "center" });
      doc.setFontSize(7.5).text(label, x + colW / 2, y + 40, { align: "center" });
      y += 60;

      doc.setTextColor(20).setFont("helvetica", "bold").setFontSize(10.5).text(c.kind === "MONTHLY" ? "MONTHLY TRANSPORT FEE CHALLAN" : "SEMESTER TRANSPORT FEE CHALLAN", x + colW / 2, y, { align: "center" });
      y += 16;

      doc.setFillColor(238, 242, 250).rect(x + 10, y - 12, colW - 20, 30, "F");
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(90).text("ROLL NO.", x + 16, y - 1);
      doc.setFontSize(15).setTextColor(20).text(c.rollNo.toUpperCase(), x + 16, y + 14);
      y += 36;

      const row = (k: string, v: string, bold = false) => {
        doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(100).text(k, x + 12, y);
        doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(8.5).setTextColor(20).text(v, x + 12, y + 10, { maxWidth: colW - 24 });
        y += 24;
      };
      row("Challan No.", c.challanNo, true);
      row("Student name", c.name);
      row(c.kind === "MONTHLY" ? "Billing month" : "Semester", c.period, true);
      row("Student type", c.residence);
      row("Bus route (university timetable)", `Route ${c.routeNumber}${c.pickup ? `: pick-up ${c.pickup}${c.pickupTime ? ` at ${fmtTime(c.pickupTime)}` : ""}` : ""}`);
      row("Due date", fmtDate(c.dueDate), true);

      doc.setDrawColor(200).line(x + 10, y - 8, x + colW - 10, y - 8);
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100).text("Amount payable", x + 12, y + 4);
      doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(20).text(`Rs. ${c.amount.toLocaleString("en-PK")}/-`, x + 12, y + 22);
      doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(90).text(amountInWords(c.amount), x + 12, y + 34, { maxWidth: colW - 24 });
      if (c.detail) doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(110).text(c.detail, x + 12, y + 46, { maxWidth: colW - 24 });
      y += 62;

      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(90);
      doc.text("Deposit the amount at any designated bank branch / app", x + 12, y, { maxWidth: colW - 24 });
      doc.text("(account details as notified by the university).", x + 12, y + 10, { maxWidth: colW - 24 });
      doc.text(c.kind === "MONTHLY" ? "Hostelites: submit the reference in the SmartU portal." : "Then submit the transaction reference in the SmartU portal.", x + 12, y + 20, { maxWidth: colW - 24 });
      const sy = H - margin - 52;
      doc.setDrawColor(120).line(x + 14, sy, x + colW / 2 - 8, sy).line(x + colW / 2 + 8, sy, x + colW - 14, sy);
      doc.setFontSize(7).setTextColor(100).text(i === 0 ? "Cashier / bank stamp" : "Depositor", x + 14, sy + 9).text(i === 2 ? "Accounts office" : "Date", x + colW / 2 + 8, sy + 9);
      doc.setFontSize(6.5).setTextColor(150).text("Demo document: generated by SmartU Transport", x + colW / 2, H - margin - 8, { align: "center" });
    });
  });
  return doc;
}

export async function downloadChallans(items: ChallanData[], filename: string) {
  (await buildChallanPdf(items)).save(`${filename}.pdf`);
}

/**
 * Challan for a student:
 *  - day scholar / faculty → SEMESTER challan from their semester fee
 *  - hostelite → MONTHLY challan from that month's bill (tickets booked that month)
 * Route number, pick-up point and time come from the university bus timetable.
 */
export function challanFor(s: Student, fees: FeeItem[], bills: HostelBill[], routes: TransportRoute[], pricing: Pricing, opts: { semester?: string; monthKey?: string } = {}): ChallanData {
  const route = routes.find((r) => r.id === s.routeId);
  const stop = route?.stops.find((x) => x.id === s.stopId) ?? route?.stops[0];
  const base = {
    rollNo: s.rollNo, name: s.name, routeNumber: route?.number ?? "-", routeName: route?.name ?? s.routeId,
    pickup: stop?.name ?? "", pickupTime: stop?.time ?? "", residence: s.residence === "HOSTELITE" ? "Hostelite" : s.residence === "FACULTY" ? "Faculty" : "Day scholar",
  };
  if (s.residence === "HOSTELITE") {
    const mine = bills.filter((b) => b.studentId === s.id).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    const bill = (opts.monthKey ? mine.find((b) => b.monthKey === opts.monthKey) : undefined) ?? mine[0];
    const [y, m] = (bill?.monthKey ?? new Date().toISOString().slice(0, 7)).split("-").map(Number);
    const period = bill?.month ?? new Date(y, m - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
    const due = new Date(y, m, 10); // 10th of the next month
    return {
      ...base, kind: "MONTHLY", challanNo: challanNo(s.rollNo, period, "MONTHLY"), period, amount: bill?.amount ?? 0, dueDate: due.toISOString(),
      detail: bill ? `${bill.seatTrips} seat trip(s) + ${bill.standingTrips} standing trip(s) booked in ${period}` : "No tickets booked this month",
    };
  }
  const fee = fees.filter((f) => f.userId === s.id).sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
  const period = fee?.semester ?? opts.semester ?? "Fall 2026";
  return { ...base, kind: "SEMESTER", challanNo: challanNo(s.rollNo, period), period, amount: fee?.amount ?? pricing.semesterFeeDayScholar, dueDate: fee?.dueDate ?? new Date(Date.now() + 14 * 86400000).toISOString() };
}
