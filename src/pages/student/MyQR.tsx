import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Link } from "react-router-dom";
import { Armchair, Clock, Footprints, Maximize2, QrCode, ShieldCheck, Ticket } from "lucide-react";
import { PageHeader } from "@/components/domain/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useMyBookings } from "@/hooks/useBookings";
import { useAuthStore } from "@/store/auth";
import { buildTicketQr } from "@/lib/ticketQr";
import { cn } from "@/lib/utils";
import type { BookingRecord } from "@/types/api";

const REFRESH_S = 30;

/** Ticks every second; the QR text is regenerated every 30 s so a screenshot goes stale. */
function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const left = (iso: string, now: number) => {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h}h ${m}m` : `${m}m`;
};

function TicketCard({ b, now, onBig }: { b: BookingRecord; now: number; onBig: () => void }) {
  const slot = Math.floor(now / (REFRESH_S * 1000));
  const value = buildTicketQr(b, slot * REFRESH_S * 1000 + 1);
  const secs = REFRESH_S - Math.floor((now / 1000) % REFRESH_S);
  const usesLeft = b.usesAllowed - b.usesDone;
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-[#14307A] to-[#1D4ED8] p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-extrabold">Route {b.routeNumber}</p>
            <p className="text-sm text-white/85">{b.plate} · {new Date(b.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
          </div>
          <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold">{b.tripType === "TWO_WAY" ? "Two-way" : "One-way"}</span>
        </div>
      </div>
      <CardContent className="p-6">
        <button onClick={onBig} className="mx-auto block rounded-xl bg-white p-4 shadow-soft ring-1 ring-black/10" aria-label={`Enlarge QR code for route ${b.routeNumber}`}>
          <QRCodeSVG value={value} size={240} level="M" bgColor="#ffffff" fgColor="#000000" className="h-auto w-full max-w-[240px]" />
        </button>
        <div className="mx-auto mt-3 h-1.5 max-w-[240px] overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear" style={{ width: `${(secs / REFRESH_S) * 100}%` }} />
        </div>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success" aria-hidden /> Code refreshes in <span className="tabular-nums text-foreground">{secs}s</span>
        </p>

        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-muted p-2.5">
            <dt className="flex items-center justify-center gap-1 text-xs font-semibold text-muted-foreground">{b.type === "SEAT" ? <Armchair className="h-3.5 w-3.5" /> : <Footprints className="h-3.5 w-3.5" />} Seat</dt>
            <dd className="mt-0.5 font-extrabold">{b.type === "SEAT" ? b.seatNo : "Standing"}</dd>
          </div>
          <div className="rounded-md bg-muted p-2.5">
            <dt className="text-xs font-semibold text-muted-foreground">Scans left</dt>
            <dd className="mt-0.5 font-extrabold">{usesLeft} of {b.usesAllowed}</dd>
          </div>
          <div className="rounded-md bg-muted p-2.5">
            <dt className="flex items-center justify-center gap-1 text-xs font-semibold text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Valid</dt>
            <dd className={cn("mt-0.5 font-extrabold", left(b.expiresAt, now) === "expired" && "text-danger")}>{left(b.expiresAt, now)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {b.tripType === "TWO_WAY" ? (b.usesDone === 0 ? "Scan once going, once coming back." : "Going trip done. Scan again for the return.") : "This ticket works for one scan only."} It is disposed automatically after its scans are used or when the time runs out.
        </p>
        <Button className="mt-4 w-full" onClick={onBig}><Maximize2 className="h-4 w-4" /> Full screen</Button>
      </CardContent>
    </Card>
  );
}

export default function MyQR() {
  const user = useAuthStore((s) => s.user)!;
  const bookings = useMyBookings(user.id);
  const now = useClock();
  const [big, setBig] = useState<BookingRecord | null>(null);
  const active = (bookings.data ?? []).filter((b) => b.status === "CONFIRMED" && new Date(b.expiresAt).getTime() > now);
  const slot = Math.floor(now / (REFRESH_S * 1000));

  return (
    <div>
      <PageHeader title="My QR tickets" description="Your QR comes from the ticket you book. Show it to the conductor when you board." />
      {bookings.isError ? (
        <ErrorState onRetry={() => bookings.refetch()} />
      ) : bookings.isLoading ? (
        <div className="mx-auto max-w-md"><Skeleton className="h-96 w-full" /></div>
      ) : active.length === 0 ? (
        <div className="mx-auto max-w-lg">
          <EmptyState
            icon={QrCode}
            title="No QR yet. Book a ticket first"
            description="Every ride needs a ticket. One-way tickets work for one scan, two-way tickets for two (going and coming back). A ticket is disposed automatically after its scans are used or 14 hours after the trip starts, and then you book again."
            action={<Button asChild size="lg"><Link to="/student/book"><Ticket className="h-5 w-5" /> Book a ticket</Link></Button>}
          />
        </div>
      ) : (
        <>
          <p className="mb-4"><Badge tone="primary">{active.length} active ticket{active.length === 1 ? "" : "s"}</Badge></p>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {active.map((b) => <TicketCard key={b.id} b={b} now={now} onBig={() => setBig(b)} />)}
          </div>
        </>
      )}

      <Modal open={!!big} onOpenChange={(o) => !o && setBig(null)} title={big ? `Route ${big.routeNumber} ticket` : "Ticket"} description="Hold your phone steady under the scanner." className="max-w-lg">
        {big && (
          <>
            <div className="rounded-xl bg-white p-5">
              <QRCodeSVG value={buildTicketQr(big, slot * REFRESH_S * 1000 + 1)} size={420} level="M" bgColor="#ffffff" fgColor="#000000" className="h-auto w-full" />
            </div>
            <p className="mt-3 text-center text-lg font-bold">{user.identifier} · {big.tripType === "TWO_WAY" ? "Two-way" : "One-way"}</p>
          </>
        )}
      </Modal>
    </div>
  );
}
