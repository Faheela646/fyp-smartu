import { useState } from "react";
import { toast } from "sonner";
import { Ban, Copy, Gavel, Mail, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { DataTable, type Column } from "@/components/domain/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/confirm";
import { Select, Segmented, Textarea } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAction, useFines, usePricing, useStudents, useViolations } from "@/hooks/useOps";
import { financeService, studentService, violationService } from "@/services/ops";
import { decidePolicy, priorOffences } from "@/lib/policy";
import { timeAgo, formatPKR } from "@/lib/utils";
import type { Fine, Student, ViolationReport } from "@/types/api";

const REASONS = ["Boarded without a valid pass", "Standing without ticket", "Misbehaviour on bus", "Damage to property", "Late booking cancellation", "Other"];

interface Mail { id: string; to: string; subject: string; body: string }

export default function FinesBans() {
  const fines = useFines();
  const students = useStudents();
  const violations = useViolations();
  const pricing = usePricing();
  const [tab, setTab] = useState<"reports" | "fines" | "bans">("reports");
  const [issue, setIssue] = useState<{ userId: string; reason: string; amount: string } | null>(null);
  const [custom, setCustom] = useState<{ v: ViolationReport; amount: string } | null>(null);
  const [mail, setMail] = useState<Mail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const openMail = (id: string) => { const m = violationService.ddcMail(id); setMail({ id, to: m.to, subject: m.subject, body: m.body }); };

  const doIssue = useAction((f: { userId: string; reason: string; amount: number }) => financeService.issueFine({ ...f, issuedBy: "Transport Office" }), { invalidate: [["fines"]], success: "Fine issued and student notified", onSuccess: () => setIssue(null) });
  const waive = useAction((id: string) => financeService.waiveFine(id), { invalidate: [["fines"]], success: "Fine waived" });
  const apply = useAction((id: string) => violationService.applyPolicy(id), {
    invalidate: [["violations"], ["fines"]],
    onSuccess: (v) => {
      if (v.action === "DDC") { toast.success(`Offence #${v.offenceNo}: referred to DDC`, { description: "Review and send the email draft." }); openMail(v.id); }
      else toast.success(`Offence #${v.offenceNo}: fined ${formatPKR(v.fineAmount ?? 0)}`, { description: "The student was notified." });
    },
  });
  const customFine = useAction((v: { id: string; amount: number }) => violationService.override(v.id, "FINED", v.amount), { invalidate: [["violations"], ["fines"]], success: "Custom fine issued", onSuccess: () => setCustom(null) });
  const toDdc = useAction((id: string) => violationService.override(id, "DDC"), { invalidate: [["violations"]], onSuccess: (v) => { toast.success("Referred to DDC"); openMail(v.id); } });
  const dismiss = useAction((id: string) => violationService.dismiss(id), { invalidate: [["violations"]], success: "Report dismissed" });
  const ban = useAction((v: { id: string; banned: boolean }) => studentService.setBan(v.id, v.banned, "Violation reports"), { invalidate: [["students"]], success: "Account updated" });

  const openIssue = (userId = "") => { setErr(null); setIssue({ userId, reason: REASONS[0], amount: String(pricing.data?.firstOffenceFine ?? 1000) }); };
  const submit = () => {
    if (!issue) return;
    const amt = Number(issue.amount);
    if (!issue.userId) return setErr("Choose a student.");
    if (!amt || amt < 1) return setErr("Enter a valid amount.");
    doIssue.mutate({ userId: issue.userId, reason: issue.reason, amount: amt });
  };
  const copyMail = async () => {
    if (!mail) return;
    try { await navigator.clipboard.writeText(`To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.body}`); toast.success("Email copied to clipboard"); } catch { toast.error("Couldn't copy. Select the text manually."); }
  };

  const all = violations.data ?? [];
  const suggestion = (v: ViolationReport) => (pricing.data ? decidePolicy(v.type, priorOffences(all, v.studentId, v.id), pricing.data) : null);

  const fineCols: Column<Fine>[] = [
    { key: "studentName", header: "Student", render: (f) => <span className="text-base font-bold sm:text-lg">{f.studentName}</span> },
    { key: "reason", header: "Reason", render: (f) => <span className="text-base">{f.reason}</span> },
    { key: "amount", header: "Amount", render: (f) => <span className="text-base font-bold sm:text-lg">{formatPKR(f.amount)}</span> },
    { key: "date", header: "Issued", hideOnMobile: true, value: (f) => f.date.slice(0, 10), render: (f) => <span className="text-base text-muted-foreground">{f.date.slice(0, 10)}</span> },
    { key: "status", header: "Status", render: (f) => <Badge tone={f.status === "PAID" ? "success" : f.status === "WAIVED" ? "neutral" : "danger"}>{f.status[0] + f.status.slice(1).toLowerCase()}</Badge> },
    { key: "a", header: "", sortable: false, className: "text-right", render: (f) => f.status === "UNPAID" ? <Button size="sm" className="h-10 px-4 text-base font-semibold" variant="outline" onClick={() => waive.mutate(f.id)}>Waive</Button> : null },
  ];

  const repCols: Column<ViolationReport>[] = [
    { key: "studentName", header: "Student", render: (v) => <div><p className="text-base font-bold sm:text-lg">{v.studentName}</p><p className="text-sm sm:text-base text-muted-foreground">{v.rollNo}</p></div> },
    { key: "routeNumber", header: "Route", value: (v) => `Route ${v.routeNumber ?? "-"}`, render: (v) => <span className="text-base font-bold">Route {v.routeNumber ?? "-"}</span> },
    { key: "type", header: "Violation", render: (v) => <div><p className="text-base font-semibold">{v.type}</p><p className="text-sm sm:text-base text-muted-foreground">{v.notes}</p></div> },
    { key: "reportedBy", header: "Reported", hideOnMobile: true, value: (v) => `${v.reportedBy} · ${timeAgo(v.ts)}`, render: (v) => <span className="text-base text-muted-foreground">{v.reportedBy} · {timeAgo(v.ts)}</span> },
    {
      key: "policy", header: "Policy says", sortable: false, hideOnMobile: true,
      render: (v) => {
        if (v.status !== "OPEN") return v.action === "FINED" ? <Badge tone="success">Fined {formatPKR(v.fineAmount ?? 0)} · #{v.offenceNo}</Badge> : v.action === "DDC" ? <Badge tone="danger">Referred to DDC</Badge> : <Badge tone="neutral">Dismissed</Badge>;
        const s = suggestion(v);
        return s ? <div><Badge tone={s.action === "DDC" ? "danger" : "warning"}>Offence #{s.offenceNo}</Badge><p className="mt-1 text-base font-semibold">{s.action === "DDC" ? "Refer to DDC" : `Fine ${formatPKR(s.amount ?? 0)}`}</p></div> : null;
      },
    },
    { key: "status", header: "Status", render: (v) => <Badge tone={v.status === "OPEN" ? "warning" : v.status === "RESOLVED" ? "success" : "danger"}>{v.status[0] + v.status.slice(1).toLowerCase()}</Badge> },
    {
      key: "a", header: "", sortable: false, className: "text-right",
      render: (v) => v.status === "OPEN" ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" className="h-10 px-3.5 text-base font-semibold" loading={apply.isPending && apply.variables === v.id} onClick={() => apply.mutate(v.id)}><Gavel className="h-4.5 w-4.5" /> Apply policy</Button>
          <Button size="sm" className="h-10 px-3.5 text-base font-semibold" variant="outline" onClick={() => setCustom({ v, amount: "" })}>Custom fine</Button>
          <Button size="sm" className="h-10 px-3.5 text-base font-semibold" variant="outline" onClick={() => toDdc.mutate(v.id)}><Mail className="h-4.5 w-4.5" /> DDC</Button>
          <Button size="sm" className="h-10 px-3 text-base font-semibold" variant="ghost" onClick={() => dismiss.mutate(v.id)}>Dismiss</Button>
        </div>
      ) : v.action === "DDC" ? <Button size="sm" className="h-10 px-4 text-base font-semibold" variant="outline" onClick={() => openMail(v.id)}><Mail className="h-4.5 w-4.5" /> View email</Button> : null,
    },
  ];

  const banCols: Column<Student>[] = [
    { key: "name", header: "Student", render: (s) => <span className="text-base font-bold sm:text-lg">{s.name}</span> },
    { key: "rollNo", header: "Roll no.", render: (s) => <span className="font-mono text-base font-semibold">{s.rollNo}</span> },
    { key: "banReason", header: "Reason", value: (s) => s.banReason ?? "", render: (s) => <span className="text-base text-muted-foreground">{s.banReason ?? ""}</span> },
    { key: "a", header: "", sortable: false, className: "text-right", render: (s) => <Button size="sm" className="h-10 px-4 text-base font-semibold" variant="outline" onClick={() => ban.mutate({ id: s.id, banned: false })}><ShieldCheck className="h-4.5 w-4.5" /> Lift ban</Button> },
  ];
  const activeStudents = (students.data ?? []).filter((s) => s.status === "ACTIVE");
  const p = pricing.data;

  return (
    <div>
      <PageHeader title="Fines & bans" description="Conductor reports come in here. Apply the policy, fine manually, or refer to the DDC." actions={<Button onClick={() => openIssue()}><Plus className="h-5 w-5" /> Issue fine</Button>} />

      <div className="mb-5">
        <Callout tone="info" title="Violation policy">
          1st offence: {formatPKR(p?.firstOffenceFine ?? 1000)} · 2nd offence: {formatPKR(p?.secondOffenceFine ?? 5000)} · 3rd offence: DDC referral · Vape / pod found: direct DDC. Amounts are editable under Fees & Pricing.
        </Callout>
      </div>

      <div className="mb-4"><Segmented label="View" value={tab} onChange={setTab} options={[{ value: "reports", label: `Reports (${all.filter((v) => v.status === "OPEN").length})` }, { value: "fines", label: "Fines" }, { value: "bans", label: "Bans" }]} /></div>
      {tab === "reports" && <DataTable columns={repCols} rows={violations.data} rowKey={(v) => v.id} loading={violations.isLoading} searchPlaceholder="Search reports…" exportName="violation-reports" emptyTitle="No reports" />}
      {tab === "fines" && <DataTable columns={fineCols} rows={fines.data} rowKey={(f) => f.id} loading={fines.isLoading} searchPlaceholder="Search fines…" exportName="fines" emptyTitle="No fines" />}
      {tab === "bans" && <DataTable columns={banCols} rows={(students.data ?? []).filter((s) => s.status === "BANNED")} rowKey={(s) => s.id} loading={students.isLoading} searchPlaceholder="Search banned students…" emptyTitle="No banned students" emptyDescription="Ban students from the Students page." />}

      {/* manual fine */}
      <Modal open={!!issue} onOpenChange={(o) => !o && setIssue(null)} title="Issue a fine">
        {issue && (
          <div className="space-y-4">
            <Select label="Student" value={issue.userId} onChange={(e) => setIssue({ ...issue, userId: e.target.value })}><option value="">Choose a student…</option>{activeStudents.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.rollNo}</option>)}</Select>
            <Select label="Reason" value={issue.reason} onChange={(e) => setIssue({ ...issue, reason: e.target.value })}>{REASONS.map((r) => <option key={r}>{r}</option>)}</Select>
            <Input label="Amount (Rs.)" type="number" value={issue.amount} onChange={(e) => setIssue({ ...issue, amount: e.target.value })} />
            {err && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{err}</p>}
            <Button size="lg" className="w-full" loading={doIssue.isPending} onClick={submit}><Ban className="h-5 w-5" /> Issue fine</Button>
          </div>
        )}
      </Modal>

      {/* custom fine for a report */}
      <Modal open={!!custom} onOpenChange={(o) => !o && setCustom(null)} title="Custom fine" description={custom ? `${custom.v.studentName} · ${custom.v.type}` : undefined}>
        {custom && (
          <div className="space-y-4">
            <Input label="Amount (Rs.)" type="number" autoFocus value={custom.amount} onChange={(e) => setCustom({ ...custom, amount: e.target.value })} />
            <Button size="lg" className="w-full" disabled={!Number(custom.amount)} loading={customFine.isPending} onClick={() => customFine.mutate({ id: custom.v.id, amount: Number(custom.amount) })}>Issue fine</Button>
          </div>
        )}
      </Modal>

      {/* DDC email draft */}
      <Modal open={!!mail} onOpenChange={(o) => !o && setMail(null)} title="Email to the DDC" description="Review the draft, then open it in your email app or copy it." className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {mail && (
          <div className="space-y-4">
            <Input label="To" value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} />
            <Input label="Subject" value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />
            <Textarea label="Message" rows={12} value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild size="lg" className="flex-1">
                <a href={`mailto:${mail.to}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`}><Mail className="h-5 w-5" /> Open in email app</a>
              </Button>
              <Button size="lg" variant="outline" className="flex-1" onClick={copyMail}><Copy className="h-5 w-5" /> Copy email</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
