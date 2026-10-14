import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPin, Play, Radio, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAction } from "@/hooks/useOps";
import { fleetService } from "@/services/ops";
import { useRealtimeStore } from "@/store/realtime";
import { DEMO_MODE } from "@/services/wsClient";
import { cn } from "@/lib/utils";

interface Props {
  busId: string;
  plate: string;
}

/** Conductor: start / end the trip and share the phone's GPS as the bus location. */
export function TripControls({ busId, plate }: Props) {
  const active = useRealtimeStore((s) => s.tripActive[busId]) ?? false;
  const [sharing, setSharing] = useState(false);
  const [fix, setFix] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const watch = useRef<number | null>(null);

  const trip = useAction((on: boolean) => fleetService.setTrip(busId, on), { success: undefined });
  const toggleTrip = () =>
    trip.mutate(!active, {
      onSuccess: () => {
        toast.success(!active ? "Trip started. You can scan passengers now." : "Trip ended");
        if (active) setSharing(false);
      },
    });

  useEffect(() => {
    const stop = () => {
      if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
      watch.current = null;
      fleetService.setGpsSharing(busId, false);
    };
    if (!sharing) { stop(); return; }
    if (!navigator.geolocation) { toast.error("This device has no GPS."); setSharing(false); return; }
    fleetService.setGpsSharing(busId, true);
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setFix({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) });
        void fleetService.pushGps(busId, { lat: p.coords.latitude, lng: p.coords.longitude, speedKmh: (p.coords.speed ?? 0) * 3.6, heading: p.coords.heading ?? 0 });
      },
      (e) => {
        toast.error(e.code === 1 ? "Location permission denied. Allow it in your browser settings." : "Couldn't read your location.");
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return stop;
  }, [sharing, busId]);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Trip · {plate}</p>
          <p className={cn("text-lg font-extrabold", active ? "text-success" : "text-muted-foreground")}>{active ? "In progress" : "Not started"}</p>
        </div>
        <Button size="lg" variant={active ? "danger" : "primary"} loading={trip.isPending} onClick={toggleTrip}>
          {active ? <><Square className="h-5 w-5" /> End trip</> : <><Play className="h-5 w-5" /> Start trip</>}
        </Button>
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <Button variant="outline" size="lg" className={cn("w-full", sharing && "border-success text-success")} disabled={!active} onClick={() => setSharing((s) => !s)} aria-pressed={sharing}>
          <Radio className={cn("h-5 w-5", sharing && "animate-pulse")} /> {sharing ? "Sharing my location" : "Share my location (GPS)"}
        </Button>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {!active ? "Start the trip to share the bus location." : sharing ? (fix ? `Live: ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)} (±${fix.acc} m). Students see the bus move with you.` : "Waiting for a GPS fix…") : "Students see this bus's live position and ETA while you share."}
          {DEMO_MODE && sharing && " Demo: the simulated movement is paused while your device location is used."}
        </p>
      </div>
    </Card>
  );
}
