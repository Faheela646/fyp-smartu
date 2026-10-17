import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Announcement, BookingRecord, Driver, FeeItem, Fine, HostelBill, Pricing, Registration, ScanLog, Schedule, Student, ViolationReport,
} from "@/types/api";
import { emailForRoll } from "@/lib/email";
import { DEMO_ACCOUNTS, DEMO_BUSES, DEMO_ROUTES, type DemoAccount } from "./data";

const iso = (offsetDays = 0, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
export const todayStr = () => new Date().toISOString().slice(0, 10);
export const monthKeyOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
};
const shiftMonth = (offset: number) => monthKeyOf(new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1));

const NAMES = [
  "Ayesha Khan", "Hamza Ali", "Sana Tariq", "Bilal Ahmad", "Maryam Iqbal", "Usman Raza", "Hira Fatima", "Talha Mehmood",
  "Zainab Shah", "Daniyal Butt", "Areeba Noor", "Hassan Javed", "Laiba Siddiq", "Faizan Malik", "Noor Ul Ain", "Ahmad Saeed",
  "Rimsha Aslam", "Saad Hussain", "Eman Fatima", "Huzaifa Nadeem",
];
const routeIds = DEMO_ROUTES.map((r) => r.id);

function seedStudents(): Student[] {
  return NAMES.map((name, i) => {
    const roll = i === 0 ? "22F-3082" : i === 1 ? "22F-3091" : `2${2 + (i % 3)}F-${3100 + i * 7}`;
    const residence = i === 0 ? "DAY_SCHOLAR" : i === 1 || i % 3 === 0 ? "HOSTELITE" : "DAY_SCHOLAR";
    const routeId = i === 0 ? "R01" : i === 1 ? "R05" : routeIds[(i * 5) % routeIds.length];
    const route = DEMO_ROUTES.find((r) => r.id === routeId)!;
    const stop = route.stops[(i * 3) % (route.stops.length - 1)]; // never "Campus"
    return {
      id: i === 0 ? "U-3082" : i === 1 ? "U-3091" : `U-${roll.slice(-4)}${i}`,
      rollNo: roll,
      name,
      email: emailForRoll(roll),
      phone: `0300-${String(1000000 + i * 91357).slice(0, 7)}`,
      residence: residence as Student["residence"],
      routeId,
      stopId: stop.id,
      status: i === 11 ? "BANNED" : "ACTIVE",
      banReason: i === 11 ? "Repeated violations" : undefined,
    };
  });
}

/** Day scholars pay once a semester (hostelites are billed monthly, see seedBills). */
function seedFees(): FeeItem[] {
  const students = seedStudents();
  const out: FeeItem[] = students
    .filter((s) => s.residence === "DAY_SCHOLAR")
    .map((s, i) => ({
      id: `F-${s.id}-1`, userId: s.id, title: "Transport fee, Fall 2026", semester: "Fall 2026", amount: 14000, dueDate: iso(i % 4 === 0 ? -5 : 12),
      status: (i % 3 === 0 ? "UNPAID" : "PAID") as FeeItem["status"],
      paidAt: i % 3 === 0 ? undefined : iso(-20), method: i % 3 === 0 ? undefined : "JazzCash",
    }));
  // A few day scholars have already submitted payment and wait for approval.
  out.filter((f) => f.userId !== "U-3082").slice(0, 4).forEach((f, i) => {
    f.status = "SUBMITTED"; f.paidAt = undefined; f.method = ["JazzCash", "Bank transfer", "EasyPaisa", "Bank transfer"][i]; f.reference = `TXN-${48210 + i * 77}`; f.submittedAt = iso(-1, 14);
  });
  const mine = out.find((f) => f.userId === "U-3082");
  if (mine) { mine.status = "UNPAID"; mine.paidAt = undefined; mine.method = undefined; mine.reference = undefined; mine.submittedAt = undefined; mine.dueDate = iso(9); }
  return out;
}

function seedFines(): Fine[] {
  return [
    { id: "FN-1", userId: "U-3091", studentName: "Hamza Ali", reason: "Boarded without a valid ticket", amount: 1000, date: iso(-9), status: "UNPAID", issuedBy: "Transport Office" },
    { id: "FN-2", userId: "U-3091", studentName: "Hamza Ali", reason: "Late booking cancellation", amount: 500, date: iso(-30), status: "PAID", issuedBy: "System" },
    { id: "FN-3", userId: "U-3082", studentName: "Ayesha Khan", reason: "Standing without ticket", amount: 1000, date: iso(-4), status: "UNPAID", issuedBy: "Transport Office" },
  ];
}

