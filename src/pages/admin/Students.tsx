import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Ban, CheckCheck, Download, FileSpreadsheet, FileText, GraduationCap, Home, Pencil, Plus, ShieldCheck, Upload, Users, XCircle } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { DataTable, type Column } from "@/components/domain/DataTable";
import { StatCard } from "@/components/domain/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, ConfirmDialog } from "@/components/ui/confirm";
import { Select, Segmented, Textarea } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAction, useBills, useFees, usePricing, useRegistrations, useStudents } from "@/hooks/useOps";
import { useRoutes } from "@/hooks/useTransportData";
import { registrationService, studentService } from "@/services/ops";
import { challanFor, downloadChallans } from "@/lib/challan";
import { parseStudentsCsv, STUDENT_CSV_TEMPLATE } from "@/lib/csv";
import { uid } from "@/demo/db";
import type { Registration, Student } from "@/types/api";

const schema = z.object({
  name: z.string().trim().min(3, "Enter the full name"),
  rollNo: z.string().trim().regex(/^\d{2}[A-Za-z]-\d{4}$/, "Format: 22F-3091"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().min(7, "Enter a phone number"),
  residence: z.enum(["DAY_SCHOLAR", "HOSTELITE", "FACULTY"]),
  routeId: z.string().min(1, "Choose a route"),
});
type Form = z.infer<typeof schema>;

const typeLabel = { DAY_SCHOLAR: "Day scholar", HOSTELITE: "Hostelite", FACULTY: "Faculty" } as const;

export default function Students() {
  const students = useStudents();
  const routes = useRoutes();
  const regs = useRegistrations();
  const fees = useFees();
  const bills = useBills();
  const pricing = usePricing();
  const [tab, setTab] = useState<"students" | "registrations">("students");
  const [edit, setEdit] = useState<Student | "new" | null>(null);
  const [banTarget, setBanTarget] = useState<Student | null>(null);
  const [banReason, setBanReason] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [regSel, setRegSel] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [csv, setCsv] = useState("");

  const list = students.data ?? [];
  const count = (f: (s: Student) => boolean) => list.filter(f).length;
  const perRoute = useMemo(() => routes.data?.map((r) => ({ name: r.name.replace(" Route", ""), color: r.color, n: list.filter((s) => s.routeId === r.id).length })) ?? [], [routes.data, list]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const openEdit = (s: Student | "new") => {
    setEdit(s);
    reset(s === "new" ? { name: "", rollNo: "", email: "", phone: "", residence: "DAY_SCHOLAR", routeId: "" } : { name: s.name, rollNo: s.rollNo, email: s.email, phone: s.phone, residence: s.residence, routeId: s.routeId });
  };
  const save = useAction((f: Form) => studentService.save({ ...(edit && edit !== "new" ? edit : { id: uid("U"), status: "ACTIVE" as const }), ...f }), { invalidate: [["students"]], success: "Student saved", onSuccess: () => setEdit(null) });
  const ban = useAction((v: { id: string; banned: boolean; reason?: string }) => studentService.setBan(v.id, v.banned, v.reason), { invalidate: [["students"]], success: "Account updated", onSuccess: () => setBanTarget(null) });
  const decide = useAction((v: { ids: string[]; s: "APPROVED" | "REJECTED" }) => registrationService.decideMany(v.ids, v.s), {
    invalidate: [["registrations"]],
    success: (n) => `${n} registration${n === 1 ? "" : "s"} updated`,
    onSuccess: () => setRegSel(new Set()),
  });

  // bulk add
  const parsed = useMemo(() => (csv.trim() ? parseStudentsCsv(csv, routes.data?.map((r) => r.id) ?? []) : []), [csv, routes.data]);
  const good = parsed.filter((p) => p.data);
  const bad = parsed.filter((p) => p.error);
  const bulk = useAction(() => studentService.bulkAdd(good.map((g) => g.data!)), {
    invalidate: [["students"]],
    onSuccess: (r) => { toast.success(`${r.added} student${r.added === 1 ? "" : "s"} added`, { description: r.skipped.length ? `Skipped existing roll numbers: ${r.skipped.join(", ")}` : undefined }); setBulkOpen(false); setCsv(""); },
  });
  const readFile = async (f?: File) => { if (f) setCsv(await f.text()); };
  const downloadTemplate = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([STUDENT_CSV_TEMPLATE], { type: "text/csv" }));
    a.download = "students-template.csv";
    a.click();
  };

  const challans = (ss: Student[]) => {
    if (!routes.data || !pricing.data || !fees.data || !bills.data) return toast.error("Data is still loading. Try again in a moment.");
    // Day scholars get a semester challan, hostelites a monthly one.
    void downloadChallans(ss.map((s) => challanFor(s, fees.data!, bills.data!, routes.data!, pricing.data!)), ss.length === 1 ? `challan-${ss[0].rollNo}` : `challans-${ss.length}-students`)
      .then(() => toast.success(`${ss.length} challan${ss.length === 1 ? "" : "s"} generated (${ss.some((s) => s.residence === "HOSTELITE") && ss.some((s) => s.residence !== "HOSTELITE") ? "semester + monthly" : ss[0]?.residence === "HOSTELITE" ? "monthly" : "semester"})`));
  };

  const cols: Column<Student>[] = [
    { key: "name", header: "Student", render: (s) => <div><p className="text-base font-bold sm:text-lg">{s.name}</p><p className="text-sm sm:text-base text-muted-foreground">{s.email}</p></div> },
    { key: "rollNo", header: "Roll no.", render: (s) => <span className="font-mono text-base font-semibold">{s.rollNo}</span> },
    { key: "residence", header: "Type", hideOnMobile: true, value: (s) => typeLabel[s.residence], render: (s) => <Badge tone={s.residence === "HOSTELITE" ? "accent" : "primary"}>{typeLabel[s.residence]}</Badge> },
    { key: "routeId", header: "Route", hideOnMobile: true, value: (s) => routes.data?.find((r) => r.id === s.routeId)?.name ?? s.routeId, render: (s) => <span className="text-base font-semibold">{routes.data?.find((r) => r.id === s.routeId)?.name ?? s.routeId}</span> },
    { key: "status", header: "Status", render: (s) => <Badge tone={s.status === "ACTIVE" ? "success" : "danger"}>{s.status === "ACTIVE" ? "Active" : "Banned"}</Badge> },
    {
      key: "actions", header: "", sortable: false, className: "text-right",
      render: (s) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => challans([s])} aria-label={`Fee challan PDF for ${s.name}`} title="Fee challan (PDF)"><FileText className="h-4.5 w-4.5" /></Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}><Pencil className="h-4.5 w-4.5" /></Button>
          {s.status === "ACTIVE" ? (
            <Button variant="ghost" size="icon" className="h-10 w-10 text-danger" onClick={() => { setBanTarget(s); setBanReason(""); }} aria-label={`Ban ${s.name}`}><Ban className="h-4.5 w-4.5" /></Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-10 w-10 text-success" onClick={() => ban.mutate({ id: s.id, banned: false })} aria-label={`Lift ban for ${s.name}`}><ShieldCheck className="h-4.5 w-4.5" /></Button>
          )}
        </div>
      ),
    },
  ];

  const nameOf = (id: string) => list.find((s) => s.id === id);
  const rcols: Column<Registration>[] = [
    { key: "userId", header: "Student", value: (r) => nameOf(r.userId)?.name ?? r.userId, render: (r) => <div><p className="text-base font-bold sm:text-lg">{nameOf(r.userId)?.name ?? r.userId}</p><p className="text-sm sm:text-base text-muted-foreground">{nameOf(r.userId)?.rollNo}</p></div> },
    { key: "semester", header: "Semester", hideOnMobile: true, render: (r) => <span className="text-base font-medium">{r.semester}</span> },
    { key: "routeId", header: "Route", value: (r) => routes.data?.find((x) => x.id === r.routeId)?.name ?? r.routeId, render: (r) => <span className="text-base font-semibold">{routes.data?.find((x) => x.id === r.routeId)?.name ?? r.routeId}</span> },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "APPROVED" ? "success" : r.status === "PENDING" ? "warning" : "danger"}>{r.status[0] + r.status.slice(1).toLowerCase()}</Badge> },
    { key: "actions", header: "", sortable: false, className: "text-right", render: (r) => r.status === "PENDING" ? <div className="flex justify-end gap-2"><Button size="sm" className="h-10 px-4 text-base font-semibold" onClick={() => decide.mutate({ ids: [r.id], s: "APPROVED" })}>Approve</Button><Button size="sm" variant="outline" className="h-10 px-4 text-base font-semibold" onClick={() => decide.mutate({ ids: [r.id], s: "REJECTED" })}>Reject</Button></div> : null },
  ];
  const pending = (regs.data ?? []).filter((r) => r.status === "PENDING").length;

  return (
    <div>
      <PageHeader title="Students" description="Accounts, bans, fee challans and semester registrations."
        actions={<>
          <Button variant="outline" size="lg" onClick={() => setBulkOpen(true)}><Upload className="h-5 w-5" /> Bulk add</Button>
          <Button size="lg" onClick={() => openEdit("new")}><Plus className="h-5 w-5" /> Add student</Button>
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total students" value={list.length} icon={Users} tone="primary" loading={students.isLoading} />
        <StatCard label="Day scholars" value={count((s) => s.residence === "DAY_SCHOLAR")} icon={GraduationCap} tone="accent" loading={students.isLoading} />
        <StatCard label="Hostelites" value={count((s) => s.residence === "HOSTELITE")} icon={Home} tone="success" loading={students.isLoading} />
        <StatCard label="Banned" value={count((s) => s.status === "BANNED")} icon={Ban} tone="danger" loading={students.isLoading} />
      </div>
      <ul className="mb-6 flex flex-wrap gap-2" aria-label="Students per route">
        {perRoute.map((r) => <li key={r.name} className="flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: r.color }} />{r.name}<span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{r.n}</span></li>)}
      </ul>

      <div className="mb-4"><Segmented label="View" value={tab} onChange={setTab} options={[{ value: "students", label: "Students" }, { value: "registrations", label: `Registrations (${pending} pending)` }]} /></div>

      {tab === "students" ? (
        <>
          {sel.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md bg-primary-soft px-4 py-3 text-sm font-semibold text-primary" role="status">
              {sel.size} selected
              <Button size="sm" onClick={() => challans(list.filter((s) => sel.has(s.id)))}><FileText className="h-4 w-4" /> Challans for selected (PDF)</Button>
              <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button>
            </div>
          )}
          <DataTable columns={cols} rows={students.data} rowKey={(s) => s.id} loading={students.isLoading} error={students.isError} onRetry={() => students.refetch()} searchPlaceholder="Search by name or roll no…" exportName="students" selected={sel} onSelectedChange={setSel} />
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Button disabled={regSel.size === 0} loading={decide.isPending && decide.variables?.s === "APPROVED" && decide.variables.ids.length > 1} onClick={() => decide.mutate({ ids: [...regSel], s: "APPROVED" })}><CheckCheck className="h-5 w-5" /> Approve selected ({regSel.size})</Button>
            <Button variant="outline" disabled={regSel.size === 0} onClick={() => decide.mutate({ ids: [...regSel], s: "REJECTED" })}><XCircle className="h-5 w-5" /> Reject selected</Button>
            <Button variant="ghost" disabled={pending === 0} onClick={() => setRegSel(new Set((regs.data ?? []).filter((r) => r.status === "PENDING").map((r) => r.id)))}>Select all pending ({pending})</Button>
          </div>
          <DataTable columns={rcols} rows={regs.data} rowKey={(r) => r.id} loading={regs.isLoading} searchPlaceholder="Search registrations…" exportName="registrations" emptyTitle="No registrations"
            selected={regSel} onSelectedChange={setRegSel} isSelectable={(r) => r.status === "PENDING"} />
        </>
      )}

      {/* single add / edit */}
      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit === "new" ? "Add student" : "Edit student"}>
        <form className="space-y-4" onSubmit={handleSubmit((f) => save.mutate(f))} noValidate>
          <Input label="Full name" error={errors.name?.message} {...register("name")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Roll number" placeholder="24F-3101" error={errors.rollNo?.message} {...register("rollNo")} />
            <Input label="Phone" error={errors.phone?.message} {...register("phone")} />
          </div>
          <Input label="Email" type="email" error={errors.email?.message} {...register("email")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Type" {...register("residence")}><option value="DAY_SCHOLAR">Day scholar</option><option value="HOSTELITE">Hostelite</option><option value="FACULTY">Faculty</option></Select>
            <Select label="Route" error={errors.routeId?.message} {...register("routeId")}><option value="">Select…</option>{routes.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={save.isPending}>Save student</Button>
        </form>
      </Modal>

      {/* bulk add */}
      <Modal open={bulkOpen} onOpenChange={setBulkOpen} title="Bulk add students" description="Upload a CSV or paste rows. Existing roll numbers are skipped, never overwritten." className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4" /> Download template</Button>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3.5 text-sm font-semibold hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
              <FileSpreadsheet className="h-4 w-4" /> Choose CSV file
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
            </label>
          </div>
          <Textarea label="Or paste rows" rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="name,rollNo,email,phone,type,routeId" hint="Columns: name, rollNo, email, phone, type (day / hostelite / faculty), routeId" />
          {parsed.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">{good.length} valid · {bad.length} with errors</p>
              <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-border p-2 text-sm" aria-label="Import preview">
                {parsed.map((p) => (
                  <li key={p.line} className={p.error ? "rounded bg-danger-soft px-2.5 py-1.5 text-danger" : "rounded px-2.5 py-1.5"}>
                    <span className="font-semibold">Line {p.line}:</span> {p.data ? `${p.data.name} · ${p.data.rollNo} · ${typeLabel[p.data.residence]}` : p.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {bad.length > 0 && <Callout tone="warning">Rows with errors are skipped. Fix them in the file and import again.</Callout>}
          <Button size="lg" className="w-full" disabled={good.length === 0} loading={bulk.isPending} onClick={() => bulk.mutate(undefined)}>Import {good.length} student{good.length === 1 ? "" : "s"}</Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!banTarget} onOpenChange={(o) => !o && setBanTarget(null)} title={`Ban ${banTarget?.name ?? ""}?`} description="They won't be able to book seats or board until the ban is lifted." confirmLabel="Ban student" cancelLabel="Cancel" tone="danger" loading={ban.isPending} onConfirm={() => banTarget && ban.mutate({ id: banTarget.id, banned: true, reason: banReason || "Policy violation" })}>
        <div className="mt-3"><Input label="Reason" value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="e.g. Repeated violations" /></div>
      </ConfirmDialog>
    </div>
  );
}
