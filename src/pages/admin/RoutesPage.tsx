import { useState } from "react";
import { ChevronDown, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { RouteMap } from "@/components/domain/RouteMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Callout, ConfirmDialog } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useAction, useDrivers, useFleetBuses } from "@/hooks/useOps";
import { useRoutes } from "@/hooks/useTransportData";
import { fleetService } from "@/services/ops";
import { uid } from "@/demo/db";
import { cn } from "@/lib/utils";
import type { Stop, TransportRoute } from "@/types/api";

const COLORS = ["#1E3A8A", "#0F766E", "#B45309", "#7C3AED", "#BE185D", "#0369A1"];
const fmtTime = (t?: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export default function RoutesPage() {
  const routes = useRoutes();
  const drivers = useDrivers();
  const buses = useFleetBuses();
  const [edit, setEdit] = useState<TransportRoute | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [del, setDel] = useState<TransportRoute | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | undefined>();

  const save = useAction((r: TransportRoute) => fleetService.saveRoute(r), { invalidate: [["routes"]], success: "Route saved", onSuccess: () => setEdit(null) });
  const remove = useAction((id: string) => fleetService.deleteRoute(id), { invalidate: [["routes"]], success: "Route deleted", onSuccess: () => setDel(null) });

  const openNew = () => {
    setIsNew(true); setErr(null);
    const n = String((routes.data?.length ?? 0) + 1).padStart(2, "0");
    setEdit({ id: `R${n}`, number: n, name: `Route ${n}`, via: "", color: COLORS[(routes.data?.length ?? 0) % COLORS.length], stops: [{ id: uid("S"), name: "", lat: 31.5, lng: 73.0, time: "07:00" }, { id: uid("S"), name: "Campus", lat: 31.5197, lng: 72.9701, time: "08:25" }], path: [] });
  };
  const patchStop = (i: number, p: Partial<Stop>) => setEdit((r) => r && { ...r, stops: r.stops.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const submit = () => {
    if (!edit) return;
    if (!/^\d{1,3}$/.test(edit.number.trim())) return setErr("Route number must be digits, e.g. 18.");
    if (edit.stops.length < 2 || edit.stops.some((s) => !s.name.trim())) return setErr("Every stop needs a name, and a route needs at least two stops.");
    const number = edit.number.trim().padStart(2, "0");
    save.mutate({ ...edit, number, name: `Route ${number}`, via: `${edit.stops[0].name} → Campus`, path: edit.stops.map((s) => [s.lat, s.lng] as [number, number]), contact: edit.contact?.name?.trim() ? edit.contact : undefined });
  };

  return (
    <div>
      <PageHeader title="Routes" description="The university bus routes and timetable: stops, pick-up times and the authorised person for each route." actions={<Button size="lg" onClick={openNew}><Plus className="h-5 w-5" /> Add route</Button>} />
      <div className="mb-5">
        <Callout tone="info" title="Source: Complete Buses Route, Fall 2026">
          Stop names, times and contacts are exactly as printed in the university timetable. Stop positions on the map are schematic until real GPS coordinates are entered per stop (use Edit).
        </Callout>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          {routes.isError ? <ErrorState onRetry={() => routes.refetch()} /> : !routes.data ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />) : routes.data.map((r) => {
            const bus = buses.data?.find((b) => b.routeId === r.id);
            const d = drivers.data?.find((x) => x.busId === bus?.id);
            return (
              <Card key={r.id} className={cn("transition-colors", focus === r.id && "border-primary")}>
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <button className="flex min-w-0 items-center gap-3.5 text-left" onClick={() => setFocus(focus === r.id ? undefined : r.id)} aria-pressed={focus === r.id}>
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md text-xl font-extrabold text-white" style={{ background: r.color }}>{r.number}</span>
                      <span className="min-w-0">
                        <span className="block text-lg font-bold sm:text-xl">{r.name}{r.note ? ` (${r.note})` : ""}</span>
                        <span className="block truncate text-base text-muted-foreground">{r.via}</span>
                      </span>
                    </button>
                    <div className="flex shrink-0 gap-1.5">
                      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => { setIsNew(false); setErr(null); setEdit(structuredClone(r)); }} aria-label={`Edit ${r.name}`}><Pencil className="h-4.5 w-4.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10 text-danger" onClick={() => setDel(r)} aria-label={`Delete ${r.name}`}><Trash2 className="h-4.5 w-4.5" /></Button>
                    </div>
                  </div>
                  <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-base">
                    <Badge tone="primary">{r.stops.length - 1} stops</Badge>
                    <span className="text-muted-foreground">First pick-up {fmtTime(r.stops[0].time)} · Campus {fmtTime(r.stops[r.stops.length - 1].time)}</span>
                  </div>
                  <ul className="mt-3.5 space-y-1.5 border-t border-border pt-3.5 text-base" aria-label={`Contacts on ${r.name}`}>
                    {r.contact && <li className="flex flex-wrap items-center gap-x-3"><span className="font-semibold">Authorised person:</span><span className="inline-flex items-center gap-1.5"><UserRound className="h-4.5 w-4.5 text-muted-foreground" />{r.contact.name}</span><span className="inline-flex items-center gap-1.5 text-muted-foreground"><Phone className="h-4.5 w-4.5" />{r.contact.phone}</span></li>}
                    <li className="flex flex-wrap items-center gap-x-3">
                      <span className="font-semibold">{bus?.plate ?? "No bus"}</span>
                      {d ? <><span className="inline-flex items-center gap-1.5"><UserRound className="h-4.5 w-4.5 text-muted-foreground" />Driver: {d.name}</span><span className="inline-flex items-center gap-1.5 text-muted-foreground"><Phone className="h-4.5 w-4.5" />{d.phone}</span></> : <span className="text-muted-foreground">No driver assigned</span>}
                    </li>
                  </ul>
                  <details className="group mt-3.5">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-base font-semibold text-primary"><ChevronDown className="h-4.5 w-4.5 transition-transform group-open:rotate-180" /> Timetable</summary>
                    <ol className="mt-2.5 grid gap-x-6 gap-y-1.5 text-base sm:grid-cols-2">
                      {r.stops.map((s) => <li key={s.id} className="flex justify-between gap-3 border-b border-border/60 py-1.5"><span>{s.name}</span><span className="tabular-nums font-medium text-muted-foreground">{fmtTime(s.time)}</span></li>)}
                    </ol>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Card className="h-fit p-3 sm:p-5 xl:sticky xl:top-24"><RouteMap focusRouteId={focus} className="h-[520px]" /></Card>
      </div>

      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={isNew ? "Add route" : `Edit ${edit?.name ?? "route"}`} className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Route number" value={edit.number} onChange={(e) => setEdit({ ...edit, number: e.target.value })} />
              <Input label="Area note (optional)" value={edit.note ?? ""} placeholder="e.g. Chiniot" onChange={(e) => setEdit({ ...edit, note: e.target.value || undefined })} />
              <div>
                <p className="mb-1.5 text-sm font-semibold">Colour</p>
                <div className="flex flex-wrap gap-2">{COLORS.map((c) => <button key={c} type="button" onClick={() => setEdit({ ...edit, color: c })} aria-label={`Colour ${c}`} aria-pressed={edit.color === c} className="h-9 w-9 rounded-full border-4 border-surface ring-2" style={{ background: c, ["--tw-ring-color" as string]: edit.color === c ? c : "transparent" }} />)}</div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Authorised person" value={edit.contact?.name ?? ""} onChange={(e) => setEdit({ ...edit, contact: { name: e.target.value, phone: edit.contact?.phone ?? "" } })} />
              <Input label="Their phone" value={edit.contact?.phone ?? ""} onChange={(e) => setEdit({ ...edit, contact: { name: edit.contact?.name ?? "", phone: e.target.value } })} />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold">Stops in order (last is Campus)</p>
              <div className="space-y-2.5">
                {edit.stops.map((s, i) => (
                  <div key={s.id} className="grid grid-cols-[1fr_96px_auto] items-center gap-2 sm:grid-cols-[1fr_96px_84px_84px_auto]">
                    <input aria-label={`Stop ${i + 1} name`} value={s.name} onChange={(e) => patchStop(i, { name: e.target.value })} placeholder={`Stop ${i + 1}`} className="h-11 rounded-md border border-border bg-surface px-3 text-base" />
                    <input aria-label={`Stop ${i + 1} time`} type="time" value={s.time ?? ""} onChange={(e) => patchStop(i, { time: e.target.value })} className="h-11 rounded-md border border-border bg-surface px-2 text-sm" />
                    <input aria-label="Latitude" type="number" step="0.0001" value={s.lat} onChange={(e) => patchStop(i, { lat: Number(e.target.value) })} className="hidden h-11 rounded-md border border-border bg-surface px-2 text-sm sm:block" />
                    <input aria-label="Longitude" type="number" step="0.0001" value={s.lng} onChange={(e) => patchStop(i, { lng: Number(e.target.value) })} className="hidden h-11 rounded-md border border-border bg-surface px-2 text-sm sm:block" />
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-danger" disabled={edit.stops.length <= 2} onClick={() => setEdit({ ...edit, stops: edit.stops.filter((_, j) => j !== i) })} aria-label={`Remove stop ${i + 1}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setEdit({ ...edit, stops: [...edit.stops.slice(0, -1), { id: uid("S"), name: "", lat: edit.stops[0].lat, lng: edit.stops[0].lng, time: edit.stops[0].time }, edit.stops[edit.stops.length - 1]] })}><Plus className="h-4 w-4" /> Add stop</Button>
            </div>
            {err && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{err}</p>}
            <Button size="lg" className="w-full" loading={save.isPending} onClick={submit}>Save route</Button>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete ${del?.name ?? "route"}?`} description="Buses assigned to it will need a new route." confirmLabel="Delete" cancelLabel="Cancel" tone="danger" loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} />
    </div>
  );
}
