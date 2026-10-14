import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { RedirectHome, RequireRole } from "@/app/guards";
import { AppShell } from "@/app/layouts/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import Unauthorized from "@/pages/auth/Unauthorized";
import Notifications from "@/pages/Notifications";


// Route-level code splitting keeps the first load light (maps, charts, scanner load on demand).
const StudentHome = lazy(() => import("@/pages/student/Home"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const MyTickets = lazy(() => import("@/pages/student/MyTickets"));
const Attendance = lazy(() => import("@/pages/student/Attendance"));
const LiveMap = lazy(() => import("@/pages/student/LiveMap"));
const BookSeat = lazy(() => import("@/pages/student/Book"));
const MyQR = lazy(() => import("@/pages/student/MyQR"));
const Payments = lazy(() => import("@/pages/student/Payments"));
const Fines = lazy(() => import("@/pages/student/Fines"));
const Registration = lazy(() => import("@/pages/student/Registration"));
const Announcements = lazy(() => import("@/pages/student/Announcements"));
const Help = lazy(() => import("@/pages/student/Help"));
const Profile = lazy(() => import("@/pages/student/Profile"));

const Scan = lazy(() => import("@/pages/conductor/Scan"));
const Passengers = lazy(() => import("@/pages/conductor/Passengers"));
const Manual = lazy(() => import("@/pages/conductor/Manual"));
const Report = lazy(() => import("@/pages/conductor/Report"));

const Tracking = lazy(() => import("@/pages/admin/Tracking"));
const Students = lazy(() => import("@/pages/admin/Students"));
const Buses = lazy(() => import("@/pages/admin/Buses"));
const Drivers = lazy(() => import("@/pages/admin/Drivers"));
const FeeApprovals = lazy(() => import("@/pages/admin/FeeApprovals"));
const RoutesPage = lazy(() => import("@/pages/admin/RoutesPage"));
const Schedules = lazy(() => import("@/pages/admin/Schedules"));
const Pricing = lazy(() => import("@/pages/admin/Pricing"));
const BookingControl = lazy(() => import("@/pages/admin/BookingControl"));
const FinesBans = lazy(() => import("@/pages/admin/FinesBans"));
const HostelBilling = lazy(() => import("@/pages/admin/HostelBilling"));
const ScanLogs = lazy(() => import("@/pages/admin/ScanLogs"));
const AnnouncementsAdmin = lazy(() => import("@/pages/admin/AnnouncementsAdmin"));
const Reports = lazy(() => import("@/pages/admin/Reports"));

const STUDENT_ROLES = ["DAY_SCHOLAR", "HOSTELITE", "FACULTY"] as const;

const PageFallback = () => (
  <div className="space-y-4" role="status" aria-label="Loading page">
    <Skeleton className="h-10 w-64" />
    <Skeleton className="h-40 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
);

export function App() {
  return (
    <Suspense fallback={<div className="p-8"><PageFallback /></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/403" element={<Unauthorized />} />

        <Route path="/student" element={<RequireRole roles={[...STUDENT_ROLES]}><AppShell portal="student" /></RequireRole>}>
          <Route index element={<StudentHome />} />
          <Route path="map" element={<LiveMap />} />
          <Route path="book" element={<RequireRole nested roles={["DAY_SCHOLAR", "HOSTELITE", "FACULTY"]}><BookSeat /></RequireRole>} />
          <Route path="tickets" element={<MyTickets />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="qr" element={<MyQR />} />
          <Route path="payments" element={<Payments />} />
          <Route path="fines" element={<Fines />} />
          <Route path="registration" element={<RequireRole nested roles={["DAY_SCHOLAR", "FACULTY"]}><Registration /></RequireRole>} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="help" element={<Help />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/conductor" element={<RequireRole roles={["CONDUCTOR"]}><AppShell portal="conductor" /></RequireRole>}>
          <Route index element={<Scan />} />
          <Route path="passengers" element={<Passengers />} />
          <Route path="manual" element={<Manual />} />
          <Route path="report" element={<Report />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        <Route path="/admin" element={<RequireRole roles={["ADMIN"]}><AppShell portal="admin" /></RequireRole>}>
          <Route index element={<AdminDashboard />} />
          <Route path="tracking" element={<Tracking />} />
          <Route path="students" element={<Students />} />
          <Route path="buses" element={<Buses />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="fee-approvals" element={<FeeApprovals />} />
          <Route path="routes" element={<RoutesPage />} />
          <Route path="schedules" element={<Schedules />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="booking" element={<BookingControl />} />
          <Route path="fines" element={<FinesBans />} />
          <Route path="hostel-billing" element={<HostelBilling />} />
          <Route path="scan-logs" element={<ScanLogs />} />
          <Route path="announcements" element={<AnnouncementsAdmin />} />
          <Route path="reports" element={<Reports />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        <Route path="*" element={<RedirectHome />} />
      </Routes>
    </Suspense>
  );
}
