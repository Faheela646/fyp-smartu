import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Search, X } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { useAssignedBus } from "@/hooks/useConductorBus";
import { useAction, useStudents, useViolations } from "@/hooks/useOps";
import { useBuses, useRoutes } from "@/hooks/useTransportData";
import { violationService } from "@/services/ops";
import { timeAgo } from "@/lib/utils";
import type { Student, ViolationType } from "@/types/api";

const TYPES: ViolationType[] = ["No QR / pass", "Standing without ticket", "Misbehaviour", "Wrong bus", "Damage to property", "Vape / pod found", "Other"];
const schema = z.object({
  routeId: z.string().min(1, "Choose the route number"),
  type: z.enum(["No QR / pass", "Standing without ticket", "Misbehaviour", "Wrong bus", "Damage to property", "Vape / pod found", "Other"]),
  notes: z.string().trim().min(5, "Add a short description (at least 5 characters)"),
});
type Form = z.infer<typeof schema>;
const tone = { OPEN: "warning", RESOLVED: "success", ESCALATED: "danger" } as const;

export default function Report() {
  const { user, bus: myBus } = useAssignedBus();
  const students = useStudents();
  const routes = useRoutes();
  const buses = useBuses();
  const violations = useViolations();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Student | null>(null);
  const [studentError, setStudentError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { type: "No QR / pass", routeId: user.routeId ?? "" } });

  useEffect(() => { if (user.routeId) setValue("routeId", user.routeId); }, [user.routeId, setValue]);

  const needle = query.trim().toLowerCase();
  const matches = !picked && needle.length >= 2 ? (students.data ?? []).filter((s) => s.name.toLowerCase().includes(needle) || s.rollNo.toLowerCase().includes(needle)).slice(0, 6) : [];

  const submit = useAction(
    (f: Form) => {
      const bus = buses.data?.find((b) => b.routeId === f.routeId) ?? myBus;
      return violationService.report({ studentId: picked!.id, type: f.type, notes: f.notes, reportedBy: user.name, busId: bus?.id ?? "-", routeId: f.routeId });
    },
    { invalidate: [["violations"]], success: "Reported to the Transport Office", onSuccess: () => { reset({ routeId: user.routeId ?? "", type: "No QR / pass", notes: "" }); setPicked(null); setQuery(""); } },
  );
  const onSubmit = handleSubmit((f) => {
    if (!picked) return setStudentError("Search and choose the student.");
    setStudentError(null);
    submit.mutate(f);
  });
  const mine = (violations.data ?? []).slice(0, 6);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Report a violation" description="Send a report to the admin with the route number, student name and roll number. The admin decides on any fine or DDC referral." />
      <Card>
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <Select label="Route number" error={errors.routeId?.message} {...register("routeId")}>
              <option value="">Choose a route…</option>
              {routes.data?.map((r) => <option key={r.id} value={r.id}>{r.name}{r.note ? ` (${r.note})` : ""} · {r.via}</option>)}
            </Select>

            <div>
              <label htmlFor="student-search" className="text-sm font-semibold">Student (name or roll number)</label>
              {picked ? (
                <div className="mt-1.5 flex items-center justify-between gap-3 rounded-md border-2 border-primary bg-primary-soft/60 p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-5 w-5" /></span>
                    <div>
                      <p className="text-base font-bold">{picked.name}</p>
                      <p className="text-sm text-muted-foreground">Roll no. {picked.rollNo}</p>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setPicked(null); setQuery(""); }} aria-label="Change student"><X className="h-5 w-5" /></Button>
                </div>
              ) : (
                <>
                  <div className="relative mt-1.5">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <input id="student-search" value={query} onChange={(e) => { setQuery(e.target.value); setStudentError(null); }} placeholder="e.g. Hamza or 22F-3091" autoComplete="off" aria-invalid={!!studentError} className="h-12 w-full rounded-md border border-border bg-surface pl-12 pr-4 text-base" />
                  </div>
                  {matches.length > 0 && (
                    <ul className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border" role="listbox" aria-label="Matching students">
                      {matches.map((s) => (
                        <li key={s.id}>
                          <button type="button" role="option" aria-selected={false} onClick={() => { setPicked(s); setStudentError(null); }} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted">
                            <span className="font-semibold">{s.name}</span>
                            <span className="text-sm text-muted-foreground">{s.rollNo}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {needle.length >= 2 && matches.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No student matches "{query}".</p>}
                </>
              )}
              {studentError && <p role="alert" className="mt-1.5 text-xs text-danger">{studentError}</p>}
            </div>

            <Select label="Violation type" error={errors.type?.message} {...register("type")}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
            <Textarea label="What happened?" placeholder="Brief, factual description…" error={errors.notes?.message} {...register("notes")} />
            <Button type="submit" size="lg" className="w-full" loading={submit.isPending}>Send report</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="mt-5">
        <CardHeader><CardTitle>My recent reports</CardTitle></CardHeader>
        <CardContent>
          {mine.length === 0 ? <EmptyState title="No reports yet" /> : (
            <ul className="divide-y divide-border">
              {mine.map((v) => (
                <li key={v.id} className="flex items-start justify-between gap-3 py-3.5">
                  <div>
                    <p className="font-semibold">{v.studentName} <span className="font-normal text-muted-foreground">· {v.rollNo}</span></p>
                    <p className="text-sm text-muted-foreground">Route {v.routeNumber ?? "-"} · {v.type} · {timeAgo(v.ts)}</p>
                  </div>
                  <Badge tone={tone[v.status]}>{v.status[0] + v.status.slice(1).toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