function seedScanLogs(): ScanLog[] {
  const st = seedStudents();
  return Array.from({ length: 18 }, (_, i) => {
    const s = st[(i * 5) % st.length];
    const failed = i % 6 === 4;
    const bus = DEMO_BUSES[(i * 3) % DEMO_BUSES.length];
    return {
      id: `SC-${i}`,
      ts: new Date(Date.now() - (i * 17 + 150) * 60000).toISOString(),
      studentId: s.id, studentName: s.name, rollNo: s.rollNo, busId: bus.id,
      routeNumber: bus.routeId.slice(1),
      result: failed ? "FAILED" : i % 9 === 8 ? "MANUAL" : "SUCCESS",
      reason: failed ? "No active ticket for this bus" : i % 9 === 8 ? "QR unreadable, marked manually" : undefined,
      conductor: "Rashid Mehmood",
    } as ScanLog;
  });
}

function seedSchedules(): Schedule[] {
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const out: Schedule[] = [];
  DEMO_BUSES.forEach((b) => {
    const route = DEMO_ROUTES.find((r) => r.id === b.routeId)!;
    // Morning departure = first stop's time from the university timetable.
    out.push({ id: `SCH-${b.id}-a`, routeId: b.routeId, busId: b.id, direction: "TO_CAMPUS", departTime: route.stops[0].time ?? "07:00", days: weekdays, active: true });
    // The timetable PDF has no return times; an afternoon departure is assumed and editable under Schedules.
    out.push({ id: `SCH-${b.id}-b`, routeId: b.routeId, busId: b.id, direction: "FROM_CAMPUS", departTime: "16:30", days: weekdays, active: true });
  });
  return out;
}

/** Hostelites are billed monthly from the tickets they book. Three months of history. */
function seedBills(): HostelBill[] {
  const out: HostelBill[] = [];
  seedStudents().filter((s) => s.residence === "HOSTELITE").forEach((s, i) => {
    [-2, -1, 0].forEach((offset) => {
      const key = shiftMonth(offset);
      const seatTrips = 8 + ((i * 3 + offset + 5) % 9);
      const standingTrips = (i + offset + 3) % 3;
      out.push({
        id: `HB-${s.id}-${key}`, studentId: s.id, studentName: s.name, rollNo: s.rollNo, monthKey: key, month: monthLabel(key),
        seatTrips, standingTrips, amount: seatTrips * 150 + standingTrips * 75,
        status: offset < 0 ? "PAID" : i % 2 === 0 ? "PAID" : "UNPAID",
      });
    });
  });
  // Hamza (demo hostelite): a clean slate this month so ticket bookings show up on his bill.
  const hamza = out.find((b) => b.studentId === "U-3091" && b.monthKey === shiftMonth(0));
  if (hamza) Object.assign(hamza, { seatTrips: 0, standingTrips: 0, amount: 0, status: "UNPAID" });
  return out;
}

const seedAnnouncements = (): Announcement[] => [
  { id: "AN-1", title: "Friday joint shuttle", body: "On Fridays one joint shuttle departs at 12:30 PM for Jummah and city drop-off. Book early; seats are limited.", ts: iso(-1, 10), audience: "ALL", author: "Transport Office" },
  { id: "AN-2", title: "New standing tickets", body: "When a bus is full, students can now purchase a standing ticket directly in the app.", ts: iso(-3, 12), audience: "HOSTELITE", author: "Dean of Students" },
  { id: "AN-3", title: "Semester fee deadline", body: "Day scholars: please clear the Fall-semester transport fee before the due date to avoid a booking hold.", ts: iso(-6, 9), audience: "DAY_SCHOLAR", author: "Transport Office" },
];

