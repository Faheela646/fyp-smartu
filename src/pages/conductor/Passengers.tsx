import { useMemo } from "react";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { DataTable, type Column } from "@/components/domain/DataTable";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/domain/StatCard";
import { useAssignedBus } from "@/hooks/useConductorBus";
import { useBusBookings } from "@/hooks/useBookings";
import { useScanLogs, useStudents } from "@/hooks/useOps";
import { timeAgo } from "@/lib/utils";

interface Row {
  id: string;
  name: string;
  roll: string;
  kind: string;
  status: "Boarded" | "Waiting" | "Manual";
  when: string;
}

export default function Passengers() {
  const { bus, route } = useAssignedBus();
  const logs = useScanLogs();
  const tickets = useBusBookings(bus?.id);
  const students = useStudents();
  const today = new Date().toISOString().slice(0, 10);
  const who = (id: string) => students.data?.find((s) => s.id === id);

  const rows = useMemo<Row[]>(() => {
    if (!bus) return [];
    const out: Row[] = [];
    const boardedTickets = new Set<string>();
    (logs.data ?? []).filter((l) => l.busId === bus.id && l.result !== "FAILED" && l.ts.slice(0, 10) === today).forEach((l) => {
      if (l.bookingId) boardedTickets.add(l.bookingId);
      out.push({ id: l.id, name: l.studentName, roll: l.rollNo, kind: l.legs ? `Boarding ${l.leg} of ${l.legs}` : "Marked manually", status: l.result === "MANUAL" ? "Manual" : "Boarded", when: l.ts });
    });
    (tickets.data ?? []).filter((t) => t.status === "CONFIRMED" && t.date === today && t.usesDone === 0).forEach((t) => {
      out.push({ id: t.id, name: who(t.userId)?.name ?? t.userId, roll: who(t.userId)?.rollNo ?? "-", kind: `${t.tripType === "TWO_WAY" ? "Two-way" : "One-way"} · ${t.type === "SEAT" ? `Seat ${t.seatNo}` : "Standing"}`, status: "Waiting", when: t.createdAt });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus, logs.data, tickets.data, students.data, today]);

  const columns: Column<Row>[] = [
    { key: "name", header: "Student", render: (r) => <span className="text-base font-bold sm:text-lg">{r.name}</span> },
    { key: "roll", header: "Roll no.", hideOnMobile: true, render: (r) => <span className="font-mono text-base font-semibold">{r.roll}</span> },
    { key: "kind", header: "Ticket / boarding", render: (r) => <span className="text-base font-medium">{r.kind}</span> },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "Boarded" ? "success" : r.status === "Manual" ? "warning" : "primary"}>{r.status}</Badge> },
    { key: "when", header: "Time", hideOnMobile: true, render: (r) => <span className="text-base text-muted-foreground">{timeAgo(r.when)}</span> },
  ];

  return (
    <div>
      <PageHeader title="Passenger list" description={`Today's riders on ${route?.name ?? "your route"}${bus ? ` (${bus.plate})` : ""}: boarded, and ticket-holders still expected.`} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Boarded" value={rows.filter((r) => r.status !== "Waiting").length} icon={Users} tone="success" loading={logs.isLoading} />
        <StatCard label="Ticket, not boarded" value={rows.filter((r) => r.status === "Waiting").length} icon={Users} tone="primary" loading={tickets.isLoading} />
      </div>
      <DataTable columns={columns} rows={logs.isLoading || !bus ? undefined : rows} rowKey={(r) => r.id} loading={logs.isLoading} error={logs.isError} onRetry={() => logs.refetch()} searchPlaceholder="Search passengers…" pageSize={8} emptyTitle="No passengers yet" emptyDescription="Scanned and ticketed riders will appear here." />
    </div>
  );
}
