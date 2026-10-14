import { useState } from "react";
import { CheckCircle2, Receipt } from "lucide-react";
import { Select } from "@/components/ui/form";
import { monthKeyOf } from "@/demo/db";
import { PageHeader } from "@/components/domain/PageHeader";
import { DataTable, type Column } from "@/components/domain/DataTable";
import { StatCard } from "@/components/domain/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAction, useBills } from "@/hooks/useOps";
import { financeService } from "@/services/ops";
import { formatPKR } from "@/lib/utils";
import type { HostelBill } from "@/types/api";

export default function HostelBilling() {
  const bills = useBills();
  const pay = useAction((id: string) => financeService.markBillPaid(id), { invalidate: [["bills"]], success: "Marked as paid" });
  const [month, setMonth] = useState(monthKeyOf());
  const months = [...new Set((bills.data ?? []).map((b) => b.monthKey))].sort().reverse();
  const list = (bills.data ?? []).filter((b) => b.monthKey === month);
  const cols: Column<HostelBill>[] = [
    { key: "studentName", header: "Student", render: (b) => <div><p className="text-base font-bold sm:text-lg">{b.studentName}</p><p className="text-sm sm:text-base text-muted-foreground">{b.rollNo}</p></div> },
    { key: "month", header: "Month", hideOnMobile: true, render: (b) => <span className="text-base font-medium">{b.month}</span> },
    { key: "seatTrips", header: "Seat trips", render: (b) => <span className="text-base font-semibold tabular-nums">{b.seatTrips}</span> },
    { key: "standingTrips", header: "Standing", hideOnMobile: true, render: (b) => <span className="text-base tabular-nums">{b.standingTrips}</span> },
    { key: "amount", header: "Amount", render: (b) => <span className="text-base font-bold sm:text-lg">{formatPKR(b.amount)}</span> },
    { key: "status", header: "Status", render: (b) => <Badge tone={b.status === "PAID" ? "success" : "warning"}>{b.status === "PAID" ? "Paid" : "Unpaid"}</Badge> },
    { key: "a", header: "", sortable: false, className: "text-right", render: (b) => b.status === "UNPAID" ? <Button size="sm" className="h-10 px-4 text-base font-semibold" onClick={() => pay.mutate(b.id)}><CheckCircle2 className="h-4.5 w-4.5" /> Mark paid</Button> : null },
  ];
  return (
    <div>
      <PageHeader title="Hostel billing" description="Monthly transport charges for hostelites, calculated from seat and standing trips." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Billed" value={list.reduce((a, b) => a + b.amount, 0)} prefix="Rs. " icon={Receipt} tone="primary" loading={bills.isLoading} />
        <StatCard label="Collected" value={list.filter((b) => b.status === "PAID").reduce((a, b) => a + b.amount, 0)} prefix="Rs. " icon={CheckCircle2} tone="success" loading={bills.isLoading} />
        <StatCard label="Outstanding" value={list.filter((b) => b.status === "UNPAID").reduce((a, b) => a + b.amount, 0)} prefix="Rs. " icon={Receipt} tone="warning" loading={bills.isLoading} />
      </div>
      <DataTable columns={cols} rows={bills.data ? list : undefined} toolbar={<div className="w-48"><Select aria-label="Billing month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-11">{months.map((m) => <option key={m} value={m}>{(bills.data ?? []).find((b) => b.monthKey === m)?.month}</option>)}</Select></div>} rowKey={(b) => b.id} loading={bills.isLoading} error={bills.isError} onRetry={() => bills.refetch()} searchPlaceholder="Search students…" exportName={`hostel-billing-${month}`} />
    </div>
  );
}
