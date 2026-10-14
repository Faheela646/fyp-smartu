export type Role = "ADMIN" | "DAY_SCHOLAR" | "HOSTELITE" | "FACULTY" | "CONDUCTOR";
export type PortalKind = "student" | "conductor" | "admin";

export interface User {
  id: string;
  identifier: string; // roll no. (students) or email name (staff)
  name: string;
  role: Role;
  email?: string;
  routeId?: string;
}

export interface LoginRequest {
  /** University email: f223284@cfd.nu.edu.pk (students) or firstname.lastname@cfd.nu.edu.pk (staff). */
  email: string;
  password: string;
}
export interface LoginResponse {
  token: string;
  user: User;
}

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Scheduled departure from this stop, "HH:mm" (from the university timetable). */
  time?: string;
}
export interface RouteContact {
  name: string;
  phone: string;
}
export interface TransportRoute {
  id: string;
  /** Printed route number, e.g. "05". */
  number: string;
  name: string; // "Route 05"
  /** First stop → campus, for display. */
  via: string;
  note?: string; // e.g. "Chiniot"
  /** Authorised person listed on the timetable. */
  contact?: RouteContact;
  color: string;
  stops: Stop[];
  path: [number, number][]; // [lat, lng]
  /** True while stop coordinates are schematic (not surveyed GPS points). */
  approxGeometry?: boolean;
}
export interface Bus {
  id: string;
  plate: string;
  routeId: string;
  seatCapacity: number;
  standingCapacity: number;
}

export interface BusPosition {
  busId: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  ts: string;
}
export interface SeatState {
  busId: string;
  routeId: string;
  seatsTotal: number;
  seatsAvailable: number;
  standingAvailable: number;
}

export type NotificationKind = "delay" | "schedule" | "fine" | "fee" | "seat" | "announcement" | "booking" | "system";
/** Who may see a notification. Omitted = everybody. A user matches if ANY listed rule matches. */
export interface Audience {
  users?: string[];
  roles?: Role[];
  routeIds?: string[];
}
export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  ts: string;
  read: boolean;
  audience?: Audience;
}

export type BookingType = "SEAT" | "STANDING";
export type BookingStatus = "CONFIRMED" | "CANCELLED" | "USED" | "EXPIRED";
export type TripType = "ONE_WAY" | "TWO_WAY";
export interface Booking {
  id: string;
  userId: string;
  busId: string;
  routeId: string;
  date: string;
  type: BookingType;
  price: number;
  status: BookingStatus;
}

/* ---------- Extended domain models ---------- */
export type Residence = "DAY_SCHOLAR" | "HOSTELITE" | "FACULTY";

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  email: string;
  phone: string;
  residence: Residence;
  routeId: string;
  /** Pick-up stop on the route. */
  stopId?: string;
  status: "ACTIVE" | "BANNED";
  banReason?: string;
}

export interface FeeItem {
  id: string;
  userId: string;
  title: string;
  semester?: string;
  amount: number;
  dueDate: string;
  /** SUBMITTED = day scholar sent payment details, waiting for admin approval. */
  status: "PAID" | "UNPAID" | "SUBMITTED" | "REJECTED";
  paidAt?: string;
  method?: string;
  reference?: string;
  submittedAt?: string;
  rejectReason?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  address: string;
  licenseNo?: string;
  busId?: string;
}

export interface Fine {
  id: string;
  userId: string;
  studentName: string;
  reason: string;
  amount: number;
  date: string;
  status: "UNPAID" | "PAID" | "WAIVED";
  issuedBy: string;
}

export type ViolationType = "No QR / pass" | "Standing without ticket" | "Misbehaviour" | "Wrong bus" | "Damage to property" | "Vape / pod found" | "Other";
export type ViolationAction = "FINED" | "DDC" | "DISMISSED";
export interface ViolationReport {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  type: ViolationType;
  notes: string;
  reportedBy: string;
  busId: string;
  routeId?: string;
  routeNumber?: string;
  plate?: string;
  ts: string;
  status: "OPEN" | "RESOLVED" | "ESCALATED";
  action?: ViolationAction;
  fineAmount?: number;
  offenceNo?: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  ts: string;
  audience: "ALL" | "HOSTELITE" | "DAY_SCHOLAR";
  author: string;
}

export interface Schedule {
  id: string;
  routeId: string;
  busId: string;
  direction: "TO_CAMPUS" | "FROM_CAMPUS";
  departTime: string; // HH:mm
  days: string[];
  active: boolean;
}

export interface Pricing {
  seatPrice: number;
  standingPrice: number;
  /** Fines ladder for conductor-reported violations: 1st / 2nd offence, 3rd+ goes to DDC. */
  firstOffenceFine: number;
  secondOffenceFine: number;
  cancelFeePercent: number;
  freeCancelHours: number;
  ddcEmail: string;
  semesterFeeDayScholar: number;
  /** Tickets are disposed automatically this many hours after the first leg's departure. */
  ticketValidHours: number;
  /** Minimum minutes between two scans of the same two-way ticket (stops accidental double scans). */
  legGapMinutes: number;
}

export interface ScanLog {
  id: string;
  ts: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  busId: string;
  result: "SUCCESS" | "FAILED" | "MANUAL";
  reason?: string;
  conductor: string;
  routeNumber?: string;
  bookingId?: string;
  /** Which use of the ticket this was (1 or 2) and how many it allows. */
  leg?: number;
  legs?: number;
}

export interface Registration {
  id: string;
  userId: string;
  semester: string;
  routeId: string;
  stopId: string;
  residence: Residence;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string;
  note?: string;
}

export interface HostelBill {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  /** "2026-10" */
  monthKey: string;
  month: string;
  seatTrips: number;
  standingTrips: number;
  amount: number;
  status: "PAID" | "UNPAID";
}

export interface BookingRecord extends Booking {
  seatNo?: number;
  /** ONE_WAY = 1 scan, TWO_WAY = 2 scans (going and coming back). */
  tripType: TripType;
  /** Leg for a one-way ticket; a two-way ticket starts TO_CAMPUS. */
  direction: "TO_CAMPUS" | "FROM_CAMPUS";
  usesAllowed: number;
  usesDone: number;
  departTime: string;
  /** Ticket is disposed automatically after this moment (trip start + validity hours). */
  expiresAt: string;
  routeName: string;
  routeNumber: string;
  plate: string;
  createdAt: string;
  cancelFee?: number;
}
