import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { DataTable, type Column } from "@/components/domain/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Select, Textarea } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAction, useDrivers, useFleetBuses } from "@/hooks/useOps";
import { useRoutes } from "@/hooks/useTransportData";
import { driverService } from "@/services/ops";
import { uid } from "@/demo/db";
import type { Driver } from "@/types/api";

const schema = z.object({
  name: z.string().trim().min(3, "Enter the driver's full name"),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,16}$/, "Enter a valid phone number"),
  address: z.string().trim().min(5, "Enter the home address"),
  licenseNo: z.string().trim().optional(),
  busId: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function Drivers() {
  const drivers = useDrivers();
  const buses = useFleetBuses();
  const routes = useRoutes();
  const [edit, setEdit] = useState<Driver | "new" | null>(null);
  const [del, setDel] = useState<Driver | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  const open = (d: Driver | "new") => { setEdit(d); reset(d === "new" ? { name: "", phone: "", address: "", licenseNo: "", busId: "" } : { ...d, busId: d.busId ?? "" }); };
  const save = useAction((f: Form) => driverService.save({ id: edit && edit !== "new" ? edit.id : uid("D"), ...f, busId: f.busId || undefined }), { invalidate: [["drivers"]], success: "Driver saved", onSuccess: () => setEdit(null) });
  const remove = useAction((id: string) => driverService.remove(id), { invalidate: [["drivers"]], success: "Driver removed", onSuccess: () => setDel(null) });

  const busLabel = (id?: string) => {
    const b = buses.data?.find((x) => x.id === id);
    if (!b) return null;
    return { plate: b.plate, route: routes.data?.find((r) => r.id === b.routeId)?.name ?? b.routeId };
  };

  const cols: Column<Driver>[] = [
    { key: "name", header: "Driver", render: (d) => <div><p className="text-base font-bold sm:text-lg">{d.name}</p><p className="text-sm sm:text-base text-muted-foreground">{d.licenseNo ? `Licence ${d.licenseNo}` : "Licence not recorded"}</p></div> },
    { key: "phone", header: "Phone", render: (d) => <a href={`tel:${d.phone}`} className="inline-flex items-center gap-2 text-base font-medium text-primary hover:underline"><Phone className="h-4.5 w-4.5" />{d.phone}</a> },
    { key: "address", header: "Address", hideOnMobile: true, render: (d) => <span className="text-base text-muted-foreground">{d.address}</span> },
    { key: "busId", header: "Assigned to", value: (d) => { const b = busLabel(d.busId); return b ? `${b.plate} ${b.route}` : ""; }, render: (d) => { const b = busLabel(d.busId); return b ? <div><p className="text-base font-semibold">{b.plate}</p><p className="text-sm sm:text-base text-muted-foreground">{b.route}</p></div> : <Badge tone="neutral">Unassigned</Badge>; } },
    { key: "a", header: "", sortable: false, className: "text-right", render: (d) => (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => open(d)} aria-label={`Edit ${d.name}`}><Pencil className="h-4.5 w-4.5" /></Button>
        <Button variant="ghost" size="icon" className="h-10 w-10 text-danger" onClick={() => setDel(d)} aria-label={`Remove ${d.name}`}><Trash2 className="h-4.5 w-4.5" /></Button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Drivers" description="Driver records only: drivers have no login. Assign each to a bus and the route follows the bus." actions={<Button size="lg" onClick={() => open("new")}><Plus className="h-5 w-5" /> Add driver</Button>} />
      <DataTable columns={cols} rows={drivers.data} rowKey={(d) => d.id} loading={drivers.isLoading} error={drivers.isError} onRetry={() => drivers.refetch()} searchPlaceholder="Search drivers…" exportName="drivers" emptyTitle="No drivers yet" />
      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit === "new" ? "Add driver" : "Edit driver"}>
        <form className="space-y-4" onSubmit={handleSubmit((f) => save.mutate(f))} noValidate>
          <Input label="Full name" error={errors.name?.message} {...register("name")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone number" error={errors.phone?.message} {...register("phone")} />
            <Input label="Licence no. (optional)" {...register("licenseNo")} />
          </div>
          <Textarea label="Address" rows={3} error={errors.address?.message} {...register("address")} />
          <Select label="Assign to bus" hint="Assigning a bus that already has a driver replaces that driver." {...register("busId")}>
            <option value="">Not assigned</option>
            {buses.data?.map((b) => <option key={b.id} value={b.id}>{b.plate} · {routes.data?.find((r) => r.id === b.routeId)?.name}</option>)}
          </Select>
          <Button type="submit" size="lg" className="w-full" loading={save.isPending}>Save driver</Button>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Remove ${del?.name ?? "driver"}?`} description="Their bus will be left without an assigned driver." confirmLabel="Remove" cancelLabel="Cancel" tone="danger" loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} />
    </div>
  );
}
