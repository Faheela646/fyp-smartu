import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Armchair, CalendarX2, CheckCircle2, Clock, Footprints, Lock, QrCode, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/PageHeader";
import { SeatMap } from "@/components/domain/SeatMap";
import { SeatCounter } from "@/components/domain/SeatCounter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout, ConfirmDialog } from "@/components/ui/confirm";
import { Segmented, Select } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useBuses, useRoutes } from "@/hooks/useTransportData";
import { useCancelBooking, useCreateBooking, useMyBookings } from "@/hooks/useBookings";
import { usePricing } from "@/hooks/useOps";
import { legsOf, previewCancel, takenSeats } from "@/services/bookings";
import { useAuthStore } from "@/store/auth";
import { useRealtimeStore } from "@/store/realtime";
import { formatPKR } from "@/lib/utils";
import type { BookingRecord, TripType } from "@/types/api";

const dayStr = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const prettyDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const timeLeft = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h}h ${m}m left` : `${m}m left`;
};

export default function BookTicket() {
  const user = useAuthStore((s) => s.user)!;
  const isHostelite = user.role === "HOSTELITE";
  const routes = useRoutes();
  const buses = useBuses();
  const pricing = usePricing();
  const bookings = useMyBookings(user.id);
  const seats = useRealtimeStore((s) => s.seats);
  const enabled = useRealtimeStore((s) => s.bookingEnabled);
  const create = useCreateBooking(user.id);
  const cancel = useCancelBooking(user.id);

  const [busId, setBusId] = useState<string>("");
  const [date, setDate] = useState(dayStr(0));
  const [tripType, setTripType] = useState<TripType>("ONE_WAY");
  const [direction, setDirection] = useState<"TO_CAMPUS" | "FROM_CAMPUS">("TO_CAMPUS");
  const [seatNo, setSeatNo] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingRecord | null>(null);

  useEffect(() => {
    if (!busId && buses.data) setBusId(buses.data.find((b) => b.routeId === user.routeId)?.id ?? buses.data[0]?.id ?? "");
  }, [buses.data, busId, user.routeId]);

  const bus = buses.data?.find((b) => b.id === busId);
  const live = bus ? seats[bus.id] : undefined;
  const route = routes.data?.find((r) => r.id === bus?.routeId);
  const taken = useMemo(() => (bus && live ? takenSeats(bus.id, date, bus.seatCapacity, live.seatsAvailable) : new Set<number>()), [bus, live, date, bookings.data]);

  // If someone else grabs the seat I was looking at, drop my selection and say so.
  useEffect(() => {
    if (seatNo && taken.has(seatNo) && !bookings.data?.some((b) => b.seatNo === seatNo && b.status === "CONFIRMED")) {
      toast.warning(`Seat ${seatNo} was just taken`, { description: "Pick another seat." });
      setSeatNo(null);
    }
  }, [taken, seatNo, bookings.data]);

  const seatsFull = !!live && live.seatsAvailable === 0;
  const alreadyBooked = bookings.data?.some((b) => b.status === "CONFIRMED" && b.busId === busId && b.date === date);
  const active = (bookings.data ?? []).filter((b) => b.status === "CONFIRMED");
  const legs = legsOf(tripType);
  const unit = seatsFull ? pricing.data?.standingPrice ?? 0 : pricing.data?.seatPrice ?? 0;
  const price = isHostelite ? unit * legs : 0;
  const validHours = pricing.data?.ticketValidHours ?? 14;

  const book = (type: "SEAT" | "STANDING") => {
    if (!bus) return;
    create.mutate(
      { user, busId: bus.id, date, tripType, direction, type, seatNo: type === "SEAT" ? seatNo ?? undefined : undefined },
      {
        onSuccess: (b) => {
          toast.success(`${b.tripType === "TWO_WAY" ? "Two-way" : "One-way"} ticket booked`, { description: `Route ${b.routeNumber} · ${prettyDate(b.date)} · ${b.departTime}. Your QR is ready.` });
          setSeatNo(null);
        },
      },
    );
  };

  const preview = cancelTarget ? previewCancel(cancelTarget) : null;

  return (
    <div>
      <PageHeader title="Book a ticket" description="Pick your route and trip. Your ticket QR is created instantly. If the bus is full you can take a standing ticket." />

      {!enabled && (
        <div className="mb-6">
          <Callout tone="danger" title="Ticket booking is currently paused">
            The Transport Office has temporarily disabled booking. Your existing tickets are unaffected, and you'll get a notification when it reopens.
          </Callout>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>1. Choose your trip</CardTitle>
              <CardDescription>Seat availability updates live</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {buses.isError ? (
              <ErrorState onRetry={() => buses.refetch()} />
            ) : !buses.data ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select label="Bus route" value={busId} onChange={(e) => { setBusId(e.target.value); setSeatNo(null); }}>
                    {buses.data.map((b) => {
                      const r = routes.data?.find((x) => x.id === b.routeId);
                      return <option key={b.id} value={b.id}>{r ? `${r.name}${r.note ? ` (${r.note})` : ""} · ${r.stops[0].name} → Campus` : b.routeId}</option>;
                    })}
                  </Select>
                  <Select label="Date" value={date} onChange={(e) => { setDate(e.target.value); setSeatNo(null); }}>
                    <option value={dayStr(0)}>Today, {prettyDate(dayStr(0))}</option>
                    <option value={dayStr(1)}>Tomorrow, {prettyDate(dayStr(1))}</option>
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-sm font-semibold">Ticket type</p>
                    <Segmented label="Ticket type" value={tripType} onChange={setTripType} options={[{ value: "ONE_WAY", label: "One-way (1 scan)" }, { value: "TWO_WAY", label: "Two-way (2 scans)" }]} />
                  </div>
                  {tripType === "ONE_WAY" && (
                    <div>
                      <p className="mb-1.5 text-sm font-semibold">Direction</p>
                      <Segmented label="Direction" value={direction} onChange={setDirection} options={[{ value: "TO_CAMPUS", label: "To campus" }, { value: "FROM_CAMPUS", label: "From campus" }]} />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-md border border-border p-4">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">{route?.name}{route?.note ? ` (${route.note})` : ""}</p>
                    <p className="text-sm text-muted-foreground">{route ? `Pick-up from ${route.stops[0].name} at ${route.stops[0].time}` : "Seats free"}</p>
                  </div>
                  {live ? <SeatCounter value={live.seatsAvailable} total={live.seatsTotal} className="text-4xl" /> : <Skeleton className="h-10 w-24" />}
                </div>

                {!live ? (
                  <Skeleton className="h-64 w-full" />
                ) : seatsFull ? (
                  <div className="space-y-4">
                    <Callout tone="warning" title="This bus is full">
                      All {live.seatsTotal} seats are taken. You can still ride with a standing ticket
                      {live.standingAvailable > 0 ? ` (${live.standingAvailable} standing spots left).` : ", but standing spots are gone too."}
                    </Callout>
                    <SeatMap total={live.seatsTotal} taken={taken} disabled />
                  </div>
                ) : (
                  <SeatMap total={live.seatsTotal} taken={taken} selected={seatNo} onSelect={setSeatNo} disabled={!enabled || alreadyBooked} />
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>2. Confirm</CardTitle>
                <CardDescription>{bus ? `${route?.name} · ${prettyDate(date)} · ${tripType === "TWO_WAY" ? "Two-way" : direction === "TO_CAMPUS" ? "One-way to campus" : "One-way from campus"}` : "Choose a route first"}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {alreadyBooked && <Callout tone="info">You already have an active ticket on this bus for this day.</Callout>}
              <div className="flex items-center justify-between rounded-md bg-muted p-4">
                <span className="flex items-center gap-2 font-semibold">
                  {seatsFull ? <><Footprints className="h-5 w-5" /> Standing ticket</> : <><Armchair className="h-5 w-5" /> {seatNo ? `Seat ${seatNo}` : "No seat selected"}</>}
                </span>
                <span className="text-right">
                  <span className="block text-2xl font-extrabold">{isHostelite ? formatPKR(price) : "Free"}</span>
                  {isHostelite ? legs === 2 && <span className="block text-xs text-muted-foreground">{formatPKR(unit)} × 2 trips</span> : <span className="block text-xs text-muted-foreground">Covered by your semester fee</span>}
                </span>
              </div>
              <Button size="lg" className="w-full" disabled={(!seatsFull && !seatNo) || !enabled || alreadyBooked || !live || (seatsFull && live.standingAvailable <= 0)} loading={create.isPending} onClick={() => book(seatsFull ? "STANDING" : "SEAT")}>
                {!enabled ? <><Lock className="h-5 w-5" /> Booking paused</> : <><CheckCircle2 className="h-5 w-5" /> {seatsFull ? "Buy standing ticket" : "Book ticket"}</>}
              </Button>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• {tripType === "TWO_WAY" ? "Two-way: the QR works twice, going and coming back." : "One-way: the QR works once and then can't be reused."}</li>
                <li>• Disposed automatically {validHours} hours after the trip starts, or after its scans are used up. Then you book again.</li>
                <li>• Free cancellation until {pricing.data?.freeCancelHours ?? 2} h before departure, then {pricing.data?.cancelFeePercent ?? 50}% of the price.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>My active tickets</CardTitle>
                <CardDescription>Full history is under My Tickets</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {bookings.isError ? (
                <ErrorState onRetry={() => bookings.refetch()} />
              ) : bookings.isLoading ? (
                <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : active.length === 0 ? (
                <EmptyState icon={CalendarX2} title="No active ticket" description="Book a ticket on the left and your QR code appears here and under My QR." />
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence initial={false}>
                    {active.map((b) => (
                      <motion.li key={b.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-md border border-border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-bold">Route {b.routeNumber}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" /> {prettyDate(b.date)} · {b.departTime}
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">{b.type === "SEAT" ? `Seat ${b.seatNo ?? "-"}` : "Standing"} · {b.plate}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <Badge tone="success">{b.tripType === "TWO_WAY" ? `Two-way · ${b.usesAllowed - b.usesDone} left` : "One-way"}</Badge>
                            <span className="text-xs font-semibold text-muted-foreground">{b.id === "pending" ? "…" : timeLeft(b.expiresAt)}</span>
                          </div>
                        </div>
                        {b.id !== "pending" && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Button asChild size="sm"><Link to="/student/qr"><QrCode className="h-4 w-4" /> Show QR</Link></Button>
                            {b.usesDone === 0 ? (
                              <Button variant="outline" size="sm" className="border-danger/40 text-danger hover:bg-danger-soft" onClick={() => setCancelTarget(b)}>
                                <XCircle className="h-4 w-4" /> Cancel
                              </Button>
                            ) : <span />}
                          </div>
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="Cancel this ticket?"
        description={cancelTarget ? `Route ${cancelTarget.routeNumber} · ${prettyDate(cancelTarget.date)} · ${cancelTarget.departTime}` : undefined}
        confirmLabel={preview && !preview.free && preview.fee > 0 ? `Cancel and pay ${formatPKR(preview.fee)}` : "Yes, cancel"}
        tone="danger"
        loading={cancel.isPending}
        onConfirm={() => {
          if (!cancelTarget) return;
          const id = cancelTarget.id;
          setCancelTarget(null);
          cancel.mutate(id, { onSuccess: (b) => toast.success("Ticket cancelled", { description: b.cancelFee ? `A cancellation fee of ${formatPKR(b.cancelFee)} was added to your fines.` : "No charge. Your seat was released." }) });
        }}
      >
        {preview &&
          (preview.free ? (
            <Callout tone="success" title="Free cancellation">
              You're cancelling more than {preview.freeHours} hours before departure, so there's no charge. Your seat goes back to other students immediately.
            </Callout>
          ) : preview.fee > 0 ? (
            <Callout tone="warning" title="Cancellation rule applies">
              Departure is in {Math.max(0, preview.hoursLeft).toFixed(1)} hours, which is inside the {preview.freeHours}-hour free window. A {preview.feePercent}% fee ({formatPKR(preview.fee)}) will be added to your fines.
            </Callout>
          ) : (
            <Callout tone="info" title="No charge">This ticket was free (covered by your semester fee), so there is no cancellation fee.</Callout>
          ))}
      </ConfirmDialog>
    </div>
  );
}

