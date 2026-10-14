import { useState } from "react";
import { CheckCircle2, Clock, CreditCard, FileDown, Landmark, Send, Smartphone, Wallet, XCircle } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { StatCard } from "@/components/domain/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/confirm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useAction, useBills, useFees, useMe, usePricing } from "@/hooks/useOps";
import { useRoutes } from "@/hooks/useTransportData";
import { financeService } from "@/services/ops";
import { useAuthStore } from "@/store/auth";
import { challanFor, downloadChallans } from "@/lib/challan";
import { cn, formatPKR } from "@/lib/utils";
import type { FeeItem, HostelBill } from "@/types/api";

const METHODS = [
  { id: "JazzCash", icon: Smartphone },
  { id: "EasyPaisa", icon: Smartphone },
  { id: "Bank transfer", icon: Landmark },
  { id: "Debit card", icon: CreditCard },
];
const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function MethodPicker({ method, setMethod, legend }: { method: string; setMethod: (m: string) => void; legend: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <label key={m.id} className={cn("flex cursor-pointer items-center gap-2.5 rounded-md border-2 p-3.5 text-sm font-semibold focus-within:ring-2 focus-within:ring-ring", method === m.id ? "border-primary bg-primary-soft" : "border-border hover:bg-muted")}>
            <input type="radio" name="method" className="sr-only" checked={method === m.id} onChange={() => setMethod(m.id)} />
            <m.icon className="h-5 w-5" aria-hidden /> {m.id}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Hostelites: a monthly bill built from the tickets they book. */
function MonthlyBills() {
  const user = useAuthStore((s) => s.user)!;
  const bills = useBills(user.id);
  const me = useMe();
  const routes = useRoutes();
  const pricing = usePricing();
  const [target, setTarget] = useState<HostelBill | null>(null);
  const [method, setMethod] = useState("JazzCash");
  const pay = useAction((v: { id: string; method: string }) => financeService.payBill(v.id, v.method), { invalidate: [["bills"]], success: "Payment recorded", onSuccess: () => setTarget(null) });

  const list = [...(bills.data ?? [])].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  const unpaid = list.filter((b) => b.status === "UNPAID");
  const ready = !!me.data && !!routes.data && !!pricing.data;
  const download = (b: HostelBill) => {
    if (!me.data || !routes.data || !pricing.data) return;
    void downloadChallans([challanFor(me.data, [], list, routes.data, pricing.data, { monthKey: b.monthKey })], `monthly-challan-${me.data.rollNo}-${b.monthKey}`);
  };

  return (
    <div>
      <PageHeader title="Monthly fee" description="Hostelites are billed every month for the tickets they book. Download the monthly challan and pay it here." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Unpaid" value={unpaid.reduce((a, b) => a + b.amount, 0)} prefix="Rs. " icon={Wallet} tone={unpaid.length ? "warning" : "success"} loading={bills.isLoading} hint={unpaid.length ? `${unpaid.length} month(s)` : "Nothing due"} />
        <StatCard label="Paid on record" value={list.filter((b) => b.status === "PAID").reduce((a, b) => a + b.amount, 0)} prefix="Rs. " icon={CheckCircle2} tone="primary" loading={bills.isLoading} />
        <StatCard label="Tickets this month" value={list[0] ? list[0].seatTrips + list[0].standingTrips : 0} icon={Clock} tone="accent" loading={bills.isLoading} hint="Seat + standing trips" />
      </div>
      <Callout tone="info" title="How your bill works">
        Each ticket adds to the month's bill: Rs. {pricing.data?.seatPrice ?? 150} per seat trip and Rs. {pricing.data?.standingPrice ?? 75} per standing trip (a two-way ticket is two trips). Cancelling a ticket removes it from the bill.
      </Callout>
      <Card className="mt-6">
        <CardHeader><CardTitle>Bills</CardTitle></CardHeader>
        <CardContent>
          {bills.isError ? <ErrorState onRetry={() => bills.refetch()} /> : bills.isLoading ? <Skeleton className="h-32 w-full" /> : list.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No bills yet" description="Your first bill appears after you book a ticket." />
          ) : (
            <ul className="space-y-3">
              {list.map((b, i) => (
                <li key={b.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold">{b.month}{i === 0 && <span className="ml-2 text-sm font-semibold text-primary">Current month</span>}</p>
                      <p className="text-sm text-muted-foreground">{b.seatTrips} seat trip(s) · {b.standingTrips} standing trip(s)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-extrabold">{formatPKR(b.amount)}</p>
                      <Badge tone={b.status === "PAID" ? "success" : "warning"}>{b.status === "PAID" ? "Paid" : "Unpaid"}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => download(b)} disabled={!ready}><FileDown className="h-4 w-4" /> Monthly challan (PDF)</Button>
                    {b.status === "UNPAID" && b.amount > 0 && <Button size="sm" onClick={() => setTarget(b)}>Pay now</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Modal open={!!target} onOpenChange={(o) => !o && setTarget(null)} title="Pay monthly bill" description={target ? `${target.month}: ${formatPKR(target.amount)}` : undefined}>
        <MethodPicker method={method} setMethod={setMethod} legend="Payment method" />
        <p className="mt-3 text-xs text-muted-foreground">Demo mode records the payment without charging anything.</p>
        <Button size="lg" className="mt-4 w-full" loading={pay.isPending} onClick={() => target && pay.mutate({ id: target.id, method })}>Pay {target ? formatPKR(target.amount) : ""}</Button>
      </Modal>
    </div>
  );
}

/** Day scholars: one semester fee, submitted for admin approval. */
function SemesterFee() {
  const user = useAuthStore((s) => s.user)!;
  const fees = useFees(user.id);
  const me = useMe();
  const routes = useRoutes();
  const pricing = usePricing();
  const [target, setTarget] = useState<FeeItem | null>(null);
  const [method, setMethod] = useState("JazzCash");
  const [reference, setReference] = useState("");
  const [refError, setRefError] = useState<string | null>(null);

  const done = () => { setTarget(null); setReference(""); setRefError(null); };
  const submit = useAction((v: { id: string; method: string; reference: string }) => financeService.submitFee(v.id, v), {
    invalidate: [["fees"]],
    success: "Submitted. The Transport Office will verify and approve it.",
    onSuccess: done,
  });

  const list = [...(fees.data ?? [])].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const due = list.filter((f) => f.status === "UNPAID" || f.status === "REJECTED").reduce((a, f) => a + f.amount, 0);
  const waiting = list.filter((f) => f.status === "SUBMITTED").length;
  const ready = !!me.data && !!routes.data && !!pricing.data;
  const download = (f: FeeItem) => { if (me.data && routes.data && pricing.data) void downloadChallans([challanFor(me.data, [f], [], routes.data, pricing.data)], `semester-challan-${me.data.rollNo}`); };

  const onSubmit = () => {
    if (!target) return;
    if (reference.trim().length < 4) return setRefError("Enter the transaction / challan reference from your receipt (at least 4 characters).");
    setRefError(null);
    submit.mutate({ id: target.id, method, reference });
  };

  const badge = (f: FeeItem) =>
    f.status === "PAID" ? <Badge tone="success">Paid</Badge>
      : f.status === "SUBMITTED" ? <Badge tone="warning"><Clock className="h-3.5 w-3.5" /> Awaiting approval</Badge>
        : f.status === "REJECTED" ? <Badge tone="danger">Rejected</Badge>
          : <Badge tone="neutral">Unpaid</Badge>;

  return (
    <div>
      <PageHeader title="Semester fee" description="Day scholars pay once a semester. Download your challan, pay at the bank or app, then submit the receipt reference for approval." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Outstanding" value={due} prefix="Rs. " icon={Wallet} tone={due ? "warning" : "success"} loading={fees.isLoading} hint={due ? "Pay before the due date" : "Nothing due"} />
        <StatCard label="Awaiting approval" value={waiting} icon={Clock} tone="accent" loading={fees.isLoading} hint="Sent to Transport Office" />
        <StatCard label="Paid on record" value={list.filter((f) => f.status === "PAID").reduce((a, f) => a + f.amount, 0)} prefix="Rs. " icon={CheckCircle2} tone="primary" loading={fees.isLoading} />
      </div>
      <div className="mb-6">
        <Callout tone="info" title="How it works">
          1) Download the challan PDF (it has your roll number and your bus route). 2) Pay at any bank branch or app. 3) Submit the transaction reference below. 4) The Transport Office approves it and you'll get a notification.
        </Callout>
      </div>
      <Card>
        <CardHeader><CardTitle>Fee items</CardTitle></CardHeader>
        <CardContent>
          {fees.isError ? <ErrorState onRetry={() => fees.refetch()} /> : fees.isLoading ? <Skeleton className="h-32 w-full" /> : list.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No fee items" description="Nothing has been assigned to you yet." />
          ) : (
            <ul className="space-y-3">
              {list.map((f) => {
                const late = f.status === "UNPAID" && new Date(f.dueDate) < new Date();
                const canPay = f.status === "UNPAID" || f.status === "REJECTED";
                return (
                  <li key={f.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold">{f.title}</p>
                        <p className={cn("text-sm", late ? "font-semibold text-danger" : "text-muted-foreground")}>
                          {f.status === "PAID" ? `Paid ${f.paidAt ? fmt(f.paidAt) : ""}${f.method ? ` · ${f.method}` : ""}` : `${late ? "Overdue since" : "Due"} ${fmt(f.dueDate)}`}
                        </p>
                        {f.reference && <p className="text-sm text-muted-foreground">Reference: {f.reference}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-extrabold">{formatPKR(f.amount)}</p>
                        {badge(f)}
                      </div>
                    </div>
                    {f.status === "REJECTED" && f.rejectReason && <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger"><XCircle className="mr-1.5 inline h-4 w-4" />Rejected: {f.rejectReason}. Please check and resubmit.</p>}
                    {f.status === "SUBMITTED" && <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-sm font-medium text-warning">Submitted {f.submittedAt ? fmt(f.submittedAt) : ""}. Waiting for the Transport Office to approve.</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => download(f)} disabled={!ready}><FileDown className="h-4 w-4" /> Semester challan (PDF)</Button>
                      {canPay && <Button size="sm" onClick={() => { setTarget(f); setReference(""); setRefError(null); }}><Send className="h-4 w-4" /> {f.status === "REJECTED" ? "Resubmit payment" : "Submit payment"}</Button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <Modal open={!!target} onOpenChange={(o) => !o && done()} title="Submit your payment" description={target ? `${target.title}: ${formatPKR(target.amount)}` : undefined}>
        <MethodPicker method={method} setMethod={setMethod} legend="How did you pay?" />
        <div className="mt-4"><Input label="Transaction / receipt reference" value={reference} onChange={(e) => setReference(e.target.value)} error={refError ?? undefined} placeholder="e.g. TXN-48210" hint="Printed on your bank slip or app receipt" /></div>
        <Button size="lg" className="mt-4 w-full" loading={submit.isPending} onClick={onSubmit}>Submit for approval</Button>
      </Modal>
    </div>
  );
}

export default function Payments() {
  const role = useAuthStore((s) => s.user!.role);
  return role === "HOSTELITE" ? <MonthlyBills /> : <SemesterFee />;
}
