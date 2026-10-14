import { useState } from "react";
import { CheckCheck, Clock, XCircle } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { DataTable, type Column } from "@/components/domain/DataTable";
import { StatCard } from "@/components/domain/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAction, useFees, useStudents } from "@/hooks/useOps";
import { financeService } from "@/services/ops";
import { formatPKR, timeAgo } from "@/lib/utils";
import type { FeeItem } from "@/types/api";

const tone = { SUBMITTED: "warning", PAID: "success", REJECTED: "danger", UNPAID: "neutral" } as const;
const label = { SUBMITTED: "Awaiting approval", PAID: "Approved", REJECTED: "Rejected", UNPAID: "Not paid" } as const;

export default function FeeApprovals() {
  const fees = useFees();
  const students = useStudents();
  const [view, setView] = useState<"pending" | "all">("pending");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<FeeItem | null>(null);
  const [reason, setReason] = useState("");

  const approve = useAction((ids: string[]) => financeService.approveFees(ids), { invalidate: [["fees"]], success: (n) => `${n} payment${n === 1 ? "" : "s"} approved`, onSuccess: () => setSel(new Set()) });
  const reject = useAction((v: { id: string; reason: string }) => financeService.rejectFee(v.id, v.reason), { invalidate: [["fees"]], success: "Rejected. The student was notified", onSuccess: () => { setRejecting(null); setReason(""); } });

  const dayFees = (fees.data ?? []).filter((f) => students.data?.find((s) => s.id === f.userId)?.residence !== "HOSTELITE");
  const rows = view === "pending" ? dayFees.filter((f) => f.status === "SUBMITTED") : dayFees;
  const student = (id: string) => students.data?.find((s) => s.id === id);

  const cols: Column<FeeItem>[] = [
    { key: "userId", header: "Student", value: (f) => student(f.userId)?.name ?? f.userId, render: (f) => <div><p className="text-base font-bold sm:text-lg">{student(f.userId)?.name ?? f.userId}</p><p className="text-sm sm:text-base text-muted-foreground">{student(f.userId)?.rollNo}</p></div> },
    { key: "semester", header: "Semester", hideOnMobile: true, value: (f) => f.semester ?? "-", render: (f) => <span className="text-base font-medium">{f.semester ?? "-"}</span> },
    { key: "amount", header: "Amount", render: (f) => <span className="text-base font-bold sm:text-lg">{formatPKR(f.amount)}</span> },
    { key: "method", header: "Method / ref.", hideOnMobile: true, sortable: false, render: (f) => f.reference ? <div><p className="text-base font-semibold">{f.method}</p><p className="text-sm sm:text-base text-muted-foreground">{f.reference}</p></div> : <span className="text-base text-muted-foreground">-</span> },
    { key: "submittedAt", header: "Submitted", hideOnMobile: true, value: (f) => f.submittedAt ?? "", render: (f) => <span className="text-base text-muted-foreground">{f.submittedAt ? timeAgo(f.submittedAt) : "-"}</span> },
    { key: "status", header: "Status", render: (f) => <Badge tone={tone[f.status]}>{label[f.status]}</Badge> },
    { key: "a", header: "", sortable: false, className: "text-right", render: (f) => f.status === "SUBMITTED" ? (
      <div className="flex justify-end gap-2">
        <Button size="sm" className="h-10 px-4 text-base font-semibold" loading={approve.isPending && approve.variables?.[0] === f.id && approve.variables.length === 1} onClick={() => approve.mutate([f.id])}>Approve</Button>
        <Button size="sm" variant="outline" className="h-10 px-4 text-base font-semibold" onClick={() => { setRejecting(f); setReason(""); }}>Reject</Button>
      </div>
    ) : null },
  ];

  const count = (s: FeeItem["status"]) => dayFees.filter((f) => f.status === s).length;

  return (
    <div>
      <PageHeader title="Fee approvals" description="Day scholars submit their semester fee payment; approve or reject it here, one by one or in bulk." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Awaiting approval" value={count("SUBMITTED")} icon={Clock} tone="warning" loading={fees.isLoading} />
        <StatCard label="Approved" value={count("PAID")} icon={CheckCheck} tone="success" loading={fees.isLoading} />
        <StatCard label="Rejected" value={count("REJECTED")} icon={XCircle} tone="danger" loading={fees.isLoading} />
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented label="View" value={view} onChange={(v) => { setView(v); setSel(new Set()); }} options={[{ value: "pending", label: `Pending (${count("SUBMITTED")})` }, { value: "all", label: "All day-scholar fees" }]} />
        <Button disabled={sel.size === 0} loading={approve.isPending && (approve.variables?.length ?? 0) > 1} onClick={() => approve.mutate([...sel])}>
          <CheckCheck className="h-5 w-5" /> Approve selected ({sel.size})
        </Button>
      </div>
      <DataTable columns={cols} rows={fees.data ? rows : undefined} rowKey={(f) => f.id} loading={fees.isLoading || students.isLoading} error={fees.isError} onRetry={() => fees.refetch()}
        selected={sel} onSelectedChange={setSel} isSelectable={(f) => f.status === "SUBMITTED"} searchPlaceholder="Search student, roll no., reference…" exportName="fee-submissions" emptyTitle="Nothing waiting for approval" emptyDescription="Submitted semester-fee payments will appear here." />

      <Modal open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)} title="Reject this payment?" description={rejecting ? `${student(rejecting.userId)?.name}: ${formatPKR(rejecting.amount)} · ${rejecting.reference}` : undefined}>
        <div className="space-y-4">
          <Input label="Reason (shown to the student)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Reference number not found" />
          <Button variant="danger" size="lg" className="w-full" loading={reject.isPending} onClick={() => rejecting && reject.mutate({ id: rejecting.id, reason })}>Reject payment</Button>
        </div>
      </Modal>
    </div>
  );
}
