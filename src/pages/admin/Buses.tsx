import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { DataTable, type Column } from "@/components/domain/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAction, useDrivers, useFleetBuses } from "@/hooks/useOps";
import { useRoutes } from "@/hooks/useTransportData";
import { fleetService } from "@/services/ops";
import { useRealtimeStore } from "@/store/realtime";
import { uid } from "@/demo/db";
import type { Bus } from "@/types/api";

const schema = z.object({
  plate: z.string().trim().min(4, "Enter the number plate"),
  routeId: z.string().min(1, "Choose a route"),
  seatCapacity: z.coerce.number().int().min(8, "At least 8 seats").max(70),
  standingCapacity: z.coerce.number().int().min(0).max(40),
});
type Form = z.infer<typeof schema>;

export default function Buses() {
  const buses = useFleetBuses();
  const routes = useRoutes();
  const drivers = useDrivers();
  const seats = useRealtimeStore((s) => s.seats);
  const [edit, setEdit] = useState<Bus | "new" | null>(null);
  const [del, setDel] = useState<Bus | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.input<typeof schema>, unknown, Form>({ resolver: zodResolver(schema) });
  const open = (b: Bus | "new") => { setEdit(b); reset(b === "new" ? { plate: "", routeId: "", seatCapacity: 40, standingCapacity: 10 } : b); };
  const save = useAction((f: Form) => fleetService.saveBus({ id: edit && edit !== "new" ? edit.id : uid("B"), ...f }), { invalidate: [["fleet-buses"], ["buses"]], success: "Bus saved", onSuccess: () => setEdit(null) });
  const remove = useAction((id: string) => fleetService.deleteBus(id), { invalidate: [["fleet-buses"], ["buses"]], success: "Bus removed", onSuccess: () => setDel(null) });

  const cols: Column<Bus>[] = [
    { key: "plate", header: "Plate", render: (b) => <span className="text-base font-bold sm:text-lg">{b.plate}</span> },
    { key: "routeId", header: "Route", value: (b) => routes.data?.find((r) => r.id === b.routeId)?.name ?? b.routeId, render: (b) => <span className="text-base font-semibold">{routes.data?.find((r) => r.id === b.routeId)?.name ?? b.routeId}</span> },
    { key: "driver", header: "Driver", hideOnMobile: true, value: (b) => drivers.data?.find((d) => d.busId === b.id)?.name ?? "", render: (b) => { const d = drivers.data?.find((x) => x.busId === b.id); return d ? <div><p className="text-base font-semibold">{d.name}</p><p className="text-sm sm:text-base text-muted-foreground">{d.phone}</p></div> : <span className="text-base text-muted-foreground">Unassigned</span>; } },
    { key: "seatCapacity", header: "Seats", render: (b) => <span className="text-base font-semibold tabular-nums">{b.seatCapacity}</span> },
    { key: "standingCapacity", header: "Standing", hideOnMobile: true, render: (b) => <span className="text-base tabular-nums">{b.standingCapacity}</span> },
    { key: "live", header: "Live free", sortable: false, hideOnMobile: true, render: (b) => seats[b.id] ? <Badge tone={seats[b.id].seatsAvailable === 0 ? "danger" : "success"}>{seats[b.id].seatsAvailable} free</Badge> : <span className="text-base text-muted-foreground">-</span> },
    { key: "a", header: "", sortable: false, className: "text-right", render: (b) => (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => open(b)} aria-label={`Edit ${b.plate}`}><Pencil className="h-4.5 w-4.5" /></Button>
        <Button variant="ghost" size="icon" className="h-10 w-10 text-danger" onClick={() => setDel(b)} aria-label={`Delete ${b.plate}`}><Trash2 className="h-4.5 w-4.5" /></Button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Buses" description="The fleet: plates, route assignment and capacity." actions={<Button size="lg" onClick={() => open("new")}><Plus className="h-5 w-5" /> Add bus</Button>} />
      <DataTable columns={cols} rows={buses.data} rowKey={(b) => b.id} loading={buses.isLoading} error={buses.isError} onRetry={() => buses.refetch()} searchPlaceholder="Search buses…" exportName="buses" />
      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit === "new" ? "Add bus" : "Edit bus"}>
        <form className="space-y-4" onSubmit={handleSubmit((f) => save.mutate(f))} noValidate>
          <Input label="Number plate" error={errors.plate?.message} {...register("plate")} />
          <Select label="Route" error={errors.routeId?.message} {...register("routeId")}><option value="">Select…</option>{routes.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Seats" type="number" error={errors.seatCapacity?.message} {...register("seatCapacity")} />
            <Input label="Standing spots" type="number" error={errors.standingCapacity?.message} {...register("standingCapacity")} />
          </div>
          <Button type="submit" size="lg" className="w-full" loading={save.isPending}>Save bus</Button>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Remove ${del?.plate ?? "bus"}?`} description="It will disappear from schedules and tracking." confirmLabel="Remove" cancelLabel="Cancel" tone="danger" loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} />
    </div>
  );
}
