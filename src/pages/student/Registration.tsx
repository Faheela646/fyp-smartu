import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useAction, useRegistrations } from "@/hooks/useOps";
import { useRoutes } from "@/hooks/useTransportData";
import { registrationService } from "@/services/ops";
import { useAuthStore } from "@/store/auth";

const schema = z.object({
  semester: z.string().min(1, "Choose a semester"),
  routeId: z.string().min(1, "Choose a route"),
  stopId: z.string().min(1, "Choose your pick-up stop"),
  agree: z.literal(true, { errorMap: () => ({ message: "You must accept the transport rules" }) }),
});
type Form = z.infer<typeof schema>;
const tone = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;

export default function Registration() {
  const user = useAuthStore((s) => s.user)!;
  const routes = useRoutes();
  const regs = useRegistrations(user.id);
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { semester: "Spring 2027", routeId: user.routeId ?? "" } });
  const routeId = watch("routeId");
  const stops = routes.data?.find((r) => r.id === routeId)?.stops.slice(0, -1) ?? [];
  const submit = useAction((f: Form) => registrationService.submit({ userId: user.id, semester: f.semester, routeId: f.routeId, stopId: f.stopId, residence: user.role === "HOSTELITE" ? "HOSTELITE" : "DAY_SCHOLAR" }), {
    invalidate: [["registrations"]],
    success: "Registration submitted. The Transport Office will review it.",
    onSuccess: () => reset({ semester: "Spring 2027", routeId: user.routeId ?? "", stopId: "" }),
  });

  return (
    <div>
      <PageHeader title="Semester registration" description="Register for transport each semester. Choose your route and pick-up stop." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>New registration</CardTitle>
              <CardDescription>Applications are reviewed by the Transport Office</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit((f) => submit.mutate(f))} noValidate>
              <Select label="Semester" error={errors.semester?.message} {...register("semester")}>
                <option>Spring 2027</option>
                <option>Fall 2026</option>
              </Select>
              <Select label="Route" error={errors.routeId?.message} {...register("routeId")}>
                <option value="">Select a route…</option>
                {routes.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
              <Select label="Pick-up stop" error={errors.stopId?.message} disabled={!routeId} {...register("stopId")}>
                <option value="">{routeId ? "Select a stop…" : "Choose a route first"}</option>
                {stops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <div>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1 h-5 w-5 rounded accent-[rgb(var(--primary))]" {...register("agree")} />
                  <span>I have read and accept the university transport rules, fines and cancellation policy.</span>
                </label>
                {errors.agree && <p role="alert" className="mt-1.5 text-xs text-danger">{errors.agree.message}</p>}
              </div>
              <Button type="submit" size="lg" className="w-full" loading={submit.isPending}>Submit registration</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle>My applications</CardTitle></CardHeader>
          <CardContent>
            {regs.isLoading ? <Skeleton className="h-24 w-full" /> : !regs.data?.length ? (
              <EmptyState icon={ClipboardCheck} title="No applications yet" description="Your submitted registrations and their status will appear here." />
            ) : (
              <ul className="space-y-3">
                {regs.data.map((r) => {
                  const rt = routes.data?.find((x) => x.id === r.routeId);
                  return (
                    <li key={r.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-4">
                      <div>
                        <p className="font-bold">{r.semester}</p>
                        <p className="text-sm text-muted-foreground">{rt?.name} · {rt?.stops.find((s) => s.id === r.stopId)?.name}</p>
                        <p className="text-xs text-muted-foreground">Submitted {new Date(r.submittedAt).toLocaleDateString("en-GB")}</p>
                      </div>
                      <Badge tone={tone[r.status]}>{r.status[0] + r.status.slice(1).toLowerCase()}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
