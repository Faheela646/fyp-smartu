import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { DataTable, type Column } from "@/components/domain/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { useAction, useFleetBuses, useSchedules } from "@/hooks/useOps";
import { useRoutes } from "@/hooks/useTransportData";
import { fleetService } from "@/services/ops";
import { uid } from "@/demo/db";
import { cn } from "@/lib/utils";
import type { Schedule } from "@/types/api";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Schedules() {
  const schedules = useSchedules();
  const buses = useFleetBuses();
  const routes = useRoutes();
  const [edit, setEdit] = useState<Schedule | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [del, setDel] = useState<Schedule | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = useAction((s: Schedule) => fleetService.saveSchedule(s), { invalidate: [["schedules"]], success: "Schedule saved", onSuccess: () => setEdit(null) });
  const remove = useAction((id: string) => fleetService.deleteSchedule(id), { invalidate: [["schedules"]], success: "Schedule deleted", onSuccess: () => setDel(null) });
  const toggle = useAction((s: Schedule) => fleetService.saveSchedule({ ...s, active: !s.active }), { invalidate: [["schedules"]] });

  const routeName = (id: string) => routes.data?.find((r) => r.id === id)?.name ?? id;
  const plate = (id: string) => buses.data?.find((b) => b.id === id)?.plate ?? id;

  const openNew = () => { setIsNew(true); setErr(null); setEdit({ id: uid("SCH"), routeId: buses.data?.[0]?.routeId ?? "", busId: buses.data?.[0]?.id ?? "", direction: "TO_CAMPUS", departTime: "07:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], active: true }); };
  const submit = () => {
    if (!edit) return;
    if (!edit.busId) return setErr("Choose a bus.");
    if (!edit.days.length) return setErr("Pick at least one day.");
    // double-booking check: same bus, same time, same day
    const clash = schedules.data?.find((s) => s.id !== edit.id && s.busId === edit.busId && s.departTime === edit.departTime && s.active && s.days.some((d) => edit.days.includes(d)));
    if (clash) return setErr(`${plate(edit.busId)} is already scheduled at ${edit.departTime} on an overlapping day.`);
    save.mutate(edit);
  };

  const cols: Column<Schedule>[] = [
    { key: "departTime", header: "Departs", render: (s) => <span className="text-xl font-extrabold tabular-nums text-foreground">{s.departTime}</span> },
    { key: "routeId", header: "Route", value: (s) => routeName(s.routeId), render: (s) => <span className="text-base font-semibold">{routeName(s.routeId)}</span> },
    { key: "busId", header: "Bus", value: (s) => plate(s.busId), hideOnMobile: true, render: (s) => <span className="text-base font-medium">{plate(s.busId)}</span> },
    { key: "direction", header: "Direction", value: (s) => (s.direction === "TO_CAMPUS" ? "To campus" : "From campus"), render: (s) => <Badge tone={s.direction === "TO_CAMPUS" ? "primary" : "accent"}>{s.direction === "TO_CAMPUS" ? "To campus" : "From campus"}</Badge> },
    { key: "days", header: "Days", value: (s) => s.days.join(" "), hideOnMobile: true, render: (s) => <span className="text-base text-muted-foreground">{s.days.join(" · ")}</span> },
    { key: "active", header: "Active", sortable: false, render: (s) => <Switch checked={s.active} onCheckedChange={() => toggle.mutate(s)} aria-label={`Toggle schedule ${s.departTime}`} /> },
    { key: "a", header: "", sortable: false, className: "text-right", render: (s) => (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => { setIsNew(false); setErr(null); setEdit({ ...s }); }} aria-label="Edit schedule"><Pencil className="h-4.5 w-4.5" /></Button>
        <Button variant="ghost" size="icon" className="h-10 w-10 text-danger" onClick={() => setDel(s)} aria-label="Delete schedule"><Trash2 className="h-4.5 w-4.5" /></Button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Schedules" description="When each bus departs. Double-bookings of a bus are blocked." actions={<Button size="lg" onClick={openNew}><Plus className="h-5 w-5" /> Add schedule</Button>} />
      <DataTable columns={cols} rows={schedules.data} rowKey={(s) => s.id} loading={schedules.isLoading} error={schedules.isError} onRetry={() => schedules.refetch()} searchPlaceholder="Search schedules…" exportName="schedules" />
      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={isNew ? "Add schedule" : "Edit schedule"}>
        {edit && (
          <div className="space-y-4">
            <Select label="Bus" value={edit.busId} onChange={(e) => { const b = buses.data?.find((x) => x.id === e.target.value); setEdit({ ...edit, busId: e.target.value, routeId: b?.routeId ?? edit.routeId }); }}>
              {buses.data?.map((b) => <option key={b.id} value={b.id}>{b.plate} · {routeName(b.routeId)}</option>)}
            </Select>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Departure time" type="time" value={edit.departTime} onChange={(e) => setEdit({ ...edit, departTime: e.target.value })} />
              <Select label="Direction" value={edit.direction} onChange={(e) => setEdit({ ...edit, direction: e.target.value as Schedule["direction"] })}><option value="TO_CAMPUS">To campus</option><option value="FROM_CAMPUS">From campus</option></Select>
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">Days</legend>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => { const on = edit.days.includes(d); return <button key={d} type="button" aria-pressed={on} onClick={() => setEdit({ ...edit, days: on ? edit.days.filter((x) => x !== d) : [...edit.days, d] })} className={cn("rounded-full border-2 px-4 py-1.5 text-sm font-semibold", on ? "border-primary bg-primary-soft text-primary" : "border-border")}>{d}</button>; })}
              </div>
            </fieldset>
            {err && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{err}</p>}
            <Button size="lg" className="w-full" loading={save.isPending} onClick={submit}>Save schedule</Button>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this schedule?" confirmLabel="Delete" cancelLabel="Cancel" tone="danger" loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} />
    </div>
  );
}
