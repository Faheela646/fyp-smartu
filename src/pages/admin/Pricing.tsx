import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/domain/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction, usePricing } from "@/hooks/useOps";
import { financeService } from "@/services/ops";

const n = (label: string) => z.coerce.number({ invalid_type_error: `${label} must be a number` }).min(0, "Can't be negative");
const schema = z.object({
  seatPrice: n("Price").min(1, "Enter a price"),
  standingPrice: n("Price"),
  semesterFeeDayScholar: n("Fee").min(1, "Enter the semester fee"),
  firstOffenceFine: n("Fine"),
  secondOffenceFine: n("Fine"),
  cancelFeePercent: n("Percent").max(100, "Max 100%"),
  freeCancelHours: n("Hours").max(48, "Max 48 hours"),
  ticketValidHours: n("Hours").min(1, "At least 1 hour").max(72, "Max 72 hours"),
  legGapMinutes: n("Minutes").max(240, "Max 240 minutes"),
  ddcEmail: z.string().trim().email("Enter a valid email address"),
});
type Form = z.output<typeof schema>;

export default function Pricing() {
  const pricing = usePricing();
  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<z.input<typeof schema>, unknown, Form>({ resolver: zodResolver(schema) });
  useEffect(() => { if (pricing.data) reset(pricing.data); }, [pricing.data, reset]);
  const save = useAction((p: Form) => financeService.savePricing(p), { invalidate: [["pricing"]], success: "Pricing updated" });
  const seat = Number(watch("seatPrice") ?? 0);

  return (
    <div className="w-full">
      <PageHeader title="Fees & pricing" description="Ticket prices, fines and the cancellation rule. Changes apply to new bookings immediately." />
      {!pricing.data ? <Skeleton className="h-96 w-full" /> : (
        <form onSubmit={handleSubmit((p) => save.mutate(p))} noValidate className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><div><CardTitle>Tickets</CardTitle><CardDescription>Standing tickets are for full buses only</CardDescription></div></CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <Input label="Seat ticket (Rs.)" type="number" error={errors.seatPrice?.message} {...register("seatPrice")} />
                <Input label="Standing ticket (Rs.)" type="number" error={errors.standingPrice?.message} hint={seat ? `Half price would be Rs. ${Math.round(seat / 2)}` : undefined} {...register("standingPrice")} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Semester fee (day scholars)</CardTitle><CardDescription>Printed on the fee challan</CardDescription></div></CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <Input label="Semester transport fee (Rs.)" type="number" error={errors.semesterFeeDayScholar?.message} {...register("semesterFeeDayScholar")} />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><div><CardTitle>Violation policy</CardTitle><CardDescription>1st offence → fine · 2nd offence → fine · 3rd offence → DDC · vape / pod → direct DDC</CardDescription></div></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-3">
              <Input label="1st offence fine (Rs.)" type="number" error={errors.firstOffenceFine?.message} {...register("firstOffenceFine")} />
              <Input label="2nd offence fine (Rs.)" type="number" error={errors.secondOffenceFine?.message} {...register("secondOffenceFine")} />
              <div className="sm:col-span-1"><Input label="DDC email address" type="email" error={errors.ddcEmail?.message} hint="Referral emails are addressed to this address" {...register("ddcEmail")} /></div>
            </CardContent>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><div><CardTitle>Ticket validity</CardTitle><CardDescription>A ticket is disposed automatically after this time, or when its scans are used up</CardDescription></div></CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <Input label="Valid for (hours after start)" type="number" error={errors.ticketValidHours?.message} {...register("ticketValidHours")} />
                <Input label="Min. gap between scans (minutes)" type="number" error={errors.legGapMinutes?.message} hint="Prevents accidental double scan" {...register("legGapMinutes")} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><div><CardTitle>Cancellation rule</CardTitle><CardDescription>Shown to students in the cancel confirmation</CardDescription></div></CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <Input label="Free until (hours before departure)" type="number" error={errors.freeCancelHours?.message} {...register("freeCancelHours")} />
                <Input label="Late fee (% of ticket)" type="number" error={errors.cancelFeePercent?.message} {...register("cancelFeePercent")} />
              </CardContent>
            </Card>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="lg" className="min-w-48 text-base font-semibold" loading={save.isPending} disabled={!isDirty}>Save changes</Button>
          </div>
        </form>
      )}
    </div>
  );
}
