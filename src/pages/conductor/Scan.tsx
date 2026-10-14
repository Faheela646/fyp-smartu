import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bus, CheckCircle2, ScanLine, UserX, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { QrScanner } from "@/components/domain/QrScanner";
import { SeatCounter } from "@/components/domain/SeatCounter";
import { TripControls } from "@/components/domain/TripControls";
import { useAssignedBus } from "@/hooks/useConductorBus";
import { useBusBookings } from "@/hooks/useBookings";
import { useScanLogs, useStudents } from "@/hooks/useOps";
import { buildTicketQr } from "@/lib/ticketQr";
import { scanService, type ScanOutcome } from "@/services/ops";
import { useRealtimeStore } from "@/store/realtime";
import { cn } from "@/lib/utils";

function feedback(ok: boolean) {
  try {
    navigator.vibrate?.(ok ? 80 : [120, 60, 120]);
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    o.type = ok ? "sine" : "square";
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
  } catch {
    /* audio unavailable */
  }
}

export default function Scan() {
  const { user, bus, route, loading } = useAssignedBus();
  const qc = useQueryClient();
  const students = useStudents();
  const logs = useScanLogs();
  const tickets = useBusBookings(bus?.id);
  const seat = useRealtimeStore((s) => (bus ? s.seats[bus.id] : undefined));
  const tripOn = useRealtimeStore((s) => (bus ? s.tripActive[bus.id] : undefined)) ?? false;
  const [result, setResult] = useState<ScanOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [sim, setSim] = useState("");
  const timer = useRef<number>();

  const today = new Date().toISOString().slice(0, 10);
  const boarded = (logs.data ?? []).filter((l) => l.busId === bus?.id && l.result !== "FAILED" && l.ts.slice(0, 10) === today).length;
  const usable = useMemo(() => (tickets.data ?? []).filter((t) => t.status === "CONFIRMED"), [tickets.data]);
  const nameOf = (id: string) => students.data?.find((s) => s.id === id)?.name ?? id;

  const handle = useCallback(
    async (raw: string) => {
      if (!bus || busy) return;
      setBusy(true);
      try {
        const out = await scanService.scan(raw, bus.id, user.name);
        feedback(out.ok);
        setResult(out);
        qc.invalidateQueries({ queryKey: ["scan-logs"] });
        qc.invalidateQueries({ queryKey: ["bookings"] });
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setResult(null), 3400);
      } finally {
        setBusy(false);
      }
    },
    [bus, busy, user.name, qc],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const simulate = (kind: "valid" | "stale" | "unknown" | "bad") => {
    if (kind === "bad") return handle("hello-world");
    const t = tickets.data?.find((x) => x.id === sim);
    if (kind === "unknown") return handle(buildTicketQr({ id: "TK-NOPE00", userId: "U-3082" }));
    if (!t) return;
    handle(buildTicketQr(t, kind === "stale" ? Date.now() - 10 * 60_000 : Date.now()));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-5">
          {loading || !bus ? <Skeleton className="h-12 w-full" /> : (
            <>
              <div className="flex items-center gap-3.5">
                <span className="grid h-12 w-12 place-items-center rounded-md text-lg font-extrabold text-white" style={{ background: route?.color }}>{route?.number ?? <Bus className="h-6 w-6" />}</span>
                <div>
                  <p className="text-lg font-extrabold leading-tight">{route?.name}{route?.note ? ` (${route.note})` : ""}</p>
                  <p className="text-sm text-muted-foreground">{bus.plate} · <Badge tone={tripOn ? "success" : "neutral"}>{tripOn ? "Trip active" : "Trip not started"}</Badge></p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-muted-foreground">Boarded today</p>
                <p className="text-3xl font-extrabold tabular-nums">{boarded}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {bus && <TripControls busId={bus.id} plate={bus.plate} />}

      <div className="relative">
        <QrScanner onScan={handle} />
        {!tripOn && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2 rounded-xl bg-[#0B1326]/92 p-6 text-center text-white">
            <p className="text-xl font-extrabold">Scanner locked</p>
            <p className="max-w-xs text-base text-white/85">Start the trip above to begin scanning passengers.</p>
          </div>
        )}
        <AnimatePresence>
          {result && (
            <motion.div
              key={result.title + result.detail}
              role="alert"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setResult(null)}
              className={cn("absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl p-6 text-center text-white", result.ok ? "bg-[#15803D]" : "bg-[#B91C1C]")}
            >
              {result.ok ? <CheckCircle2 className="h-24 w-24" /> : <XCircle className="h-24 w-24" />}
              <p className="text-3xl font-extrabold">{result.title}</p>
              <p className="text-lg font-medium text-white/95">{result.detail}</p>
              {result.seat && <p className="rounded-full bg-white/20 px-5 py-1.5 text-xl font-bold">{result.seat}</p>}
              {result.legText && <p className="text-base font-semibold text-white/95">{result.legText}</p>}
              <p className="text-sm text-white/80">Tap to dismiss</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-sm font-semibold text-muted-foreground">Seats free</p>
          {seat ? <SeatCounter value={seat.seatsAvailable} total={seat.seatsTotal} className="text-3xl" /> : <Skeleton className="mt-1 h-9 w-20" />}
        </Card>
        <Button asChild variant="outline" className="h-auto flex-col gap-1 whitespace-normal py-4 text-center text-base">
          <Link to="/conductor/manual"><UserX className="h-6 w-6" /> Scan failed? Mark manually</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ScanLine className="h-5 w-5 text-primary" /> Demo: simulate a scan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">No camera or phone handy? Pick a ticket booked on this bus and fire a scan to see the instant success / failure feedback. Students book from their own account.</p>
          <Select label={`Tickets on this bus (${usable.length} active)`} value={sim} onChange={(e) => setSim(e.target.value)}>
            <option value="">{usable.length ? "Choose a ticket…" : "No active tickets on this bus yet"}</option>
            {(tickets.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>{nameOf(t.userId)} · {t.tripType === "TWO_WAY" ? `two-way (${t.usesDone}/${t.usesAllowed} used)` : `one-way (${t.usesDone}/1 used)`} · {t.status.toLowerCase()}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button disabled={!sim || busy || !tripOn} onClick={() => simulate("valid")}>Scan ticket</Button>
            <Button variant="outline" disabled={!sim || busy || !tripOn} onClick={() => simulate("stale")}>Old QR</Button>
            <Button variant="outline" disabled={busy || !tripOn} onClick={() => simulate("unknown")}>No ticket</Button>
            <Button variant="outline" disabled={busy || !tripOn} onClick={() => simulate("bad")}>Bad QR</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
