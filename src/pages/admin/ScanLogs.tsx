import { useState } from "react";
import { PageHeader } from "@/components/domain/PageHeader";
import { DataTable, type Column } from "@/components/domain/DataTable";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { useScanLogs } from "@/hooks/useOps";
import type { ScanLog } from "@/types/api";

export default function ScanLogs() {
  const logs = useScanLogs();
  const [result, setResult] = useState("all");
  const rows = (logs.data ?? []).filter((l) => result === "all" || l.result === result);
  const cols: Column<ScanLog>[] = [
    { key: "ts", header: "Time", value: (l) => new Date(l.ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), render: (l) => <span className="text-base font-medium">{new Date(l.ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span> },
    { key: "studentName", header: "Student", render: (l) => <div><p className="text-base font-bold sm:text-lg">{l.studentName}</p><p className="text-sm sm:text-base text-muted-foreground">{l.rollNo}</p></div> },
    { key: "busId", header: "Bus", hideOnMobile: true, render: (l) => <span className="text-base font-semibold">{l.busId}</span> },
    { key: "result", header: "Result", render: (l) => <Badge tone={l.result === "SUCCESS" ? "success" : l.result === "MANUAL" ? "warning" : "danger"}>{l.result[0] + l.result.slice(1).toLowerCase()}</Badge> },
    { key: "reason", header: "Note", hideOnMobile: true, value: (l) => l.reason ?? "", render: (l) => <span className="text-base text-muted-foreground">{l.reason ?? "-"}</span> },
    { key: "conductor", header: "Conductor", hideOnMobile: true, render: (l) => <span className="text-base font-medium">{l.conductor}</span> },
  ];
  return (
    <div>
      <PageHeader title="Scan logs & attendance" description="Every boarding scan, failure and manual entry." />
      <DataTable columns={cols} rows={logs.data ? rows : undefined} rowKey={(l) => l.id} loading={logs.isLoading} error={logs.isError} onRetry={() => logs.refetch()} searchPlaceholder="Search logs…" exportName="scan-logs"
        toolbar={<div className="w-40"><Select aria-label="Filter by result" value={result} onChange={(e) => setResult(e.target.value)} className="h-11"><option value="all">All results</option><option value="SUCCESS">Success</option><option value="FAILED">Failed</option><option value="MANUAL">Manual</option></Select></div>} />
    </div>
  );
}
