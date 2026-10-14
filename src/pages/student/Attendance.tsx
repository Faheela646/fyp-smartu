import { CalendarCheck, Route as RouteIcon, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { DataTable, type Column } from "@/components/domain/DataTable";
import { StatCard } from "@/components/domain/StatCard";
import { Badge } from "@/components/ui/badge";
import { useMyLogs } from "@/hooks/useOps";
import { useAuthStore } from "@/store/auth";
import type { ScanLog } from "@/types/api";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function Attendance() {
  const user = useAuthStore((s) => s.user)!;
  const q = useMyLogs();
  const list = q.data ?? [];
  const thisMonth = list.filter((l) => l.ts.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;
  const routesUsed = new Set(list.map((l) => l.routeNumber).filter(Boolean)).size;
  const last = list[0];

  const cols: Column<ScanLog>[] = [
    { key: "ts", header: "Date", value: (l) => fmtDate(l.ts), render: (l) => <span className="text-base font-semibold">{fmtDate(l.ts)}</span> },
    { key: "time", header: "Time", value: (l) => fmtTime(l.ts), render: (l) => <span className="text-base font-medium tabular-nums">{fmtTime(l.ts)}</span> },
    { key: "routeNumber", header: "Route", value: (l) => `Route ${l.routeNumber ?? "-"}`, render: (l) => <span className="text-base font-bold sm:text-lg">Route {l.routeNumber ?? "-"}</span> },
    { key: "busId", header: "Bus", hideOnMobile: true, render: (l) => <span className="text-base font-semibold">{l.busId}</span> },
    { key: "leg", header: "Boarding", value: (l) => (l.legs ? `${l.leg} of ${l.legs}` : "Manual"), render: (l) => (l.legs ? <Badge tone="primary">{l.leg} of {l.legs}</Badge> : <Badge tone="warning">Marked by conductor</Badge>) },
  ];

  return (
    <div>
      <PageHeader title="Attendance" description="A record of every time you boarded a university bus. Each QR scan or manual entry by the conductor is listed." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total boardings" value={list.length} icon={ScanLine} tone="primary" loading={q.isLoading} />
        <StatCard label="This month" value={thisMonth} icon={CalendarCheck} tone="success" loading={q.isLoading} />
        <StatCard label="Routes used" value={routesUsed} icon={RouteIcon} tone="accent" loading={q.isLoading} hint={last ? `Last: ${fmtDate(last.ts)}, ${fmtTime(last.ts)}` : "No boardings yet"} />
      </div>
      <DataTable columns={cols} rows={q.data} rowKey={(l) => l.id} loading={q.isLoading} error={q.isError} onRetry={() => q.refetch()} searchPlaceholder="Search your boardings…" exportName={`attendance-${user.identifier}`} emptyTitle="No boardings yet" emptyDescription="When you scan your ticket on a bus, it shows up here." />
    </div>
  );
}