const plateOf = (id: string) => DEMO_BUSES.find((b) => b.id === id)?.plate;
const seedViolations = (): ViolationReport[] => [
  { id: "VR-1", studentId: "U-3091", studentName: "Hamza Ali", rollNo: "22F-3091", type: "Standing without ticket", notes: "Found standing in aisle without a standing ticket.", reportedBy: "Rashid Mehmood", busId: "B05", routeId: "R05", routeNumber: "05", plate: plateOf("B05"), ts: iso(-2, 8), status: "OPEN" },
  { id: "VR-2", studentId: "U-3082", studentName: "Ayesha Khan", rollNo: "22F-3082", type: "Misbehaviour", notes: "Argument with another passenger.", reportedBy: "Rashid Mehmood", busId: "B01", routeId: "R01", routeNumber: "01", plate: plateOf("B01"), ts: iso(-5, 16), status: "RESOLVED", action: "FINED", fineAmount: 1000, offenceNo: 1 },
  { id: "VR-3", studentId: "U-3082", studentName: "Ayesha Khan", rollNo: "22F-3082", type: "No QR / pass", notes: "Boarded without showing a ticket.", reportedBy: "Rashid Mehmood", busId: "B01", routeId: "R01", routeNumber: "01", plate: plateOf("B01"), ts: iso(-1, 8), status: "OPEN" },
];

/** Hostelites don't register for the semester: only day scholars have registrations. */
const seedRegistrations = (): Registration[] => {
  const day = seedStudents().filter((s) => s.residence === "DAY_SCHOLAR");
  const out: Registration[] = [{ id: "RG-1", userId: "U-3082", semester: "Fall 2026", routeId: "R01", stopId: day[0].stopId ?? "R01-S1", residence: "DAY_SCHOLAR", status: "APPROVED", submittedAt: iso(-14) }];
  day.slice(1, 8).forEach((s, i) => out.push({ id: `RG-${i + 2}`, userId: s.id, semester: "Spring 2027", routeId: s.routeId, stopId: s.stopId ?? `${s.routeId}-S1`, residence: "DAY_SCHOLAR", status: "PENDING", submittedAt: iso(-(i % 4) - 1) }));
  return out;
};

/** Drivers = the "authorised person" printed on each route of the university timetable. */
const seedDrivers = (): Driver[] => {
  const out: Driver[] = [];
  DEMO_ROUTES.forEach((r) => {
    if (!r.contact) return;
    out.push({ id: `D-${r.number}`, name: r.contact.name, phone: r.contact.phone, address: "Address not recorded yet", busId: `B${r.number}` });
  });
  out.push({ id: "D-SPARE", name: "Rizwan Ahmad", phone: "0300-5566778", address: "Ghulam Muhammad Abad, Faisalabad", licenseNo: "FSD-2020-33012" });
  return out;
};

export const DEFAULT_PRICING: Pricing = {
  seatPrice: 150, standingPrice: 75, firstOffenceFine: 1000, secondOffenceFine: 5000, cancelFeePercent: 50, freeCancelHours: 2,
  ddcEmail: "ddc@cfd.nu.edu.pk", semesterFeeDayScholar: 14000, ticketValidHours: 14, legGapMinutes: 2,
};

interface DB {
  students: Student[];
  fees: FeeItem[];
  fines: Fine[];
  bookings: BookingRecord[];
  scanLogs: ScanLog[];
  schedules: Schedule[];
  bills: HostelBill[];
  announcements: Announcement[];
  violations: ViolationReport[];
  registrations: Registration[];
  drivers: Driver[];
  /** Demo-only login accounts (a real backend stores hashed passwords). */
  accounts: DemoAccount[];
  pricing: Pricing;
  bookingEnabled: boolean;
  tripActive: Record<string, boolean>;
  buses: typeof DEMO_BUSES;
  routes: typeof DEMO_ROUTES;
  patch: (fn: (s: DB) => Partial<DB>) => void;
  reset: () => void;
}

const seed = () => ({
  students: seedStudents(),
  fees: seedFees(),
  fines: seedFines(),
  bookings: [] as BookingRecord[],
  scanLogs: seedScanLogs(),
  schedules: seedSchedules(),
  bills: seedBills(),
  announcements: seedAnnouncements(),
  violations: seedViolations(),
  registrations: seedRegistrations(),
  drivers: seedDrivers(),
  accounts: DEMO_ACCOUNTS,
  pricing: DEFAULT_PRICING,
  bookingEnabled: true,
  tripActive: Object.fromEntries(DEMO_BUSES.map((b) => [b.id, true])) as Record<string, boolean>,
  buses: DEMO_BUSES,
  routes: DEMO_ROUTES,
});

/** In-browser database used only in demo mode (persisted so actions survive reloads). */
export const useDemoDB = create<DB>()(
  persist(
    (set) => ({
      ...seed(),
      patch: (fn) => set((s) => fn(s)),
      reset: () => set(seed()),
    }),
    { name: "smartu-demo-db-v5" },
  ),
);

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
