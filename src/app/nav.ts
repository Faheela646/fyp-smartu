import {
  LayoutDashboard, Map, Ticket, QrCode, CreditCard, AlertTriangle, ClipboardList, Megaphone, Bell, HelpCircle, User as UserIcon,
  ScanLine, Users, UserX, FileWarning, Bus, Route, CalendarClock, Wallet, ToggleRight, BarChart3, ScrollText, Receipt, BadgeCheck, IdCard, History, CalendarCheck, type LucideIcon,
} from "lucide-react";
import type { PortalKind, Role } from "@/types/api";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  roles?: Role[];
  /** Different wording for some roles (e.g. day scholars pay per semester, hostelites per month). */
  labelByRole?: Partial<Record<Role, string>>;
  /** Show in the mobile bottom bar (others go under "More"). */
  primary?: boolean;
}

export const NAV: Record<PortalKind, NavItem[]> = {
  student: [
    { to: "/student", label: "Home", icon: LayoutDashboard, end: true, primary: true },
    { to: "/student/map", label: "Live Map", icon: Map, primary: true },
    { to: "/student/book", label: "Book Ticket", icon: Ticket, roles: ["DAY_SCHOLAR", "HOSTELITE", "FACULTY"], primary: true },
    { to: "/student/qr", label: "My QR", icon: QrCode, primary: true },
    { to: "/student/tickets", label: "My Tickets", icon: History },
    { to: "/student/attendance", label: "Attendance", icon: CalendarCheck },
    { to: "/student/payments", label: "Fees", icon: CreditCard, labelByRole: { DAY_SCHOLAR: "Semester Fee", FACULTY: "Semester Fee", HOSTELITE: "Monthly Fee" } },
    { to: "/student/fines", label: "Fines & Violations", icon: AlertTriangle },
    { to: "/student/payment", label: "Payment", icon: Wallet, end: true },
    { to: "/student/registration", label: "Registration", icon: ClipboardList, roles: ["DAY_SCHOLAR", "FACULTY"] },
    { to: "/student/announcements", label: "Announcements", icon: Megaphone },
    { to: "/student/notifications", label: "Notifications", icon: Bell },
    { to: "/student/help", label: "Help & Chatbot", icon: HelpCircle },
    { to: "/student/profile", label: "Profile", icon: UserIcon },
  ],
  conductor: [
    { to: "/conductor", label: "Scan", icon: ScanLine, end: true, primary: true },
    { to: "/conductor/passengers", label: "Passengers", icon: Users, primary: true },
    { to: "/conductor/manual", label: "Manual", icon: UserX, primary: true },
    { to: "/conductor/report", label: "Report", icon: FileWarning, primary: true },
  ],
  admin: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/admin/tracking", label: "Live Tracking", icon: Map },
    { to: "/admin/students", label: "Students", icon: Users },
    { to: "/admin/fee-approvals", label: "Fee Approvals", icon: BadgeCheck },
    { to: "/admin/buses", label: "Buses", icon: Bus },
    { to: "/admin/drivers", label: "Drivers", icon: IdCard },
    { to: "/admin/routes", label: "Routes", icon: Route },
    { to: "/admin/schedules", label: "Schedules", icon: CalendarClock },
    { to: "/admin/pricing", label: "Fees & Pricing", icon: Wallet },
    { to: "/admin/booking", label: "Seat Booking", icon: ToggleRight },
    { to: "/admin/fines", label: "Fines & Bans", icon: AlertTriangle },
    { to: "/admin/hostel-billing", label: "Hostel Billing", icon: Receipt },
    { to: "/admin/scan-logs", label: "Scan Logs", icon: ScrollText },
    { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
    { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  ],
};

export const PORTAL_LABEL: Record<PortalKind, string> = {
  student: "Student Portal",
  conductor: "Conductor",
  admin: "Transport Admin",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  DAY_SCHOLAR: "Day Scholar",
  HOSTELITE: "Hostelite",
  FACULTY: "Faculty",
  CONDUCTOR: "Conductor",
};

export const labelOf = (item: NavItem, role: Role) => item.labelByRole?.[role] ?? item.label;
