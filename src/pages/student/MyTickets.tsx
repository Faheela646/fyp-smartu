import { useMemo, useState } from "react";
import { ArrowLeftRight, ArrowRight, Receipt, Ticket } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { DataTable, type Column } from "@/components/domain/DataTable";
import { StatCard } from "@/components/domain/StatCard";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { useMyBookings } from "@/hooks/useBookings";
import { useAuthStore } from "@/store/auth";
import { formatPKR } from "@/lib/utils";
import type { BookingRecord } from "@/types/api";

const statusTone = { CONFIRMED: "success", USED: "primary", CANCELLED: "neutral", EXPIRED: "warning" } as const;
const statusLabel = { CONFIRMED: "Active", USED: "Used", CANCELLED: "Cancelled", EXPIRED: "Disposed (time up)" } as const;
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const monthOf = (d: string) => d.slice(0, 7);
const monthName = (k: string) => new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });

export default function MyTickets() {
  const user = useAuthStore((s) => s.user)!;
  const isHostelite = user.role === "HOSTELITE";
  const q = useMyBookings(user.id);
  const [month, setMonth] = useState("all");

  const all = q.data ?? [];
  const months = useMemo(() => [...new Set(all.map((b) => monthOf(b.date)))].sort().reverse(), [all]);
  const rows = month === "all" ? all : all.filter((b) => monthOf(b.date) === month);
  const counted = rows.filter((b) => b.status !== "CANCELLED"); // tickets that were actually issued and kept
  const oneWay = counted.filter((b) => b.tripType === "ONE_WAY").length;
  const twoWay = counted.filter((b) => b.tripType === "TWO_WAY").length;
  const spent = counted.reduce((a, b) => a + b.price, 0);

  const cols: Column<BookingRecord>[] = [
    { key: "date", header: "Date", value: (b) => b.date, render: (b) => <span className="text-base font-semibold">{fmtDate(b.date)}</span> },
    { key: "routeNumber", header: "Route", value: (b) => `Route ${b.routeNumber}`, render: (b) => <div><p className="text-base font-bold sm:text-lg">Route {b.routeNumber}</p><p className="text-sm sm:text-base text-muted-foreground">{b.plate}</p></div> },
    { key: "tripType", header: "Ticket", value: (b) => (b.tripType === "TWO_WAY" ? "Two-way" : "One-way"), render: (b) => <Badge tone={b.tripType === "TWO_WAY" ? "accent" : "primary"}>{b.tripType === "TWO_WAY" ? <><ArrowLeftRight className="h-4 w-4" /> Two-way</> : <><ArrowRight className="h-4 w-4" /> One-way</>}</Badge> },
    { key: "direction", header: "Direction", hideOnMobile: true, value: (b) => (b.tripType === "TWO_WAY" ? "To & from campus" : b.direction === "TO_CAMPUS" ? "To campus" : "From campus"), render: (b) => <span className="text-base text-muted-foreground">{b.tripType === "TWO_WAY" ? "To & from campus" : b.direction === "TO_CAMPUS" ? "To campus" : "From campus"}</span> },
    { key: "seat", header: "Seat", hideOnMobile: true, value: (b) => (b.type === "SEAT" ? `Seat ${b.seatNo ?? "-"}` : "Standing"), render: (b) => <span className="text-base font-semibold">{b.type === "SEAT" ? `Seat ${b.seatNo ?? "-"}` : "Standing"}</span> },
    { key: "boardings", header: "Boardings", hideOnMobile: true, value: (b) => `${b.usesDone}/${b.usesAllowed}`, render: (b) => <span className="text-base tabular-nums">{b.usesDone}/{b.usesAllowed}</span> },
    ...(isHostelite ? [{ key: "price", header: "Price", value: (b: BookingRecord) => b.price, render: (b: BookingRecord) => (b.status === "CANCELLED" ? <span className="text-base text-muted-foreground line-through">{formatPKR(b.price)}</span> : <span className="text-base font-bold sm:text-lg">{formatPKR(b.price)}</span>) } as Column<BookingRecord>] : []),
    { key: "status", header: "Status", value: (b) => statusLabel[b.status], render: (b) => <Badge tone={statusTone[b.status]}>{statusLabel[b.status]}</Badge> },
  ];

  return (
    <div>
      <PageHeader title="My tickets" description="Every ticket you've booked: one-way or two-way. Download the log as CSV or PDF." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tickets booked" value={counted.length} icon={Ticket} tone="primary" loading={q.isLoading} hint={month === "all" ? "All time" : monthName(month)} />
        <StatCard label="One-way tickets" value={oneWay} icon={ArrowRight} tone="accent" loading={q.isLoading} />
        <StatCard label="Two-way tickets" value={twoWay} icon={ArrowLeftRight} tone="success" loading={q.isLoading} />
        {isHostelite ? <StatCard label="Total charged" value={spent} prefix="Rs. " icon={Receipt} tone="warning" loading={q.isLoading} hint="Billed monthly" /> : <StatCard label="Boardings used" value={counted.reduce((a, b) => a + b.usesDone, 0)} icon={Receipt} tone="warning" loading={q.isLoading} hint="Covered by semester fee" />}
      </div>
      <DataTable
        columns={cols}
        rows={q.data ? rows : undefined}
        rowKey={(b) => b.id}
        loading={q.isLoading}
        error={q.isError}
        onRetry={() => q.refetch()}
        searchPlaceholder="Search tickets…"
        exportName={`my-tickets-${user.identifier}`}
        pageSize={10}
        emptyTitle="No tickets yet"
        emptyDescription="Book a ticket and it will be listed here."
        toolbar={
          <div className="w-48">
            <Select aria-label="Filter by month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-11">
              <option value="all">All months</option>
              {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
            </Select>
          </div>
        }
      />
    </div>
  );
}
