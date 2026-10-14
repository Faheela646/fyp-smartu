import { Lock, Ticket, Unlock } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { DataTable, type Column } from "@/components/domain/DataTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/domain/StatCard";
import { Switch } from "@/components/ui/switch";
import { useAllBookings } from "@/hooks/useBookings";
import { useAction, useStudents } from "@/hooks/useOps";
import { settingsService } from "@/services/ops";
import { useRealtimeStore } from "@/store/realtime";
import { formatPKR } from "@/lib/utils";
import type { BookingRecord } from "@/types/api";

export default function BookingControl() {
  const enabled = useRealtimeStore((s) => s.bookingEnabled);
  const bookings = useAllBookings();
  const students = useStudents();
  const toggle = useAction((on: boolean) => settingsService.setBookingEnabled(on), { success: "Setting saved and broadcast to students" });
  const list = bookings.data ?? [];

  const cols: Column<BookingRecord>[] = [
    { key: "userId", header: "Student", value: (b) => students.data?.find((s) => s.id === b.userId)?.name ?? b.userId, render: (b) => <span className="text-base font-bold sm:text-lg">{students.data?.find((s) => s.id === b.userId)?.name ?? b.userId}</span> },
    { key: "routeName", header: "Route", render: (b) => <span className="text-base font-semibold">{b.routeName}</span> },
    { key: "date", header: "Date", hideOnMobile: true, render: (b) => <span className="text-base text-muted-foreground">{b.date}</span> },
    { key: "type", header: "Ticket", value: (b) => (b.type === "SEAT" ? `Seat ${b.seatNo ?? ""}` : "Standing"), render: (b) => <span className="text-base font-semibold">{b.type === "SEAT" ? `Seat ${b.seatNo ?? ""}` : "Standing"}</span> },
    { key: "price", header: "Price", value: (b) => b.price, render: (b) => <span className="text-base font-bold sm:text-lg">{formatPKR(b.price)}</span>, hideOnMobile: true },
    { key: "status", header: "Status", render: (b) => <Badge tone={b.status === "CONFIRMED" ? "success" : b.status === "USED" ? "primary" : "neutral"}>{b.status[0] + b.status.slice(1).toLowerCase()}</Badge> },
  ];

  return (
    <div>
      <PageHeader title="Seat booking control" description="Switch hostelite booking on or off for everyone, instantly." />
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span className={`grid h-14 w-14 place-items-center rounded-md ${enabled ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{enabled ? <Unlock className="h-7 w-7" /> : <Lock className="h-7 w-7" />}</span>
            <div>
              <p className="text-xl font-extrabold">Booking is {enabled ? "open" : "paused"}</p>
              <p className="text-muted-foreground">{enabled ? "Hostelites can reserve seats and standing tickets." : "Students see a banner and can't create new bookings."}</p>
            </div>
          </div>
          <label className="flex items-center gap-3 text-base font-semibold">
            {enabled ? "Enabled" : "Disabled"}
            <Switch checked={enabled} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} aria-label="Enable seat booking" />
          </label>
        </CardContent>
      </Card>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active bookings" value={list.filter((b) => b.status === "CONFIRMED").length} icon={Ticket} tone="success" loading={bookings.isLoading} />
        <StatCard label="Cancelled" value={list.filter((b) => b.status === "CANCELLED").length} icon={Ticket} tone="warning" loading={bookings.isLoading} />
      </div>
      <DataTable columns={cols} rows={bookings.data} rowKey={(b) => b.id} loading={bookings.isLoading} searchPlaceholder="Search bookings…" exportName="bookings" emptyTitle="No bookings yet" emptyDescription="Bookings made by hostelites appear here in real time." />
    </div>
  );
}
